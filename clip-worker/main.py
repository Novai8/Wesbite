import ipaddress, os, re, shutil, socket, subprocess, threading, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
from faster_whisper import WhisperModel

ROOT=Path(os.getenv("CLIP_DATA_DIR","/data")).resolve(); INBOX=ROOT/"inbox"; OUT=ROOT/"outputs"
for p in (INBOX,OUT): p.mkdir(parents=True,exist_ok=True)
TOKEN=os.getenv("CLIP_WORKER_TOKEN",""); PUBLIC=os.getenv("CLIP_WORKER_PUBLIC_URL","").rstrip("/")
MAX_SECONDS=int(os.getenv("MAX_SOURCE_SECONDS","1800")); MAX_BYTES=int(os.getenv("MAX_DOWNLOAD_BYTES",str(750*1024*1024)))
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
 chunks=[{"start":float(s.start),"end":float(s.end),"text":re.sub(r"\\s+"," ",s.text).strip()} for s in transcript if s.text.strip()]
 if not chunks: raise RuntimeError("Speech recognition found no usable spoken content.")
 target=min(45.,max(18.,duration/5)); windows=[]; cursor=chunks[0]["start"]
 while cursor<duration and len(windows)<18:
  limit=min(duration,cursor+target); selected=[x for x in chunks if x["start"]<limit and x["end"]>cursor]
  if selected:
   start=max(0.,selected[0]["start"]); end=min(duration,selected[-1]["end"])
   words=" ".join(x["text"] for x in selected).strip(); tokens=re.findall(r"\\b[\\w']+\\b",words.lower())
   if end-start>=8 and len(tokens)>=12:
    title=re.split(r"(?<=[.!?])\\s+",words)[0][:90].strip(" .!?") or "Strong moment"
    # Fully local highlight ranking: speech density, a clean ending, and language
    # patterns common in explanations, questions, contrasts, and story payoffs.
    score=min(len(tokens),100)*0.55
    if re.search(r"[.!?][\"')]*$",words): score+=10
    if re.search(r"\\b(how to|why|here'?s|the reason|the truth|what happens|the biggest|the most|the problem|the secret|mistake|lesson|because|imagine|remember|first|finally)\\b",words,re.I): score+=12
    if "?" in words: score+=7
    if re.search(r"\\b(you|your|we|our)\\b",words,re.I): score+=4
    if re.search(r"\\b(but|however|instead|although|yet|except)\\b",words,re.I): score+=5
    if re.search(r"\\b\\d+(?:[.,]\\d+)?%?\\b",words): score+=3
    fillers=len(re.findall(r"\\b(um|uh|erm|you know|like)\\b",words,re.I))
    score-=min(fillers*2,10)
    windows.append({"start":start,"end":end,"title":title,"hook":words[:220],"score":score,"segments":selected})
  cursor+=max(12.,target*.65)
 windows.sort(key=lambda x:x["score"],reverse=True); unique=[]
 for x in windows:
  if all(abs(x["start"]-y["start"])>target*.55 for y in unique): unique.append(x)
 return unique[:5]

def process(jid,url):
 work=INBOX/jid; work.mkdir(parents=True,exist_ok=True)
 try:
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
  with LOCK: JOBS[jid].update(status="rendering",message="Rendering vertical clips with subtitles…")
  results=[]
  for n,pick in enumerate(selections,1):
   start,end=pick["start"],pick["end"]; cid=f"{jid}-{n}"; srt=work/f"{cid}.srt"; entries=[]
   for i,s in enumerate(pick["segments"],1):
    a=max(0,s["start"]-start); b=max(a+.15,min(end-start,s["end"]-start)); text=s["text"].replace("-->","→").replace("\n"," ")
    entries.append(f"{i}\n{stamp(a)} --> {stamp(b)}\n{text}\n")
   srt.write_text("\n".join(entries),encoding="utf-8"); name=f"{cid}.mp4"; out=OUT/name
   sub=str(srt).replace("\\","/").replace(":","\\:")
   vf=f"scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,subtitles='{sub}':force_style='FontName=DejaVu Sans,FontSize=18,Bold=1,Outline=2,Shadow=1,Alignment=2,MarginV=100'"
   cmd(["ffmpeg","-y","-ss",str(start),"-i",str(src),"-t",str(end-start),"-vf",vf,"-c:v","libx264","-preset","veryfast","-crf","24","-c:a","aac","-b:a","128k","-movflags","+faststart",str(out)],600)
   results.append({"id":cid,"title":pick["title"],"hook":pick["hook"],"start":round(start,2),"end":round(end,2),"url":f"{PUBLIC}/media/{name}" if PUBLIC else f"/media/{name}"})
  with LOCK: JOBS[jid].update(status="completed",message=f"Created {len(results)} clips.",clips=results,duration=duration,language=getattr(info,"language",None))
 except subprocess.TimeoutExpired:
  with LOCK: JOBS[jid].update(status="failed",message="Processing timed out. Try a shorter or lower-resolution source.")
 except Exception as e:
  with LOCK: JOBS[jid].update(status="failed",message=str(e)[:1200])
 finally: shutil.rmtree(work,ignore_errors=True)
@app.get("/health")
def health(): return {"ok":True,"service":"rapigents-free-clip-worker","engine":"yt-dlp + FFmpeg + faster-whisper"}
@app.post("/jobs",status_code=202)
def create(payload:JobRequest,authorization:str|None=Header(default=None)):
 auth(authorization)
 try: url=validate(str(payload.url))
 except ValueError as e: raise HTTPException(400,detail=str(e))
 with LOCK:
  if sum(1 for j in JOBS.values() if j["status"] in {"queued","downloading","transcribing","rendering"})>=2: raise HTTPException(429,detail="Free worker is busy. Wait for the current job to finish.")
  jid=uuid.uuid4().hex; JOBS[jid]={"id":jid,"status":"queued","message":"Job queued.","clips":[]}
 POOL.submit(process,jid,url); return {"jobId":jid,"status":"queued","message":"Video queued for local transcription and clip rendering."}
@app.get("/jobs/{jid}")
def status(jid:str,authorization:str|None=Header(default=None)):
 auth(authorization)
 if not re.fullmatch(r"[a-f0-9]{32}",jid): raise HTTPException(400,detail="Invalid job ID.")
 with LOCK:
  if jid not in JOBS: raise HTTPException(404,detail="Job not found. A worker restart clears the in-memory job list.")
  return dict(JOBS[jid])
