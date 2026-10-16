import ipaddress, json, os, re, shutil, socket, subprocess, threading, time, uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
from faster_whisper import WhisperModel
import requests

ROOT=Path(os.getenv("CLIP_DATA_DIR","/data")).resolve(); INBOX=ROOT/"inbox"; OUT=ROOT/"outputs"
for p in (INBOX,OUT): p.mkdir(parents=True,exist_ok=True)
TOKEN=os.getenv("CLIP_WORKER_TOKEN",""); PUBLIC=os.getenv("CLIP_WORKER_PUBLIC_URL","").rstrip("/"); TUNELIO_API_KEY=os.getenv("TUNELIO_API_KEY","").strip()
TUNELIO_FALLBACK_ENABLED=os.getenv("TUNELIO_FALLBACK_ENABLED","false").strip().lower() in {"1","true","yes","on"}
VIDFETCH_API_KEY=os.getenv("VIDFETCH_API_KEY","").strip()
VIDFETCH_FALLBACK_ENABLED=os.getenv("VIDFETCH_FALLBACK_ENABLED","false").strip().lower() in {"1","true","yes","on"}
VIDFETCH_QUALITY=os.getenv("VIDFETCH_QUALITY","360p").strip().lower()
VIDFETCH_MONTHLY_MAX_BYTES=int(os.getenv("VIDFETCH_MONTHLY_MAX_BYTES",str(800*1024*1024)))
VIDFETCH_MONTHLY_MAX_JOBS=int(os.getenv("VIDFETCH_MONTHLY_MAX_JOBS","20"))
VIDFETCH_MAX_ESTIMATED_BYTES=int(os.getenv("VIDFETCH_MAX_ESTIMATED_BYTES",str(150*1024*1024)))
VIDFETCH_USAGE_PATH=ROOT/"vidfetch-usage.json"; VIDFETCH_USAGE_LOCK=threading.Lock()
MAX_SECONDS=int(os.getenv("MAX_SOURCE_SECONDS","1800")); MAX_BYTES=int(os.getenv("MAX_DOWNLOAD_BYTES",str(750*1024*1024)))
MAX_UPLOAD_BYTES=min(MAX_BYTES,int(os.getenv("MAX_UPLOAD_BYTES",str(10*1024*1024))))
MODEL_NAME=os.getenv("WHISPER_MODEL","small"); POOL=ThreadPoolExecutor(max_workers=1); LOCK=threading.Lock(); MODEL_LOCK=threading.Lock(); JOBS={}; MODEL=None
YOUTUBE_HOSTS={"youtube.com","www.youtube.com","m.youtube.com","youtu.be","youtube-nocookie.com"}
HOSTS={"youtube.com","www.youtube.com","m.youtube.com","youtu.be","youtube-nocookie.com","vimeo.com","www.vimeo.com","player.vimeo.com","twitch.tv","www.twitch.tv","clips.twitch.tv","loom.com","www.loom.com","drive.google.com","docs.google.com","dropbox.com","www.dropbox.com","dl.dropboxusercontent.com","archive.org","www.archive.org","rumble.com","www.rumble.com","facebook.com","www.facebook.com","fb.watch","linkedin.com","www.linkedin.com","x.com","www.x.com","twitter.com","www.twitter.com"}
app=FastAPI(title="Rapigents Free Clip Worker",version="1.0.0"); app.mount("/media",StaticFiles(directory=str(OUT)),name="media")
class JobRequest(BaseModel): url: HttpUrl
def auth(value):
 if not TOKEN: raise HTTPException(503,detail="Configure CLIP_WORKER_TOKEN before accepting jobs.")
 if value!=f"Bearer {TOKEN}": raise HTTPException(401,detail="Invalid worker token.")
def validate(raw):
 u=urlparse(raw)
 if u.scheme not in ("http","https") or not u.hostname or u.username or u.password: raise ValueError("Use a public http/https video URL.")
 host=u.hostname.lower().rstrip("."); allowed=host in HOSTS or any(host.endswith("."+x) for x in HOSTS)
 if not allowed:
  if not u.path.lower().endswith((".mp4",".m4v",".mov",".webm",".m3u8")): raise ValueError("This source domain is not supported yet. Use a supported platform or a direct video-file URL.")
  try: ips={x[4][0] for x in socket.getaddrinfo(host,None)}
  except socket.gaierror: raise ValueError("The source host could not be resolved.")
  if not ips or any(not ipaddress.ip_address(x).is_global for x in ips): raise ValueError("Private or local network URLs are not allowed.")
 return raw
