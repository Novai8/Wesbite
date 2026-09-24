let enabled = false;
let ctx: AudioContext | null = null;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function isSoundEnabled() {
  return enabled;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") {
    ctx = new Ctor();
  }
  return ctx;
}

/** Soft, short bubble click. Never throws if audio is blocked. */
export function playClick() {
  if (!enabled || typeof window === "undefined") return;
  try {
    const audio = getAudioContext();
    if (!audio) return;
    if (audio.state === "suspended") {
      void audio.resume().catch(() => {});
    }

    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.22, now);
    master.connect(audio.destination);

    const tone = audio.createOscillator();
    const toneGain = audio.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(640, now);
    tone.frequency.exponentialRampToValueAtTime(190, now + 0.1);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.08, now + 0.012);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    tone.connect(toneGain);
    toneGain.connect(master);
    tone.start(now);
    tone.stop(now + 0.14);

    const bubble = audio.createOscillator();
    const bubbleGain = audio.createGain();
    bubble.type = "sine";
    bubble.frequency.setValueAtTime(980, now);
    bubble.frequency.exponentialRampToValueAtTime(260, now + 0.07);
    bubbleGain.gain.setValueAtTime(0.0001, now);
    bubbleGain.gain.exponentialRampToValueAtTime(0.035, now + 0.008);
    bubbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    bubble.connect(bubbleGain);
    bubbleGain.connect(master);
    bubble.start(now);
    bubble.stop(now + 0.1);
  } catch {
    // Autoplay policies or a missing AudioContext should never surface as errors.
  }
}
