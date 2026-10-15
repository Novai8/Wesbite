"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Check, Clapperboard, Download, FileVideo, LoaderCircle, Scissors, Upload, WandSparkles } from "lucide-react";

type Caption = { start: number; end: number; text: string };
type Clip = { start: number; end: number; title: string; hook: string; captions: Caption[] };
const MAX_BYTES = 10 * 1024 * 1024;

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(safe / 60).toString().padStart(2, "0") + ":" + (safe % 60).toString().padStart(2, "0");
}
function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this video."));
    reader.onerror = () => reject(new Error("Could not read this video."));
    reader.readAsDataURL(file);
  });
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

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);

  const chooseFile = (next: File | null) => {
    setError(""); setClips([]); setOutputUrl(""); setOutputName(""); setDuration(0); setProgress(0);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    if (!next) { setFile(null); setFileUrl(""); return; }
    if (!next.type.startsWith("video/")) { setError("Choose a video file such as MP4 or WebM."); return; }
    if (next.size > MAX_BYTES) { setError("For this first version, choose a video under 10 MB. Larger uploads need a dedicated media-processing server."); return; }
    setFile(next); setFileUrl(URL.createObjectURL(next));
  };

  const analyze = async () => {
    if (!file || !videoRef.current) { setError("Upload a video first."); return; }
    if (duration > 180) { setError("The first version supports videos up to 3 minutes long."); return; }
    setBusy(true); setError(""); setClips([]); setOutputUrl("");
    try {
      const videoData = await readAsDataUrl(file);
      const response = await fetch("/api/clip-ai/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: videoData, mimeType: file.type, duration }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Clip analysis failed. Try a shorter video.");
      if (!Array.isArray(payload.clips) || !payload.clips.length) throw new Error("No usable moments were found in this video. Try another clip.");
      setClips(payload.clips); setSelected(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not analyze this video.");
    } finally { setBusy(false); }
  };

  const renderClip = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const clip = clips[selected];
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
      setOutputUrl(url); setOutputName((file.name.replace(/\.[^.]+$/, "") || "rapigents-clip") + "-" + formatTime(clip.start).replace(":", "-") + ".webm");
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not render this clip.");
    } finally { setRendering(false); if (video) video.pause(); }
  };

  return <section className="clip-workbench" id="clip-workbench">
    <div className="clip-workbench-shell">
      <div className="clip-workbench-heading"><div><span className="clip-workbench-kicker"><WandSparkles size={14}/> CLIP AI / WORKBENCH</span><h2>Make your first <em>short.</em></h2><p>Upload a short source video, let AI suggest the strongest moments, then render a vertical clip with captions. The source stays in this browser except for the analysis request.</p></div><span className="clip-workbench-version">MVP / 01</span></div>
      <div className="clip-workbench-grid">
        <div className="clip-source-panel">
          <label className="clip-upload-zone" htmlFor="clip-source-file">
            <span className="clip-upload-icon"><Upload size={22}/></span><strong>{file ? file.name : "Drop your video into the edit"}</strong><span>{file ? (file.size / (1024 * 1024)).toFixed(1) + " MB · " + formatTime(duration) : "MP4 or WebM · up to 10 MB · 3 minutes"}</span><span className="clip-upload-cta"><FileVideo size={15}/> {file ? "Choose another video" : "Choose video"}</span>
          </label>
          <input id="clip-source-file" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="clip-file-input" onChange={event => chooseFile(event.target.files?.[0] || null)}/>
          {fileUrl && <video ref={videoRef} className="clip-source-video" src={fileUrl} controls playsInline onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} />}
          {!fileUrl && <div className="clip-empty-preview"><Clapperboard size={34}/><span>YOUR SOURCE VIDEO</span><small>Upload a video to begin</small></div>}
          <div className="clip-source-foot"><span><Check size={13}/> No account needed</span><span>Local preview + export</span></div>
          <button className="clip-analyze-button" type="button" onClick={analyze} disabled={!file || busy || duration <= 0 || duration > 180}>{busy ? <><LoaderCircle className="clip-spin" size={17}/> Finding the best moments…</> : <><WandSparkles size={17}/> Find my best clips <span>↗</span></>}</button>
          {busy && <div className="clip-analysis-note">Sending this video for multimodal analysis. Free-model availability can vary.</div>}
        </div>
        <div className="clip-results-panel">
          <div className="clip-results-top"><span><Scissors size={15}/> HIGHLIGHT PICKS</span><span>{clips.length ? String(clips.length).padStart(2, "0") + " FOUND" : "AWAITING SOURCE"}</span></div>
          {clips.length ? <div className="clip-picks">{clips.map((clip, index) => <button type="button" key={clip.start + "-" + index} className={"clip-pick" + (selected === index ? " is-selected" : "")} onClick={() => { setSelected(index); setOutputUrl(""); }}><span className="clip-pick-time">{formatTime(clip.start)} – {formatTime(clip.end)}</span><strong>{clip.title}</strong><span>{clip.hook}</span><span className="clip-pick-select">{selected === index ? <><Check size={13}/> SELECTED</> : "SELECT CLIP ↗"}</span></button>)}</div> : <div className="clip-results-empty"><div className="clip-sound-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><strong>Your edit starts here.</strong><p>Clip AI will look for clear hooks, useful moments, and complete thoughts, then suggest a few short segments.</p></div>}
          {clips.length > 0 && <div className="clip-render-card"><div><span className="clip-workbench-kicker"><Captions size={13}/> CAPTIONED VERTICAL CUT</span><strong>{clips[selected]?.title}</strong><p>9:16 crop · original audio · AI-selected captions</p></div><button type="button" className="clip-render-button" onClick={renderClip} disabled={rendering}>{rendering ? <><LoaderCircle size={15} className="clip-spin"/> Rendering {progress}%</> : <><Clapperboard size={15}/> Render short</>}</button>{rendering && <div className="clip-render-progress"><i style={{width: progress + "%"}}/></div>}</div>}
          {outputUrl && <div className="clip-download-card"><video src={outputUrl} controls playsInline/><div><div><Check size={15}/> YOUR CLIP IS READY</div><a href={outputUrl} download={outputName}><Download size={15}/> Download WebM <span>↗</span></a></div></div>}
        </div>
      </div>
      {error && <div className="clip-workbench-error" role="alert">{error}</div>}
      <p className="clip-workbench-disclaimer">MVP limits: uploads up to 10 MB and 3 minutes; exports WebM in supported desktop browsers. AI-generated cut points and captions are suggestions, so preview the result before publishing.</p>
      <canvas ref={canvasRef} className="clip-render-canvas" aria-hidden="true"/>
    </div>
  </section>;
}