def cmd(args,timeout=900):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=timeout)
 if p.returncode: raise RuntimeError((p.stderr or p.stdout or "Media command failed")[-1200:])
 return p.stdout.strip()
def download_from_ytdlp(raw_url,work,is_youtube=False):
 # Uses the open-source bgutil PO-token plugin when installed locally.
 # YouTube client choices are important on datacenter IPs; token support is not a guarantee.
 for stale in work.glob("source.*"):
  if stale.is_file(): stale.unlink()
 args=["yt-dlp","--no-playlist","--no-warnings","--max-filesize",str(MAX_BYTES),"--match-filter",f"duration <= {MAX_SECONDS}","-f","bv*[height<=720]+ba/b[height<=720]/b","--merge-output-format","mp4","-o",str(work/"source.%(ext)s")]
 if is_youtube:
  args.extend(["--extractor-args","youtube:player-client=mweb,tv,web_safari"])
 args.append(raw_url)
 cmd(args,900)
 files=[p for p in work.glob("source.*") if p.is_file() and p.stat().st_size]
 if not files: raise RuntimeError("No source downloaded. It may be private, restricted, unsupported, or too large.")
 src=max(files,key=lambda p:p.stat().st_size)
 if src.stat().st_size>MAX_BYTES: raise RuntimeError("Source exceeds worker download-size limit.")
 return src

def _vidfetch_month():
 return datetime.now(timezone.utc).strftime("%Y-%m")

def _vidfetch_read_usage():
 month=_vidfetch_month()
 if not VIDFETCH_USAGE_PATH.exists():
  return {"month":month,"jobs_started":0,"bytes_used":0,"reservations":{}}
 try:
  state=json.loads(VIDFETCH_USAGE_PATH.read_text(encoding="utf-8"))
 except Exception as e:
  raise RuntimeError("VidFetch quota ledger is unreadable; refusing a download to protect the account quota.") from e
 if not isinstance(state,dict) or not isinstance(state.get("month"),str):
  raise RuntimeError("VidFetch quota ledger is invalid; refusing a download to protect the account quota.")
 if state["month"]!=month:
  return {"month":month,"jobs_started":0,"bytes_used":0,"reservations":{}}
 if not isinstance(state.get("reservations"),dict):
  raise RuntimeError("VidFetch quota ledger is invalid; refusing a download to protect the account quota.")
 state.setdefault("jobs_started",0); state.setdefault("bytes_used",0)
 return state

def _vidfetch_save_usage(state):
 VIDFETCH_USAGE_PATH.parent.mkdir(parents=True,exist_ok=True)
 tmp=VIDFETCH_USAGE_PATH.with_suffix(".tmp")
 tmp.write_text(json.dumps(state,separators=(",",":")),encoding="utf-8")
 os.chmod(tmp,0o600)
 os.replace(tmp,VIDFETCH_USAGE_PATH)

def _vidfetch_reserve(estimated_bytes):
 if estimated_bytes<=0:
  raise RuntimeError("VidFetch did not provide a usable size estimate; refusing an unbounded download.")
 if estimated_bytes>VIDFETCH_MAX_ESTIMATED_BYTES:
  raise RuntimeError(f"VidFetch estimate is {estimated_bytes//(1024*1024)} MiB, above the worker's {VIDFETCH_MAX_ESTIMATED_BYTES//(1024*1024)} MiB per-job safety limit.")
 reservation=uuid.uuid4().hex
 padded=int(estimated_bytes*1.5)
 with VIDFETCH_USAGE_LOCK:
  state=_vidfetch_read_usage()
  inflight=sum(int(v.get("reserved_bytes",0)) for v in state["reservations"].values() if isinstance(v,dict))
  if int(state["jobs_started"])>=VIDFETCH_MONTHLY_MAX_JOBS:
   raise RuntimeError(f"VidFetch monthly safety limit reached ({VIDFETCH_MONTHLY_MAX_JOBS} jobs).")
  if int(state["bytes_used"])+inflight+padded>VIDFETCH_MONTHLY_MAX_BYTES:
   used=(int(state["bytes_used"])+inflight)//(1024*1024)
   cap=VIDFETCH_MONTHLY_MAX_BYTES//(1024*1024)
   raise RuntimeError(f"VidFetch monthly safety budget would be exceeded ({used} MiB reserved/used of {cap} MiB).")
  state["jobs_started"]=int(state["jobs_started"])+1
  state["reservations"][reservation]={"reserved_bytes":padded,"estimated_bytes":estimated_bytes,"created_at":datetime.now(timezone.utc).isoformat()}
  _vidfetch_save_usage(state)
 return reservation

