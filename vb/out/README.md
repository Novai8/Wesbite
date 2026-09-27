# Earth's Story, in 12 Beats — Episode 01

`earth-history-episode-01.mp4` — cinematic documentary motion-graphics video synced
to the narration `tmp26pqlnx2.mp3` from the Novai8/Portfolio repository (258.9 s / 4:19).

## Specs

- 3840×2160 (4K UHD, 16:9), H.264 High 5.1 + AAC-LC 128 kbps, 24 fps CFR
- ~2.6 Mbps video / ~88 MB total (capped under GitHub's 100 MB single-file limit)
- Duration 258.9 s, synced scene-for-scene to the narration's 12 beats

## Contents of this folder

- `earth-history-episode-01.mp4` — the finished video
- `assets.zip` — 24 source key frames (AI-generated + procedural), text overlays,
  parallax layers, and the full build scripts (gen2.py generator, build_video.py
  shot renderer, tree_merge.py xfade assembler, mix_audio.py + assemble.py audio
  mix / 4K encode)
- `README.md` — this note

## Production notes

- 25 scenes: tonight's sky → deep time → four Earths (molten, black rock, ice,
  ocean) → life thread → solar nebula → Theia impact & Moon ring → first rain →
  oceans → hydrothermal-vent life → closing beat.
- All visuals are original (AI-generated or procedurally synthesized with numpy
  value-noise); no copyrighted footage. All sound effects synthesized from scratch;
  narration stays dominant over soft ambient beds (sidechain-ducked), two low
  cinematic impacts at the Theia collision, gentle whooshes at major transitions.
- Typography: Inter (OFL). On-screen text limited to a title card, CHAPTER markers,
  4.6/4.5/3.5 BYA time-scale chips and one closing line; no burned-in subtitles.

## Re-render

Unzip `assets.zip`, install numpy/scipy/Pillow + ffmpeg (libx264), then:
`python3 gen2.py` (stills/layers/SFX/overlays) → `python3 build_video.py`
(25 shots) → `python3 tree_merge.py` (xfade assembly) → `python3 mix_audio.py`
(ambient bed) → `python3 assemble.py` (4K upscale + final mix).
