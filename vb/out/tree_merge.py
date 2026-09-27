import subprocess, sys, os, re
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

def probe(f):
    r = subprocess.run([FF, '-i', f], capture_output=True, text=True)
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    h, mm, ss = map(float, m.groups())
    return h*3600+mm*60+ss

nodes = [(f'{WORK}/shots/s{i+1:02d}.mp4', i, i) for i in range(len(DURS))]
os.makedirs('merge', exist_ok=True)
lvl = 0
while len(nodes) > 1:
    nxt = []
    for k in range(0, len(nodes), 2):
        if k+1 >= len(nodes):
            nxt.append(nodes[k]); continue
        fa, sa, ea = nodes[k]; fb, sb, eb = nodes[k+1]
        tt, td = J[ea]
        da = probe(fa); db = probe(fb)
        out = f'{WORK}/merge/g{lvl}_{k}.mp4'
        if not (os.path.exists(out) and os.path.getsize(out) > 1000):
            cmd = [FF, '-y', '-hide_banner', '-i', fa, '-i', fb,
                   '-filter_complex', f'[0:v][1:v]xfade=transition={tt}:duration={td:.2f}:offset={da-td:.3f}[v]',
                   '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-r', '24', out]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode:
                print('FAIL', out, r.stderr[-1500:]); sys.exit(1)
            print('merged', out, flush=True)
        nxt.append((out, sa, eb))
    nodes = nxt; lvl += 1
    print('level', lvl, 'nodes', len(nodes), flush=True)
os.replace(nodes[0][0], f'{WORK}/master_1080.mp4')
print('MASTER DONE', flush=True)