def _vidfetch_finalize(reservation,actual_bytes=None,keep_reservation_as_charge=False):
 with VIDFETCH_USAGE_LOCK:
  state=_vidfetch_read_usage()
  entry=state["reservations"].pop(reservation,None)
  if entry is None: return
  charged=int(entry.get("reserved_bytes",0)) if keep_reservation_as_charge or actual_bytes is None else max(0,int(actual_bytes))
  state["bytes_used"]=int(state.get("bytes_used",0))+charged
  _vidfetch_save_usage(state)

def download_from_vidfetch(raw_url,work):
 if not VIDFETCH_API_KEY: raise RuntimeError("VidFetch fallback is enabled but VIDFETCH_API_KEY is not configured on the worker.")
 headers={"Authorization":f"Bearer {VIDFETCH_API_KEY}","Content-Type":"application/json"}
 for stale in work.glob("source.*"):
  if stale.is_file(): stale.unlink()

 # /info is the documented preflight endpoint. It does not start a download job.
 try:
  response=requests.post("https://api.vidfetch.dev/v1/info",headers=headers,json={"url":raw_url},timeout=30)
  response.raise_for_status()
  info=response.json()
 except requests.RequestException as e:
  raise RuntimeError("VidFetch metadata preflight failed; no download was started.") from e
 except ValueError as e:
  raise RuntimeError("VidFetch metadata preflight returned invalid JSON; no download was started.") from e
 if not isinstance(info,dict) or not isinstance(info.get("formats"),list):
  raise RuntimeError("VidFetch metadata did not include a formats list; refusing to start a download.")

 # Choose the best advertised quality at or below the configured cap.
 match=re.match(r"^(\d+)p$",VIDFETCH_QUALITY)
 target_height=int(match.group(1)) if match else 360
 candidates=[]
 for item in info["formats"]:
  if not isinstance(item,dict): continue
  quality=str(item.get("quality","")).lower()
  qm=re.match(r"^(\d+)p$",quality)
  try: size=int(item.get("size",0))
  except (TypeError,ValueError): size=0
  if qm and size>0 and int(qm.group(1))<=target_height:
   candidates.append((int(qm.group(1)),size,quality))
 if not candidates:
  raise RuntimeError(f"VidFetch offered no known format at or below {target_height}p; refusing an unbounded download.")
 height,estimate,quality=max(candidates,key=lambda x:x[0])
 if estimate>MAX_BYTES:
  raise RuntimeError("VidFetch's estimated source size exceeds this worker's download limit.")
 reservation=_vidfetch_reserve(estimate)
 settled=False
 try:
  try:
   response=requests.post("https://api.vidfetch.dev/v1/downloads",headers=headers,json={"url":raw_url,"format":quality},timeout=30)
   if not response.ok:
    # The preflight is free; retain a conservative reservation only for ambiguous server errors.
    if response.status_code<500:
     _vidfetch_finalize(reservation,actual_bytes=0); settled=True
    raise RuntimeError(f"VidFetch download request failed (HTTP {response.status_code}): {response.text[:240]}")
   payload=response.json()
  except requests.RequestException as e:
   raise RuntimeError("VidFetch download request could not be confirmed; its reserved allowance was retained for safety.") from e
  except ValueError as e:
   raise RuntimeError("VidFetch download request returned invalid JSON; its reserved allowance was retained for safety.") from e
  if not isinstance(payload,dict): raise RuntimeError("VidFetch returned an unexpected download-job response.")
  job_id=payload.get("id")
  status=str(payload.get("status","queued")).lower()
  direct=payload.get("download_url")
  if not isinstance(direct,str) or not direct:
   if not isinstance(job_id,str) or not re.fullmatch(r"[A-Za-z0-9_-]{4,128}",job_id):
    raise RuntimeError("VidFetch did not return a valid download job ID.")
   deadline=time.monotonic()+240
   while not isinstance(direct,str) or not direct:
    if status in {"failed","cancelled","canceled","error"}:
     detail=payload.get("error") or payload.get("message") or payload.get("error_message") or "The provider marked the download as failed."
     raise RuntimeError("VidFetch download failed: "+str(detail)[:300])
    if time.monotonic()>=deadline:
     raise RuntimeError("VidFetch download timed out while waiting for the provider.")
    time.sleep(3)
    try:
     response=requests.get("https://api.vidfetch.dev/v1/downloads/"+job_id,headers=headers,timeout=25)
     if not response.ok: raise RuntimeError(f"VidFetch status check failed (HTTP {response.status_code}).")
     payload=response.json()
    except requests.RequestException as e:
     raise RuntimeError("Could not check the VidFetch download status.") from e
    except ValueError as e:
     raise RuntimeError("VidFetch status endpoint returned invalid JSON.") from e
    if not isinstance(payload,dict): raise RuntimeError("VidFetch status endpoint returned an unexpected response.")
    status=str(payload.get("status","queued")).lower()
    direct=payload.get("download_url")
  if status and status not in {"completed","complete","success","succeeded"}:
   raise RuntimeError("VidFetch returned a download URL before the job was marked completed.")
  parsed=urlparse(direct)
  host=(parsed.hostname or "").lower().rstrip(".")
  if parsed.scheme!="https" or not host.endswith(".r2.cloudflarestorage.com") or parsed.username or parsed.password:
   raise RuntimeError("VidFetch returned an unexpected media-host URL; refusing to fetch it.")
  dest=work/"source.mp4"; total=0
  with requests.get(direct,stream=True,timeout=(15,90),allow_redirects=False) as download:
   download.raise_for_status()
   size=download.headers.get("content-length")
   if size:
    try:
     if int(size)>MAX_BYTES: raise RuntimeError("VidFetch source exceeds the worker's configured size limit.")
    except ValueError: pass
   with dest.open("wb") as handle:
    for chunk in download.iter_content(chunk_size=1024*1024):
     if not chunk: continue
     total+=len(chunk)
     if total>MAX_BYTES: raise RuntimeError("VidFetch source exceeds the worker's configured size limit.")
     handle.write(chunk)
  if total<=0:
   dest.unlink(missing_ok=True)
   raise RuntimeError("VidFetch returned an empty file.")
  _vidfetch_finalize(reservation,actual_bytes=total); settled=True
  return dest
 except Exception:
  if not settled:
   # A provider job may already have completed, so count its reserved estimate
   # against the local cap rather than allowing retries to burn the allowance.
   try: _vidfetch_finalize(reservation,keep_reservation_as_charge=True)
   except Exception: pass
  raise

