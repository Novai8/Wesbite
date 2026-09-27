import subprocess, os, sys
WORK = os.path.dirname(os.path.abspath(__file__))
FF = f'{WORK}/ffmpeg'
K = 2560/1920

def run(cmd, log):
    r = subprocess.run(cmd, capture_output=True, text=True)
    with open(log, 'a') as f:
        f.write(' '.join(cmd[-3:])+'\n'+(r.stderr[-2500:] if r.returncode else 'OK')+'\n')
    if r.returncode:
        print('FAIL', log); print(r.stderr[-2000:]); sys.exit(1)

S = []
def shot(name, dur, src, z0, z1, px0=.5, py0=.5, px1=.5, py1=.5, ov=()):
    S.append(dict(name=name, dur=dur, src=src, z0=z0, z1=z1, p=(px0, py0, px1, py1), ov=ov))

shot('s01', 11.0, 'img/01_city_night.jpg', 1.05, 1.22, .5, .62, .5, .38, ov=[('layers/stars_1.png', 0, 11, 'screen', 0.8)])
shot('s02', 10.0, 'img/02_starfield_horizon.jpg', 1.28, 1.06, ov=[('layers/stars_2.png', 0, 10, 'screen', 0.8)])
shot('s03', 9.0, 'img/03_strata.jpg', 1.12, 1.26, .35, .5, .65, .5)
shot('s04', 8.62, 'img/04_subduction.jpg', 1.06, 1.22, .5, .35, .5, .65)
shot('s05', 6.88, 'img/05_earth_molten.jpg', 1.32, 1.06, ov=[('layers/stars_3.png', 0, 6.88, 'screen', 0.7)])
shot('s06', 7.0, 'img/06_earth_darkrock.jpg', 1.05, 1.18, ov=[('layers/stars_1.png', 0, 7, 'screen', 0.7)])
shot('s07', 7.0, 'img/07_earth_ice.jpg', 1.16, 1.04, ov=[('layers/stars_2.png', 0, 7, 'screen', 0.7)])
shot('s08', 6.38, 'img/08_earth_ocean.jpg', 1.04, 1.16, ov=[('layers/stars_3.png', 0, 6.38, 'screen', 0.7)])
shot('s09', 13.62, 'img/09_life_signal.jpg', 1.08, 1.30)
shot('s10', 9.62, 'BLACK', 1, 1, ov=[('ov/title_main.png', 0.9, 9.62, 'text'), ('ov/title_sub.png', 3.4, 9.62, 'text')])
shot('s11', 12.88, 'img/11_nebula_disk.jpg', 1.06, 1.22, ov=[('layers/dust_1.png', 0, 12.88, 'screen', 0.5), ('ov/chapter_05.png', 0.3, 4.6, 'text'), ('ov/tl_46.png', 1.2, 8.2, 'text')])
shot('s12', 12.75, 'img/12_dust_clumps.jpg', 1.05, 1.30, ov=[('layers/dust_2.png', 0, 12.75, 'screen', 0.5)])
shot('s13', 10.25, 'img/13_planetesimals.jpg', 1.08, 1.20, ov=[('layers/dust_2.png', 0, 10.25, 'screen', 0.5), ('ov/chapter_06.png', 0.3, 4.6, 'text')])
shot('s14', 10.5, 'img/14_theia_approach.jpg', 1.05, 1.28, .62, .5, .52, .5, ov=[('layers/stars_2.png', 0, 10.5, 'screen', 0.7)])
shot('s15', 14.0, 'img/15_magma_ocean.jpg', 1.06, 1.18, .40, .5, .60, .5, ov=[('ov/chapter_07.png', 0.3, 4.6, 'text')])
shot('s16', 13.88, 'img/16_volcanic_haze.jpg', 1.05, 1.24)
shot('s17', 7.62, 'img/17_preimpact.jpg', 1.05, 1.22, ov=[('ov/chapter_08.png', 0.3, 4.6, 'text')])
shot('s18', 7.0, 'img/18_impact_flash.jpg', 1.02, 1.14)
shot('s19', 17.5, 'img/19_moon_forming.jpg', 1.20, 1.04, ov=[('layers/stars_1.png', 0, 17.5, 'screen', 0.7), ('ov/tl_45.png', 2.0, 9.0, 'text')])
shot('s20', 11.5, 'img/20_cooling_steam.jpg', 1.06, 1.18, ov=[('ov/chapter_09.png', 0.3, 4.6, 'text')])
shot('s21', 11.62, 'img/21_first_rain.jpg', 1.05, 1.20)
shot('s22', 9.38, 'img/22_ancient_ocean.jpg', 1.04, 1.14, ov=[('ov/chapter_10.png', 0.3, 4.6, 'text')])
shot('s23', 17.88, 'img/23_vent.jpg', 1.06, 1.26, ov=[('layers/cells.png', 13.0, 17.88, 'screen', 0.6), ('ov/tl_35.png', 2.0, 9.0, 'text')])
shot('s24', 6.62, 'img/25_cells_planet.jpg', 1.05, 1.25, ov=[('ov/chapter_11.png', 0.3, 4.6, 'text')])
shot('s25', 6.41, 'img/26_horizon.jpg', 1.05, 1.15, ov=[('layers/stars_2.png', 0, 6.41, 'screen', 0.7), ('ov/closing.png', 1.6, 6.41, 'text')])

