import subprocess, sys, os, wave
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py'))
import numpy as np
WORK = os.path.dirname(os.path.abspath(__file__))
FF = f'{WORK}/ffmpeg'
DURS = [11.0, 10.0, 9.0, 8.62, 6.88, 7.0, 7.0, 6.38, 13.62, 9.62, 12.88, 12.75, 10.25, 10.5, 14.0, 13.88, 7.62, 7.0, 17.5, 11.5, 11.62, 9.38, 17.88, 6.62, 6.41]
J = []
for i in range(len(DURS)-1):
    t = ('fade', 1.2)
    if i == 8: t = ('fadeblack', 1.0)
    if i == 9: t = ('fadeblack', 1.2)
    if i in (4, 5, 6): t = ('fade', 0.9)
    if i == 16: t = ('fade', 0.25)
    if i == 17: t = ('fade', 1.6)
    J.append(t)

if not os.path.exists(f'{WORK}/vo.wav'):
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', f'{WORK}/vo.mp3', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', f'{WORK}/vo.wav'])
w = wave.open(f'{WORK}/vo.wav')
x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64)/32768
VOVOL = 0.85/np.max(np.abs(x))

if not os.path.exists(f'{WORK}/master_1080.mp4'):
    print('run tree_merge.py first'); sys.exit(1)

parts2 = [f"[0:v]scale=3840:2160:flags=lanczos,format=yuv420p[vout]",
          f"[1:a]aresample=48000,volume={VOVOL:.4f},asplit=2[vo1][vo2]",
          f"[2:a]aresample=48000[bd]",
          f"[bd][vo1]sidechaincompress=threshold=0.09:ratio=4:attack=80:release=600:level_sc=1[bdd]",
          f"[vo2][bdd]amix=inputs=2:normalize=0[a1]",
          f"[a1]alimiter=limit=0.95:attack=5:release=120[aout]"]
cmd = [FF, '-y', '-hide_banner', '-i', f'{WORK}/master_1080.mp4', '-i', f'{WORK}/vo.wav', '-i', f'{WORK}/bed.wav',
       '-filter_complex', ';'.join(parts2),
       '-map', '[vout]', '-map', '[aout]',
       '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-level', '5.1', '-b:v', '2600k', '-maxrate', '3200k', '-bufsize', '6400k', '-r', '24',
       '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-t', '258.912',
       '-movflags', '+faststart',
       f'{WORK}/final_4k.mp4']
r = subprocess.run(cmd, capture_output=True, text=True)
open('assemble.log', 'w').write(r.stderr[-6000:])
print('RC', r.returncode, flush=True)
if r.returncode:
    print(r.stderr[-4000:])