def download_from_tunelio(raw_url,work):
 if not TUNELIO_API_KEY: raise RuntimeError("YouTube URL importing is not configured yet. Add the private TUNELIO_API_KEY on the AWS worker.")
 try:
  response=requests.get("https://tunelio.dev/create",params={"quality":"720p","url":raw_url},headers={"Authorization":f"Bearer {TUNELIO_API_KEY}"},timeout=45)
  response.raise_for_status()
  payload=response.json()
 except requests.RequestException as e:
  raise RuntimeError("The YouTube link resolver could not be reached. Try again later.") from e
 except ValueError as e:
  raise RuntimeError("The YouTube link resolver returned an invalid response.") from e
 direct=payload.get("url") if isinstance(payload,dict) else None
 if not isinstance(payload,dict) or payload.get("status")!="ok" or not isinstance(direct,str):
  detail=payload.get("error","No downloadable video was returned.") if isinstance(payload,dict) else "No downloadable video was returned."
  if isinstance(detail,dict): detail=detail.get("message","No downloadable video was returned.")
  raise RuntimeError("YouTube link resolver: "+str(detail)[:240])
 parsed=urlparse(direct)
 if parsed.scheme!="https" or not parsed.hostname: raise RuntimeError("The resolver returned an invalid media URL.")
 dest=work/"source.mp4"; total=0
 try:
  with requests.get(direct,stream=True,timeout=(15,90)) as download:
   download.raise_for_status()
   size=download.headers.get("content-length")
   if size:
    try:
     if int(size)>MAX_BYTES: raise RuntimeError("Source video exceeds the worker's 750 MB size limit.")
    except ValueError: pass
   with dest.open("wb") as handle:
    for chunk in download.iter_content(chunk_size=1024*1024):
     if not chunk: continue
     total+=len(chunk)
     if total>MAX_BYTES: raise RuntimeError("Source video exceeds the worker's 750 MB size limit.")
     handle.write(chunk)
 except requests.RequestException as e:
  dest.unlink(missing_ok=True)
  raise RuntimeError("Could not download the resolved video. Try a shorter video or another quality.") from e
 if total<=0:
  dest.unlink(missing_ok=True)
  raise RuntimeError("The resolver returned an empty video file.")
 return dest

def model():
 global MODEL
 with MODEL_LOCK:
  if MODEL is None: MODEL=WhisperModel(MODEL_NAME,device="cpu",compute_type="int8")
  return MODEL
def stamp(sec):
 ms=max(0,int(sec*1000)); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
 return f"{h:02}:{m:02}:{s:02},{ms:03}"
