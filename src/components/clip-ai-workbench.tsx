"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Captions, Check, CheckCircle2, Clapperboard, Download, FileVideo, LoaderCircle, Scissors, Upload, WandSparkles } from "lucide-react";

type Caption = { start: number; end: number; text: string };
type Clip = { start: number; end: number; title: string; hook: string; captions: Caption[] };
type RemoteClip = { id: string; title: string; url: string; thumbnail?: string; hook?: string; start?: number; end?: number; potentialScore?: number; reachOutlook?: string; effects?: string[] };
type ClipStage = "queued" | "downloading" | "transcribing" | "rendering" | "completed" | "failed";
type EditStyle = "punchy" | "cinematic" | "clean";
const editStyles = [
  { id: "punchy", label: "Punchy", description: "Bold hooks, vivid captions, lively motion." },
  { id: "cinematic", label: "Cinematic", description: "Softer color, gentle zoom, film-like fades." },
  { id: "clean", label: "Clean", description: "Steady framing, clear captions, subtle effects." },
] as const;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SECONDS = 10 * 60;

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(safe / 60).toString().padStart(2, "0") + ":" + (safe % 60).toString().padStart(2, "0");
}

export function ClipAIWorkbench() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("");
  const [sourceLink, setSourceLink] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkStatus, setLinkStatus] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkProjectId, setLinkProjectId] = useState("");
  const [linkStage, setLinkStage] = useState<ClipStage>("queued");
  const [remoteClips, setRemoteClips] = useState<RemoteClip[]>([]);
  const [editStyle, setEditStyle] = useState<EditStyle>("punchy");

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);

  const chooseFile = (next: File | null) => {
    setError(""); setClips([]); setOutputUrl(""); setOutputName(""); setDuration(0); setProgress(0);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setFile(null); setFileUrl("");
    if (!next) return;
    if (!next.type.startsWith("video/")) { setError("Choose a video file such as MP4 or WebM."); return; }
    if (next.size > MAX_BYTES) { setError("For this first version, choose a video under 25 MB. Larger files are not supported yet."); return; }
    setFile(next); setFileUrl(URL.createObjectURL(next));
  };

  const analyze = async () => {
    if (!file || !videoRef.current) { setError("Upload a video first."); return; }
    if (duration > MAX_DURATION_SECONDS) { setError("This version supports uploaded videos up to 10 minutes long. Try a shorter source."); return; }
    setBusy(true); setError(""); setClips([]); setOutputUrl("");
    setLinkError(""); setLinkStatus(""); setRemoteClips([]); setLinkProjectId(""); setLinkStage("queued");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("style", editStyle);
      const response = await fetch("/api/clip-ai/upload", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Video upload failed. Try a smaller file.");
      const projectId = String(payload.projectId || "");
      if (!projectId) throw new Error("We could not start this edit. Please try again.");
      setLinkProjectId(projectId);
      setLinkStage((payload.status as ClipStage) || "queued");
      setLinkStatus(payload.message || "Upload received. Preparing your clips.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload this video to Clip AI.");
    } finally { setBusy(false); }
  };

  const submitSourceLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkError(""); setLinkStatus(""); setRemoteClips([]); setLinkProjectId(""); setLinkStage("queued");
    const url = sourceLink.trim();
    if (!/^https?:\/\//i.test(url)) { setLinkError("Paste a complete https:// video or supported platform link."); return; }
    setLinkBusy(true); setLinkStage("queued"); setLinkStatus("Preparing your edit…");
    try {
      const response = await fetch("/api/clip-ai/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, style: editStyle }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "This source could not be submitted.");
      setLinkProjectId(String(payload.projectId || ""));
      setLinkStage((payload.status as ClipStage) || "queued");
      setLinkStatus(payload.message || "Your video is queued for editing.");
    } catch (caught) {
      setLinkError(caught instanceof Error ? caught.message : "Could not submit this link.");
      setLinkStatus("");
    } finally { setLinkBusy(false); }
  };

  const refreshRemoteClips = useCallback(async () => {
    if (!linkProjectId) return;
    setLinkBusy(true); setLinkError("");
    try {
      const response = await fetch("/api/clip-ai/import?projectId=" + encodeURIComponent(linkProjectId), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not check the processing status.");
      setLinkStage((payload.status as ClipStage) || "queued");
      if (payload.status === "failed") { setLinkProjectId(""); throw new Error(payload.message || "We could not finish this edit. Try a different public video link or a shorter source."); }
      const items = Array.isArray(payload.clips) ? payload.clips : [];
      setRemoteClips(items);
      setLinkStatus(items.length ? "Your clips are ready. Preview or download each edit below." : (payload.message || "Finding the strongest moments and building your edits…"));
      if (payload.status === "completed") setLinkProjectId("");
    } catch (caught) {
      setLinkError(caught instanceof Error ? caught.message : "Could not check clip status.");
    } finally { setLinkBusy(false); }
  }, [linkProjectId]);

  useEffect(() => {
    if (!linkProjectId || remoteClips.length) return;
    const timer = window.setInterval(() => { void refreshRemoteClips(); }, 5000);
    return () => window.clearInterval(timer);
  }, [linkProjectId, remoteClips.length, refreshRemoteClips]);

  const renderClip = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const clip = clips[selected];
    const sourceName = file?.name || "rapigents-clip";
    if (!video || !canvas || !clip) return;
    const capture = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };
    const captureVideo = capture.captureStream || capture.mozCaptureStream;
    if (!captureVideo || !canvas.captureStream || typeof MediaRecorder === "undefined") {
      setError("This browser cannot export a clip from the preview. Use a recent version of Chrome or Edge.");
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(""); setError(""); setRendering(true); setProgress(0);
    const context = canvas.getContext("2d");
    if (!context) { setRendering(false); setError("Canvas rendering is unavailable in this browser."); return; }
    canvas.width = 720; canvas.height = 1280;
    try {
      video.pause();
      if (Math.abs(video.currentTime - clip.start) > 0.1) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => { video.removeEventListener("seeked", ready); reject(new Error("Video seeking took too long. Try again.")); }, 8000);
          const ready = () => { window.clearTimeout(timer); resolve(); };
          video.addEventListener("seeked", ready, { once: true });
          video.currentTime = clip.start;
        });
      }
      const canvasStream = canvas.captureStream(30);
      const sourceStream = captureVideo.call(video);
      sourceStream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(type => MediaRecorder.isTypeSupported(type)) || "";
      if (!mimeType) throw new Error("This browser does not support WebM video export.");
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 4_500_000 });
      const chunks: BlobPart[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("The browser could not finish rendering this clip."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      const draw = () => {
        const w = canvas.width, h = canvas.height;
        context.fillStyle = "#08090d"; context.fillRect(0, 0, w, h);
        const sourceW = video.videoWidth || w, sourceH = video.videoHeight || h;
        const scale = Math.max(w / sourceW, h / sourceH);
        const cropW = w / scale, cropH = h / scale;
        const sx = (sourceW - cropW) / 2, sy = (sourceH - cropH) / 2;
        context.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h);
        const gradient = context.createLinearGradient(0, h * 0.48, 0, h);
        gradient.addColorStop(0, "rgba(5,7,12,0)"); gradient.addColorStop(1, "rgba(5,7,12,.94)");
        context.fillStyle = gradient; context.fillRect(0, 0, w, h);
        const now = video.currentTime;
        const caption = clip.captions.find(item => now >= item.start && now <= item.end);
        if (caption?.text) {
          context.font = "900 43px Arial, sans-serif";
          const words = caption.text.trim().split(/\s+/);
          const lines: string[] = [];
          let line = "";
          for (const word of words) {
            const test = line ? line + " " + word : word;
            if (context.measureText(test).width > w * 0.78 && line) { lines.push(line); line = word; } else line = test;
          }
          if (line) lines.push(line);
          context.textAlign = "center"; context.textBaseline = "middle";
          const baseY = h * 0.79 - (lines.length - 1) * 26;
          lines.forEach((text, index) => {
            context.lineWidth = 7; context.lineJoin = "round"; context.strokeStyle = "rgba(0,0,0,.8)";
            context.strokeText(text.toUpperCase(), w / 2, baseY + index * 54, w * 0.86);
            context.fillStyle = index === lines.length - 1 ? "#d8ff63" : "#ffffff";
            context.fillText(text.toUpperCase(), w / 2, baseY + index * 54, w * 0.86);
          });
        }
        context.textAlign = "left"; context.font = "700 14px Arial, sans-serif"; context.fillStyle = "rgba(255,255,255,.82)";
        context.fillText("RAPIGENTS  /  CLIP AI", 28, 46);
        const elapsed = Math.max(0, now - clip.start);
        setProgress(Math.min(99, Math.round(elapsed / Math.max(1, clip.end - clip.start) * 100)));
        if (now >= clip.end || video.ended) { video.pause(); if (recorder.state !== "inactive") recorder.stop(); return; }
        requestAnimationFrame(draw);
      };
      recorder.start(250);
      await video.play();
      requestAnimationFrame(draw);
      const blob = await finished;
      canvasStream.getTracks().forEach(track => track.stop());
      sourceStream.getTracks().forEach(track => { if (track.kind !== "audio") track.stop(); });
      if (blob.size < 1000) throw new Error("The rendered file was empty. Try exporting again.");
      const url = URL.createObjectURL(blob);
      setOutputUrl(url); setOutputName((sourceName.replace(/\.[^.]+$/, "") || "rapigents-clip") + "-" + formatTime(clip.start).replace(":", "-") + ".webm");
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not render this clip.");
    } finally { setRendering(false); if (video) video.pause(); }
  };

  return <section className="clip-workbench" id="clip-workbench">
    <div className="clip-workbench-shell">
      <div className="clip-workbench-heading"><div><span className="clip-workbench-kicker"><WandSparkles size={14}/> CLIP AI / WORKBENCH</span><h2>Make your first <em>short.</em></h2><p>Drop in a video or paste a link. Clip AI finds concise highlights and turns them into vertical edits with animated captions, motion, and sound.</p></div><span className="clip-workbench-version">CREATOR STUDIO</span></div>
      <div className="clip-style-picker">
        <div className="clip-style-heading"><span className="clip-workbench-kicker">EDIT STYLE</span><strong>Choose the finish</strong></div>
        <div className="clip-style-options" role="group" aria-label="Choose an edit style">
          {editStyles.map((style) => <button key={style.id} type="button" className={"clip-style-option"+(editStyle===style.id?" is-selected":"")} aria-pressed={editStyle===style.id} onClick={() => setEditStyle(style.id)}>
            <span className="clip-style-option-top"><strong>{style.label}</strong>{editStyle===style.id ? <CheckCircle2 size={15}/> : <span className="clip-style-mark" />}</span>
            <span className="clip-style-option-description">{style.description}</span>
          </button>)}
        </div>
      </div>
      <form className="clip-link-import" onSubmit={submitSourceLink}>
        <div className="clip-link-copy"><span className="clip-workbench-kicker"><WandSparkles size={13}/> PASTE A VIDEO LINK</span><strong>Or paste a public video link</strong><p>Paste a public video link and Clip AI will find the strongest moments, style the captions, and prepare vertical clips. Your results appear here when they are ready.</p></div>
        <div className="clip-link-controls"><input aria-label="Public video URL" type="url" inputMode="url" autoComplete="url" placeholder="https://www.youtube.com/watch?v=…" value={sourceLink} onChange={event => setSourceLink(event.target.value)} disabled={linkBusy} required /><button type="submit" disabled={linkBusy || !sourceLink.trim()}>{linkBusy ? <><LoaderCircle size={15} className="clip-spin"/> Working…</> : <>Find clips <WandSparkles size={15}/></>}</button></div>
        {linkStatus && <p className="clip-link-status" role="status">{linkStatus}</p>}
        {linkProjectId && !remoteClips.length && !linkError && <div className="clip-job-progress" role="status" aria-live="polite">
          <div className="clip-job-progress-head"><span><span className="clip-job-live-dot" /> EDIT IN PROGRESS</span><strong>{linkBusy ? "UPDATING" : linkStage === "queued" ? "PREPARING" : linkStage === "downloading" ? "READING SOURCE" : linkStage === "transcribing" ? "FINDING MOMENTS" : linkStage === "rendering" ? "FINISHING EDIT" : linkStage === "completed" ? "READY" : "CHECKING"}</strong></div>
          <div className="clip-job-stages">
            {([{id:"downloading",label:"Read the source",detail:"Preparing the video",icon:Download},{id:"transcribing",label:"Find the moments",detail:"Looking for the story",icon:AudioLines},{id:"rendering",label:"Finish the edit",detail:"Captions, framing & motion",icon:WandSparkles}] as const).map((stage)=>{
              const order: ClipStage[] = ["queued","downloading","transcribing","rendering","completed"];
              const current = order.indexOf(linkStage), stageIndex = order.indexOf(stage.id);
              const active = linkStage === stage.id, done = linkStage === "completed" || (current > stageIndex && linkStage !== "failed");
              const Icon = done ? CheckCircle2 : stage.icon;
              return <div key={stage.id} className={"clip-job-stage"+(active?" is-active":"")+(done?" is-done":"")}>
                <span className="clip-job-stage-icon"><Icon size={17}/>{active && <i />}</span>
                <span className="clip-job-stage-copy"><strong>{stage.label}</strong><small>{stage.detail}</small></span>
                <span className="clip-job-stage-state">{done ? "DONE" : active ? "WORKING" : "WAITING"}</span>
              </div>;
            })}
          </div>
          <div className="clip-job-progress-foot"><span className="clip-job-pulse-bars"><i/><i/><i/><i/><i/></span><span>This can take a few minutes, depending on the length of your video.</span></div>
        </div>}
        {linkError && <p className="clip-link-error" role="alert">{linkError}</p>}
        {remoteClips.length > 0 && <div className="clip-link-results-wrap">
          <div className="clip-link-results-heading"><div><span className="clip-workbench-kicker"><CheckCircle2 size={14}/> EDITING COMPLETE</span><h3>Your clips, ranked by hook potential.</h3><p>Scores are editing suggestions, not predictions of views or guaranteed reach.</p></div><span className="clip-link-results-count">{String(remoteClips.length).padStart(2,"0")} CLIPS</span></div>
          <div className="clip-link-results">{remoteClips.map((clip,index)=>{
            const score = typeof clip.potentialScore === "number" ? clip.potentialScore : null;
            const outlook = clip.reachOutlook || (score !== null && score >= 75 ? "Strong signals" : score !== null && score >= 58 ? "Promising" : "Niche fit");
            return <article key={clip.id||clip.url} className="clip-link-result">
              <div className="clip-link-result-preview"><video src={clip.url} controls playsInline preload="metadata" aria-label={"Preview of clip "+(index+1)} /><span>CLIP {String(index+1).padStart(2,"0")}</span></div>
              <div className="clip-link-result-body">
                <div className="clip-link-result-meta"><span>{typeof clip.start==="number"&&typeof clip.end==="number"?formatTime(clip.start)+"–"+formatTime(clip.end):"HIGHLIGHT"}</span><span>9:16 · CAPTIONED</span></div>
                <strong>{clip.title}</strong><p>{clip.hook||"A selected highlight with captions."}</p>
                <div className="clip-link-metrics">
                  <div className="clip-link-metric-score"><span>VIRALITY POTENTIAL</span><strong>{score === null ? "—" : score}<small>{score === null ? "" : "/100"}</small></strong><div><i style={{width:(score === null ? 0 : Math.max(0,Math.min(100,score)))+"%"}}/></div></div>
                  <div className="clip-link-metric-reach"><span>REACH OUTLOOK</span><strong>{outlook}</strong><small>Relative signal estimate</small></div>
                </div>
                {clip.effects?.length ? <div className="clip-link-effects">{clip.effects.map(effect=><span key={effect}>{effect}</span>)}</div> : null}
                <a href={clip.url} target="_blank" rel="noreferrer" download><Download size={14}/> Download clip <span>↗</span></a>
              </div>
            </article>;
          })}</div>
        </div>}
      </form>
      <div className="clip-workbench-grid">
        <div className="clip-source-panel">
          <label className="clip-upload-zone" htmlFor="clip-source-file">
            <span className="clip-upload-icon"><Upload size={22}/></span><strong>{file ? file.name : "Drop your video into the edit"}</strong><span>{file ? (file.size / (1024 * 1024)).toFixed(1) + " MB · " + formatTime(duration) : "MP4 or WebM · up to 25 MB · 10 minutes max"}</span><span className="clip-upload-cta"><FileVideo size={15}/> {file ? "Choose another video" : "Choose video"}</span>
          </label>
          <input id="clip-source-file" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="clip-file-input" onChange={event => chooseFile(event.target.files?.[0] || null)}/>
          {fileUrl && <video ref={videoRef} className="clip-source-video" src={fileUrl} controls playsInline onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} />}
          {!fileUrl && <div className="clip-empty-preview"><Clapperboard size={34}/><span>YOUR SOURCE VIDEO</span><small>Upload a video to begin</small></div>}
          <div className="clip-source-foot"><span><Check size={13}/> Ready to edit</span><span>Vertical video output</span></div>
          <button className="clip-analyze-button" type="button" onClick={analyze} disabled={!file || busy || duration <= 0 || duration > MAX_DURATION_SECONDS}>{busy ? <><LoaderCircle className="clip-spin" size={17}/> Finding the best moments…</> : <><WandSparkles size={17}/> Upload & create clips <span>↗</span></>}</button>
          {busy && <div className="clip-analysis-note">Your video is being prepared. Keep this page open to follow the progress.</div>}
        </div>
        <div className="clip-results-panel">
          <div className="clip-results-top"><span><Scissors size={15}/> HIGHLIGHT PICKS</span><span>{clips.length ? String(clips.length).padStart(2, "0") + " FOUND" : "AWAITING SOURCE"}</span></div>
          {clips.length ? <div className="clip-picks">{clips.map((clip, index) => <button type="button" key={clip.start + "-" + index} className={"clip-pick" + (selected === index ? " is-selected" : "")} onClick={() => { setSelected(index); setOutputUrl(""); }}><span className="clip-pick-time">{formatTime(clip.start)} – {formatTime(clip.end)}</span><strong>{clip.title}</strong><span>{clip.hook}</span><span className="clip-pick-select">{selected === index ? <><Check size={13}/> SELECTED</> : "SELECT CLIP ↗"}</span></button>)}</div> : <div className="clip-results-empty"><div className="clip-sound-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><strong>Your edit starts here.</strong><p>Clip AI will look for clear hooks, useful moments, and complete thoughts, then suggest a few short segments.</p></div>}
          {clips.length > 0 && <div className="clip-render-card"><div><span className="clip-workbench-kicker"><Captions size={13}/> CAPTIONED VERTICAL CUT</span><strong>{clips[selected]?.title}</strong><p>9:16 crop · original audio · AI-selected captions</p></div><button type="button" className="clip-render-button" onClick={renderClip} disabled={rendering}>{rendering ? <><LoaderCircle size={15} className="clip-spin"/> Rendering {progress}%</> : <><Clapperboard size={15}/> Render short</>}</button>{rendering && <div className="clip-render-progress"><i style={{width: progress + "%"}}/></div>}</div>}
          {outputUrl && <div className="clip-download-card"><video src={outputUrl} controls playsInline/><div><div><Check size={15}/> YOUR CLIP IS READY</div><a href={outputUrl} download={outputName}><Download size={15}/> Download WebM <span>↗</span></a></div></div>}
        </div>
      </div>
      {error && <div className="clip-workbench-error" role="alert">{error}</div>}
      <p className="clip-workbench-disclaimer">Short uploads support files up to 25 MB and 10 minutes. Link availability depends on the source platform. Only process videos you have permission to use.</p>
      <canvas ref={canvasRef} className="clip-render-canvas" aria-hidden="true"/>
    </div>
  </section>;
}
