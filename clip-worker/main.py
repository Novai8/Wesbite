import ipaddress, os, re, shutil, socket, subprocess, threading, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote, urlparse
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
from faster_whisper import WhisperModel

ROOT=Path(os.getenv("CLIP_DATA_DIR","/data")).resolve(); INBOX=ROOT/"inbox"; OUT=ROOT/"outputs"
for p in (INBOX,OUT): p.mkdir(parents=True,exist_ok=True)
TOKEN=os.getenv("CLIP_WORKER_TOKEN",""); PUBLIC=os.getenv("CLIP_WORKER_PUBLIC_URL","").rstrip("/")
MAX_SECONDS=int(os.getenv("MAX_SOURCE_SECONDS","1800")); MAX_BYTES=int(os.getenv("MAX_DOWNLOAD_BYTES",str(750*1024*1024)))
MAX_UPLOAD_BYTES=min(MAX_BYTES,int(os.getenv("MAX_UPLOAD_BYTES",str(10*1024*1024))))
MODEL_NAME=os.getenv("WHISPER_MODEL","small"); POOL=ThreadPoolExecutor(max_workers=1); LOCK=threading.Lock(); MODEL_LOCK=threading.Lock(); JOBS={}; MODEL=None
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
def model():
 global MODEL
 with MODEL_LOCK:
  if MODEL is None: MODEL=WhisperModel(MODEL_NAME,device="cpu",compute_type="int8")
  return MODEL
def stamp(sec):
 ms=max(0,int(sec*1000)); h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
 return f"{h:02}:{m:02}:{s:02},{ms:03}"
def picks(transcript,duration):
 chunks=[{"start":float(s.start),"end":float(s.end),"text":re.sub(r"\s+"," ",s.text).strip()} for s in transcript if s.text.strip()]
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
    windows.append({"start":start,"end":end,"title":title,"hook":words[:220],"score":score,"segments":selected})
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
   with LOCK: JOBS[jid].update(status="downloading",message="Downloading source with yt-dlp…")
   cmd(["yt-dlp","--no-playlist","--no-warnings","--max-filesize",str(MAX_BYTES),"--match-filter",f"duration <= {MAX_SECONDS}","-f","bv*[height<=1080]+ba/b[height<=1080]/b","--merge-output-format","mp4","-o",str(work/"source.%(ext)s"),url],900)
   files=[p for p in work.glob("source.*") if p.is_file() and p.stat().st_size]
   if not files: raise RuntimeError("No source downloaded. It may be private, restricted, unsupported, or too large.")
   src=max(files,key=lambda p:p.stat().st_size)
   if src.stat().st_size>MAX_BYTES: raise RuntimeError("Source exceeds worker download-size limit.")
  duration=float(cmd(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(src)]))
  if duration<=0 or duration>MAX_SECONDS: raise RuntimeError(f"Source must be under {MAX_SECONDS//60} minutes.")
  with LOCK: JOBS[jid].update(status="transcribing",message="Transcribing speech locally with faster-whisper…")
  m=model(); segments,info=m.transcribe(str(src),vad_filter=True,word_timestamps=False,beam_size=3); selections=picks(list(segments),duration)
  with LOCK: JOBS[jid].update(status="rendering",message="Editing clips: smart zoom, hook titles, colored captions, and subtle sound effects…")
  results=[]
  for n,pick in enumerate(selections,1):
   start,end=pick["start"],pick["end"]; cid=f"{jid}-{n}"; ass=work/f"{cid}.ass"; sfx=work/f"{cid}-sfx.wav"; name=f"{cid}.mp4"; out=OUT/name
   header="""[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,DejaVu Sans,52,&H00FFFFFF,&H0000FFFF,&HCC08090D,&H6608090D,-1,0,0,0,100,100,0,0,1,4,1,2,52,52,210,1
Style: Hook,DejaVu Sans,58,&H0087F5FF,&H0000FFFF,&HDD08090D,&H9908090D,-1,0,0,0,100,100,0,0,1,5,2,8,54,54,145,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
   events=[]
   events.append(f"Dialogue: 1,0:00:00.00,0:00:02.60,Hook,,0,0,0,,{{\\fad(180,220)\\an8}}{ass_escape(pick['title'].upper())}")
   colors=["&H0087F5FF","&H00FF91C8","&H00FFFFFF","&H008BFF9B"]
   for i,seg in enumerate(pick["segments"]):
    a=max(0.0,float(seg["start"])-start); b=max(a+0.18,min(end-start,float(seg["end"])-start))
    caption=ass_escape(seg["text"].replace("-->","→"))
    if not caption: continue
    events.append(f"Dialogue: 0,{ass_stamp(a)},{ass_stamp(b)},Caption,,0,0,0,,{{\\fad(70,90)\\c{colors[i%len(colors)]}}}{caption.upper()}")
   ass.write_text(header+"\n".join(events)+"\n",encoding="utf-8")
   cmd(["ffmpeg","-y","-f","lavfi","-i","anoisesrc=color=pink:duration=0.55:sample_rate=48000","-af","highpass=f=700,lowpass=f=6500,afade=t=in:st=0:d=0.08,afade=t=out:st=0.16:d=0.38,volume=0.08","-ac","2",str(sfx)],60)
   ass_path=str(ass).replace("\\\\","/").replace(":","\\\\:")
   vf=f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.0007,1.08)':d=1:s=720x1280:fps=30,ass='{ass_path}'"
   cmd(["ffmpeg","-y","-ss",str(start),"-i",str(src),"-i",str(sfx),"-t",str(end-start),"-filter_complex",f"[0:a]volume=1.0[original];[1:a]adelay=120|120[effect];[original][effect]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]","-vf",vf,"-map","0:v:0","-map","[aout]","-c:v","libx264","-preset","veryfast","-crf","24","-c:a","aac","-b:a","128k","-pix_fmt","yuv420p","-movflags","+faststart",str(out)],600)
   potential=min(98,max(35,round(pick["score"])))
   outlook="Strong signals" if potential>=75 else "Promising" if potential>=58 else "Niche fit"
   results.append({"id":cid,"title":pick["title"],"hook":pick["hook"],"start":round(start,2),"end":round(end,2),"potentialScore":potential,"reachOutlook":outlook,"effects":["subtle zoom-in","opening hook title","multicolor captions","soft whoosh sound effect"],"url":f"{PUBLIC}/media/{name}" if PUBLIC else f"/media/{name}"})
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