def transcript_sentences(segments):
 """Split Whisper's word-timed transcript into sentence/long-pause chunks."""
 sentences=[]; current=[]
 def flush():
  nonlocal current
  if current:
   text=" ".join(w["text"] for w in current).strip()
   if text:
    sentences.append({"start":current[0]["start"],"end":current[-1]["end"],"text":text,"words":current[:]})
  current=[]
 for seg in segments:
  seg_start=float(getattr(seg,"start",0.0)); seg_end=float(getattr(seg,"end",seg_start))
  items=getattr(seg,"words",None)
  if items:
   for item in items:
    word=str(getattr(item,"word","")).strip()
    if not word: continue
    start=float(getattr(item,"start",seg_start) or seg_start)
    end=float(getattr(item,"end",start+0.08) or start+0.08)
    if current and start-current[-1]["end"]>1.2: flush()
    current.append({"start":start,"end":max(start+0.04,end),"text":word})
    if re.search(r"""[.!?…]["')\]]*$""",word): flush()
  else:
   text=re.sub(r"\s+"," ",str(getattr(seg,"text",""))).strip()
   if not text: continue
   if current and seg_start-current[-1]["end"]>1.2: flush()
   current.append({"start":seg_start,"end":max(seg_start+0.08,seg_end),"text":text})
   if re.search(r"""[.!?…]["')\]]*$""",text) or len(current)>=8: flush()
 flush()
 return sentences

def picks(transcript,duration):
 chunks=[]
 for item in transcript:
  if isinstance(item,dict):
   start=float(item.get("start",0)); end=float(item.get("end",0))
   text=re.sub(r"\s+"," ",str(item.get("text",""))).strip()
   words=item.get("words",[])
  else:
   start=float(item.start); end=float(item.end)
   text=re.sub(r"\s+"," ",str(item.text)).strip()
   words=[]
  if text and end>start:
   chunks.append({"start":start,"end":end,"text":text,"words":words})
 if not chunks: raise RuntimeError("Speech recognition found no usable spoken content.")
 target=min(45.,max(18.,duration/5)); windows=[]; cursor=chunks[0]["start"]
 while cursor<duration and len(windows)<18:
  limit=min(duration,cursor+target); selected=[x for x in chunks if x["start"]<limit and x["end"]>cursor]
  if selected:
   start=max(0.,selected[0]["start"]); end=min(duration,selected[-1]["end"])
   words=" ".join(x["text"] for x in selected).strip(); tokens=re.findall(r"\b[\w']+\b",words.lower())
   if end-start>=8 and len(tokens)>=12:
    title=suggest_title(words)
    # Fully local highlight ranking: speech density, a clean ending, and language
    # patterns common in explanations, questions, contrasts, and story payoffs.
    score=min(len(tokens),100)*0.55
    if re.search(r"[.!?][\"')]*$",words): score+=10
    if re.search(r"\b(how to|why|here'?s|the reason|the truth|what happens|the biggest|the most|the problem|the secret|mistake|lesson|because|imagine|remember|first|finally)\b",words,re.I): score+=12
    if "?" in words: score+=7
    if re.search(r"\b(you|your|we|our)\b",words,re.I): score+=4
    if re.search(r"\b(but|however|instead|although|yet|except)\b",words,re.I): score+=5
    if re.search(r"\b\d+(?:[.,]\d+)?%?\b",words): score+=3
    fillers=len(re.findall(r"\b(um|uh|erm|you know|like)\b",words,re.I))
    score-=min(fillers*2,10)
    windows.append({"start":start,"end":end,"title":title,"hookTitle":suggest_hook(words),"hook":words[:220],"score":score,"segments":selected})
  cursor+=max(12.,target*.65)
 windows.sort(key=lambda x:x["score"],reverse=True); unique=[]
 for x in windows:
  if all(abs(x["start"]-y["start"])>target*.55 for y in unique): unique.append(x)
 return unique[:5]

def suggest_title(text):
 words=re.sub(r"\s+"," ",text).strip()
 first=re.split(r"(?<=[.!?])\s+",words)[0].strip(" .!?")
 if re.search(r"\bhow to\b",words,re.I): candidate="How to "+re.split(r"\bhow to\b",words,flags=re.I)[-1].split(".")[0].strip(" .!?")
 elif re.search(r"\bwhy\b",first,re.I): candidate=first
 elif re.search(r"\b(mistake|wrong|fail|failed)\b",words,re.I): candidate="The mistake most people miss"
 elif re.search(r"\b(secret|truth|reason)\b",words,re.I): candidate=first
 elif re.search(r"\b(but|however|instead)\b",words,re.I): candidate="The part people overlook"
 else: candidate=first or "The key takeaway"
 candidate=re.sub(r"\s+"," ",candidate).strip()
 if len(candidate)>68: candidate=candidate[:65].rsplit(" ",1)[0]+"…"
 return candidate[:90] or "The key takeaway"