J = []
for i in range(len(S)-1):
    t = ('fade', 1.2)
    if i == 8: t = ('fadeblack', 1.0)
    if i == 9: t = ('fadeblack', 1.2)
    if i in (4, 5, 6): t = ('fade', 0.9)
    if i == 16: t = ('fade', 0.25)
    if i == 17: t = ('fade', 1.6)
    J.append(t)

for i in range(len(S)-1):
    S[i]['dur'] = round(S[i]['dur']+J[i][1], 3)

os.makedirs('shots', exist_ok=True)
open('render.log', 'w').write('')
skip = set(sys.argv[1:])
for i, s in enumerate(S):
    if s['name'] in skip:
        continue
    if s['src'] != 'BLACK' and not os.path.exists(f"{WORK}/{s['src']}"):
        print('MISSING', s['src']); continue
    NF = round(s['dur']*24)
    parts = []; inp = ['-y']
    if s['src'] == 'BLACK':
        inp += ['-f', 'lavfi', '-t', str(s['dur']), '-i', 'color=c=black:s=2560x1440:r=24']
        parts.append('[0:v]scale=1920:1080,format=gbrp[base]')
    else:
        z0, z1 = s['z0']*K, s['z1']*K
        px0, py0, px1, py1 = s['p']
        parts.append(f"[0:v]scale=2560:1440:flags=lanczos,zoompan=z='{z0:.4f}+({z1:.4f}-{z0:.4f})*on/{NF}':x='(iw-iw/zoom)*({px0}+({px1}-{px0})*on/{NF})':y='(ih-ih/zoom)*({py0}+({py1}-{py0})*on/{NF})':d={NF}:s=1920x1080:fps=24,format=gbrp[base]")
        inp += ['-loop', '1', '-i', f"{WORK}/{s['src']}"]
    chain = '[base]'; li = 1
    for ov in s['ov']:
        f, r0, r1, kind = ov[0], ov[1], ov[2], ov[3]
        op = ov[4] if len(ov) > 4 else 0.6
        inp += ['-loop', '1', '-t', str(s['dur']), '-i', f"{WORK}/{f}"]
        if kind == 'text':
            fin = r1-s['dur']-0.8 if r1 < s['dur']-0.01 else -1
            fl = f"format=rgba,fade=t=in:st={r0}:d=0.8:alpha=1"
            if fin > 0:
                fl += f",fade=t=out:st={fin}:d=0.8:alpha=1"
            parts.append(f'[{li}:v]{fl}[o{li}]')
            parts.append(f'{chain}[o{li}]overlay=0:0[v{li}]')
        else:
            parts.append(f"[{li}:v]scale=2100:1180,crop=1920:1080:x='90+40*sin(t*0.11+{li})':y='40+25*cos(t*0.09+{li})',format=rgb24[o{li}]")
            parts.append(f'{chain}[o{li}]blend=all_mode=screen:all_opacity={op}[v{li}]')
        chain = f'[v{li}]'; li += 1
    parts.append(f'{chain}format=yuv420p[out]')
    cmd = [FF, '-hide_banner']+inp+['-filter_complex', ';'.join(parts), '-map', '[out]', '-frames:v', str(NF), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-r', '24', f"{WORK}/shots/{s['name']}.mp4"]
    run(cmd, 'render.log')
    print('shot', s['name'], 'ok', flush=True)
print('SHOT PASS DONE', flush=True)
