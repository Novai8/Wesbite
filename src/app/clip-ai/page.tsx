import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUpRight, Captions, Clapperboard, Film, Play, Scissors, Sparkles, WandSparkles, Waves, Zap } from "lucide-react";
import { ClipAIWorkbench } from "@/components/clip-ai-workbench";
import { InteractiveCard } from "@/components/interactive-card";
import { FloatingCardScene } from "@/components/floating-card-scene";

export const metadata: Metadata = {
  title: "Clip AI | Turn long videos into short-form edits",
  description: "Rapigents Clip AI accepts supported video links or uploads, finds strong short-form moments, and creates shareable clips.",
  openGraph: { title: "Clip AI by Rapigents", description: "From long video to short-form story.", url: "https://rapigents.com/clip-ai", siteName: "Rapigents", type: "website" },
};

const steps = [
  { n: "01", icon: Waves, title: "Upload your video", body: "Paste a supported video link or upload a video file, then let Clip AI find promising moments and adapt clip lengths to the source." },
  { n: "02", icon: Scissors, title: "Find the moments", body: "Identify strong hooks, useful moments, and clean cut points instead of chopping randomly." },
  { n: "03", icon: Captions, title: "Style the short", body: "Add readable animated captions, vertical framing, and pacing built for mobile viewing." },
];

export default function ClipAIPage() {
  return <main id="content" className="rg-clip-page">
    <section className="rg-clip-hero"><FloatingCardScene kind="clip" />
      <div className="rg-clip-grid" aria-hidden="true" />
      <div className="rg-clip-orb rg-clip-orb-a" aria-hidden="true" /><div className="rg-clip-orb rg-clip-orb-b" aria-hidden="true" />
      <div className="rg-clip-shell rg-clip-hero-layout">
        <div className="rg-clip-copy">
          <Link href="/" className="rg-clip-back"><ArrowLeft size={14}/> BACK TO TOOLBOX</Link>
          <div className="rg-clip-kicker"><span className="rg-clip-live-dot" /> A NEW KIND OF CREATOR TOOL <span> / 002</span></div>
          <h1>Long video.<br/><em>Short attention.</em><br/>Big moments.</h1>
          <p>Meet <strong>Clip AI</strong>: a smarter way to turn long videos into polished vertical shorts, with punchy cuts, crisp captions, and framing made for the feed.</p>
          <div className="rg-clip-actions"><a className="rg-clip-primary" href="#clip-workbench">Try Clip AI <ArrowUpRight size={17}/></a><a className="rg-clip-secondary" href="#how-it-works">See how it works <ArrowDown size={15}/></a></div>
          <div className="rg-clip-platforms"><span>VIDEO UPLOAD IN</span><i/><span>SMART EDIT</span><i/><span>VERTICAL SHORT OUT</span></div>
        </div>
        <div className="rg-clip-preview" aria-label="Illustration of a vertical short video editing preview">
          <div className="rg-clip-preview-top"><span><span className="rg-clip-live-dot"/> CLIP AI / PREVIEW</span><span>9:16</span></div>
          <div className="rg-clip-video">
            <div className="rg-clip-video-glow"/><div className="rg-clip-video-sun"/><div className="rg-clip-video-hill hill-one"/><div className="rg-clip-video-hill hill-two"/>
            <div className="rg-clip-frame-tag"><Play size={10} fill="currentColor"/> BEST MOMENT FOUND</div>
            <div className="rg-clip-captions"><span>MAKE EVERY</span><strong>SECOND</strong><span className="rg-clip-caption-accent">COUNT.</span></div>
            <div className="rg-clip-caption-progress"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
            <div className="rg-clip-video-watermark">YOUR STORY, CUT SHARPER</div>
          </div>
          <div className="rg-clip-timeline"><div className="rg-clip-timeline-head"><span><Film size={13}/> SMART TIMELINE</span><span>01:24 → 00:32</span></div><div className="rg-clip-timeline-track"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><div className="rg-clip-timeline-foot"><span>HOOK</span><span>HIGHLIGHT</span><span>PAYOFF</span></div></div>
          <div className="rg-clip-floating rg-clip-float-a"><Scissors size={15}/><span>SMART CUTS</span></div><div className="rg-clip-floating rg-clip-float-b"><Captions size={15}/><span>CAPTIONS ON</span></div>
          <span className="rg-clip-preview-note">VISUAL PREVIEW · CLIP AI</span>
        </div>
      </div>
      <div className="rg-clip-marquee" aria-hidden="true"><div>HOOK FIRST ✳ CLEAN CAPTIONS ✳ SMART CUTS ✳ MOBILE-FIRST ✳ YOUR BEST MOMENTS ✳ HOOK FIRST ✳ CLEAN CAPTIONS ✳ SMART CUTS ✳ MOBILE-FIRST ✳</div></div>
    </section>
    <ClipAIWorkbench />
    <section className="rg-clip-how" id="how-it-works"><div className="rg-clip-shell">
      <div className="rg-clip-section-head"><div><span className="rg-clip-kicker">THE EDITING FLOW</span><h2>From raw footage to<br/><em>“one more watch.”</em></h2></div><p>Good shorts need a hook, context, and payoff. Clip AI looks for moments that feel intentional, not random trims.</p></div>
      <div className="rg-clip-steps">{steps.map((step)=>{const Icon=step.icon;return <InteractiveCard className="rg-clip-step" key={step.n} label={step.title}><div className="rg-clip-step-top"><span>{step.n}</span><Icon size={20}/></div><h3>{step.title}</h3><p>{step.body}</p><div className="rg-clip-step-line"/></InteractiveCard>;})}</div>
    </div></section>
    <section className="rg-clip-features"><div className="rg-clip-shell rg-clip-feature-layout"><div><span className="rg-clip-kicker"><Sparkles size={13}/> MADE FOR REAL CREATOR WORKFLOWS</span><h2>Not just captions.<br/><em>A complete short.</em></h2><p>For creators, educators, podcasters, and teams with strong long-form material and no time to hunt for every usable moment.</p><a className="rg-clip-primary" href="mailto:hussnain@rapigents.com?subject=Help%20shape%20Clip%20AI&body=I%27d%20like%20to%20share%20feedback%20about%20Clip%20AI.">Help shape Clip AI <ArrowUpRight size={17}/></a></div><div className="rg-clip-feature-list"><div><span><Scissors size={17}/></span><div><strong>Purposeful cuts</strong><p>Hook, context, payoff. Keep the story moving.</p></div><Zap size={16}/></div><div><span><Captions size={17}/></span><div><strong>Captions with rhythm</strong><p>Legible, well-timed subtitles with a consistent visual style.</p></div><Zap size={16}/></div><div><span><Clapperboard size={17}/></span><div><strong>Vertical-ready framing</strong><p>Composition designed for Shorts, Reels, and TikTok-style feeds.</p></div><Zap size={16}/></div><div><span><WandSparkles size={17}/></span><div><strong>Export-ready finish</strong><p>A coherent finish with captions, framing, and motion that fit the source.</p></div><Zap size={16}/></div></div></div></section>
    <section className="rg-clip-final"><div className="rg-clip-shell rg-clip-final-inner"><div><span className="rg-clip-kicker">YOUR NEXT EDIT STARTS HERE</span><h2>Turn the source<br/>into <em>the short.</em></h2><p>Paste a public video link to find strong moments, add expressive captions, and shape a vertical edit. Short video uploads are available as an alternative.</p></div><a className="rg-clip-primary" href="#clip-workbench">Create a short <ArrowUpRight size={17}/></a></div></section>
  </main>;
}