def suggest_hook(text):
 words=re.sub(r"\s+"," ",text).strip()
 if re.search(r"\b(ishowspeed|speed)\b",words,re.I) and re.search(r"\b(react|reaction|watch|saw|video|see|look)\w*\b",words,re.I): return "SPEED'S REACTION SAYS IT ALL"
 if re.search(r"\b(reaction|reacting|reacted)\b",words,re.I): return "WAIT FOR THE REACTION"
 if re.search(r"\b(unbelievable|insane|shocking|crazy|can't believe|cannot believe)\b",words,re.I): return "YOU'RE NOT READY FOR THIS"
 if re.search(r"\b(secret|truth|reason|mistake)\b",words,re.I): return "THE DETAIL EVERYONE MISSES"
 if "?" in words or re.search(r"\b(why|what happens|how did)\b",words,re.I): return "HERE'S WHY THIS MATTERS"
 title=suggest_title(words).strip(" .!?")
 return title.upper() if title else "THE PART YOU NEED TO SEE"

def caption_chunks(text,max_words=5):
 words=str(text).split()
 return [" ".join(words[i:i+max_words]) for i in range(0,len(words),max_words)]

def ass_stamp(sec):
 ms=max(0,int(sec*100)); h,ms=divmod(ms,360000); m,ms=divmod(ms,6000); s,cs=divmod(ms,100)
 return f"{h}:{m:02}:{s:02}.{cs:02}"

def ass_escape(value):
 return str(value).replace("\\","\\\\").replace("{","\\{").replace("}","\\}").replace("\n"," ").strip()

def process(jid,url):
 work=INBOX/jid; work.mkdir(parents=True,exist_ok=True)
 try:
  if url.startswith("file://"):
   with LOCK: JOBS[jid].update(status="downloading",message="Validating uploaded video…")
   src=Path(urlparse(url).path)
   if not src.is_file() or src.stat().st_size<=0: raise RuntimeError("Uploaded video file is missing or empty.")
   if src.stat().st_size>MAX_UPLOAD_BYTES: raise RuntimeError("Uploaded video exceeds the upload limit.")
  else:
   parsed_url=urlparse(url)
   is_youtube=bool(parsed_url.hostname and parsed_url.hostname.lower().rstrip(".") in YOUTUBE_HOSTS)
   with LOCK: JOBS[jid].update(status="downloading",message="Trying free local YouTube resolver…" if is_youtube else "Downloading source with yt-dlp…")
   if is_youtube:
    try:
     src=download_from_ytdlp(url,work,is_youtube=True)
    except Exception as local_error:
     src=None; fallback_errors=[]
     if VIDFETCH_FALLBACK_ENABLED:
      with LOCK: JOBS[jid].update(status="downloading",message="Local YouTube download failed; checking configured VidFetch fallback…")
      try: src=download_from_vidfetch(url,work)
      except Exception as fallback_error: fallback_errors.append("VidFetch: "+str(fallback_error)[-320:])
     if src is None and TUNELIO_FALLBACK_ENABLED:
      with LOCK: JOBS[jid].update(status="downloading",message="Trying configured Tunelio fallback…")
      try: src=download_from_tunelio(url,work)
      except Exception as fallback_error: fallback_errors.append("Tunelio: "+str(fallback_error)[-320:])
     if src is None:
      details="; ".join(fallback_errors)
      prefix="Free local YouTube download failed. YouTube may restrict this server IP. Details: "+str(local_error)[-500:]
      raise RuntimeError(prefix+("; configured fallbacks failed: "+details if details else "; no hosted fallback is enabled."))

   else:
    src=download_from_ytdlp(url,work,is_youtube=False)
  duration=float(cmd(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(src)]))
  if duration<=0 or duration>MAX_SECONDS: raise RuntimeError(f"Source must be under {MAX_SECONDS//60} minutes.")
  with LOCK: JOBS[jid].update(status="transcribing",message="Transcribing speech locally with faster-whisper…")
  m=model(); segments,info=m.transcribe(str(src),vad_filter=True,word_timestamps=True,beam_size=3); transcript=transcript_sentences(list(segments)); selections=picks(transcript,duration)
  with LOCK: JOBS[jid].update(status="rendering",message="Editing clips: smart zoom, hook titles, colored captions, and subtle sound effects…")
  results=[]
  for n,pick in enumerate(selections,1):
   start,end=pick["start"],pick["end"]; cid=f"{jid}-{n}"; ass=work/f"{cid}.ass"; sfx=work/f"{cid}-sfx.wav"; name=f"{cid}.mp4"; out=OUT/name
   header="""[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,DejaVu Sans,43,&H00FFFFFF,&H0000FFFF,&HDD08090D,&H8808090D,-1,0,0,0,100,100,0,0,1,4,2,2,68,68,300,1
Style: Hook,DejaVu Sans,50,&H0087F5FF,&H0000FFFF,&HDD08090D,&H9908090D,-1,0,0,0,100,100,0,0,1,5,2,8,60,60,175,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
   events=[]
   hook_text=pick.get("hookTitle",pick["title"]).upper()
   events.append(f"Dialogue: 1,0:00:00.00,0:00:02.85,Hook,,0,0,0,,{{\\fad(220,260)\\an8\\pos(360,175)\\fscx78\\fscy78\\t(0,420,\\fscx100\\fscy100)\\blur(1.2)\\t(250,500,\\blur(0))}}{ass_escape(hook_text)}")
   colors=["&H0087F5FF","&H00FF91C8","&H00FFFFFF","&H008BFF9B"]
   for i,seg in enumerate(pick["segments"]):
    words=seg.get("words") or []
    if words:
     groups=[words[k:k+4] for k in range(0,len(words),4)]
     for j,group in enumerate(groups):
      pa=max(0.0,float(group[0]["start"])-start)
      pb=min(end-start,float(group[-1]["end"])-start)
      caption=ass_escape(" ".join(w["text"] for w in group).replace("-->","→"))
      if not caption: continue
      events.append(f"Dialogue: 0,{ass_stamp(pa)},{ass_stamp(max(pa+0.14,pb))},Caption,,0,0,0,,{{\\fad(55,75)\\c{colors[(i+j)%len(colors)]}\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}{caption.upper()}")
    else:
     a=max(0.0,float(seg["start"])-start); b=max(a+0.18,min(end-start,float(seg["end"])-start))
     pieces=caption_chunks(seg["text"].replace("-->","→"),4)
     if not pieces: continue
     span=max(0.18,b-a)
     for j,piece in enumerate(pieces):
      pa=a+span*j/len(pieces); pb=a+span*(j+1)/len(pieces)
      caption=ass_escape(piece)
      events.append(f"Dialogue: 0,{ass_stamp(pa)},{ass_stamp(max(pa+0.12,pb))},Caption,,0,0,0,,{{\\fad(55,75)\\c{colors[(i+j)%len(colors)]}\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}{caption.upper()}")
   ass.write_text(header+"\n".join(events)+"\n",encoding="utf-8")
   cmd(["ffmpeg","-y","-f","lavfi","-i","anoisesrc=color=white:duration=0.65:sample_rate=48000","-f","lavfi","-i","sine=frequency=82:duration=0.18:sample_rate=48000","-filter_complex","[0:a]highpass=f=450,lowpass=f=9000,afade=t=in:st=0:d=0.16,afade=t=out:st=0.18:d=0.42,volume=0.10[whoosh];[1:a]afade=t=in:st=0:d=0.01,afade=t=out:st=0.03:d=0.15,volume=0.16[thump];[whoosh][thump]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.8[out]","-map","[out]","-ac","2",str(sfx)],60)
   ass_path=str(ass).replace("\\\\","/").replace(":","\\\\:")
   vf=f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.00055,1.07)':x='iw/2-(iw/zoom/2)+sin(on/95)*5':y='ih/2-(ih/zoom/2)+cos(on/125)*4':d=1:s=720x1280:fps=30,eq=contrast=1.04:saturation=1.08,unsharp=5:5:0.3:3:3:0.0,ass='{ass_path}'"
   cmd(["ffmpeg","-y","-ss",str(start),"-i",str(src),"-i",str(sfx),"-t",str(end-start),"-filter_complex",f"[0:a]volume=1.0[original];[1:a]adelay=120|120[effect];[original][effect]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]","-vf",vf,"-map","0:v:0","-map","[aout]","-c:v","libx264","-preset","veryfast","-crf","24","-c:a","aac","-b:a","128k","-pix_fmt","yuv420p","-movflags","+faststart",str(out)],600)
   potential=min(98,max(35,round(pick["score"])))
   outlook="Strong signals" if potential>=75 else "Promising" if potential>=58 else "Niche fit"
   results.append({"id":cid,"title":pick["title"],"hookTitle":pick.get("hookTitle",pick["title"]),"hook":pick["hook"],"start":round(start,2),"end":round(end,2),"potentialScore":potential,"reachOutlook":outlook,"effects":["sentence-aware selection","word-timed captions","subtle motion","animated opening hook","layered whoosh impact"],"url":f"{PUBLIC}/media/{name}" if PUBLIC else f"/media/{name}"})
  with LOCK: JOBS[jid].update(status="completed",message=f"Created {len(results)} clips.",clips=results,duration=duration,language=getattr(info,"language",None))
 except subprocess.TimeoutExpired:
  with LOCK: JOBS[jid].update(status="failed",message="Processing timed out. Try a shorter or lower-resolution source.")
 except Exception as e:
  with LOCK: JOBS[jid].update(status="failed",message=str(e)[:1200])
 finally: shutil.rmtree(work,ignore_errors=True)
@app.post("/jobs/upload",status_code=202)
async def create_from_upload(request:Request,authorization:str|None=Header(default=None),x_upload_filename:str|None=Header(default=None)):
 auth(authorization)
 raw_name=unquote(x_upload_filename or "upload.mp4")
 filename=Path(raw_name).name
 suffix=Path(filename).suffix.lower()
 if suffix not in {".mp4",".mov",".webm",".m4v",".mkv"}:
  raise HTTPException(415,detail="Upload an MP4, MOV, WebM, M4V, or MKV video.")
 length=request.headers.get("content-length")
 if length:
  try: declared=int(length)
  except ValueError: raise HTTPException(400,detail="Invalid upload content length.")
  if declared>MAX_UPLOAD_BYTES: raise HTTPException(413,detail=f"Video uploads are limited to {MAX_UPLOAD_BYTES//(1024*1024)} MiB.")
 with LOCK:
  if sum(1 for j in JOBS.values() if j["status"] in {"uploading","queued","downloading","transcribing","rendering"})>=2:
   raise HTTPException(429,detail="The free worker is busy. Wait for the current job to finish.")
  jid=uuid.uuid4().hex
  JOBS[jid]={"id":jid,"status":"uploading","message":"Receiving uploaded video…","clips":[]}
 work=INBOX/jid
 try:
  work.mkdir(parents=True,exist_ok=False)
  src=work/("upload"+suffix)
  total=0
  with src.open("wb") as target:
   async for chunk in request.stream():
    if not chunk: continue
    total+=len(chunk)
    if total>MAX_UPLOAD_BYTES: raise HTTPException(413,detail=f"Video uploads are limited to {MAX_UPLOAD_BYTES//(1024*1024)} MiB.")
    target.write(chunk)
  if total<=0: raise HTTPException(400,detail="The uploaded video is empty.")
  with LOCK: JOBS[jid].update(status="queued",message="Upload received. Video queued for transcription and editing.")
  POOL.submit(process,jid,src.as_uri())
  return {"jobId":jid,"status":"queued","message":"Upload received. Video queued for transcription and editing."}
 except HTTPException:
  with LOCK: JOBS.pop(jid,None)
  shutil.rmtree(work,ignore_errors=True)
  raise
 except Exception:
  with LOCK: JOBS.pop(jid,None)
  shutil.rmtree(work,ignore_errors=True)
  raise HTTPException(500,detail="Could not receive the uploaded video.")

@app.get("/health")
def health(): return {"ok":True,"service":"rapigents-free-clip-worker","engine":"yt-dlp + FFmpeg + faster-whisper"}
@app.post("/jobs",status_code=202)
def create(payload:JobRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 try: url=validate(str(payload.url))
 except ValueError as e: raise HTTPException(400,detail=str(e))
 with LOCK:
  if sum(1 for j in JOBS.values() if j["status"] in {"uploading","queued","downloading","transcribing","rendering"})>=2: raise HTTPException(429,detail="Free worker is busy. Wait for the current job to finish.")
  jid=uuid.uuid4().hex; JOBS[jid]={"id":jid,"status":"queued","message":"Job queued.","clips":[]}
 POOL.submit(process,jid,url); return {"jobId":jid,"status":"queued","message":"Video queued for local transcription and clip rendering."}
@app.get("/jobs/{jid}")
def status(jid:str,authorization:str|None=Header(default=None)):
 auth(authorization)
 if not re.fullmatch(r"[a-f0-9]{32}",jid): raise HTTPException(400,detail="Invalid job ID.")
 with LOCK:
  if jid not in JOBS: raise HTTPException(404,detail="Job not found. A worker restart clears the in-memory job list.")
  return dict(JOBS[jid])
