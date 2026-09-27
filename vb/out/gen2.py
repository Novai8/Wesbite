import sys, os, wave
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py'))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.signal import butter, sosfilt
WORK = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
FONT = f'{WORK}/fonts/Inter.ttf'

def save_img(name, img, folder='img'):
    img = np.clip(img, 0, 1)
    Image.fromarray((img*255).astype(np.uint8)).save(f'{WORK}/{folder}/{name}.jpg', quality=92)

def vnoise(h, w, cells, seed):
    r = np.random.default_rng(seed)
    gh, gw = cells+2, cells*2+2
    g = r.random((gh, gw))
    ys = np.linspace(0, cells, h); xs = np.linspace(0, cells*2, w)
    y0 = ys.astype(int); x0 = xs.astype(int)
    fy = (ys-y0)[:, None]; fx = (xs-x0)[None, :]
    fy = fy*fy*(3-2*fy); fx = fx*fx*(3-2*fx)
    a = g[y0][:, x0]; b = g[y0][:, x0+1]; c = g[y0+1][:, x0]; d = g[y0+1][:, x0+1]
    return a*(1-fy)*(1-fx)+b*(1-fy)*fx+c*fy*(1-fx)+d*fy*fx

def fbm(shape, octaves=5, seed=0):
    out = np.zeros(shape); amp = 1.0; tot = 0.0
    for o in range(octaves):
        out += amp*vnoise(shape[0], shape[1], 4*(2**o), seed+o)
        tot += amp; amp *= 0.5
    return out/tot

def grain(img, amt=0.02, seed=1):
    r = np.random.default_rng(seed)
    return img + r.normal(0, amt, img.shape)

def vignette(img, s=0.35):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    d = ((xx-W/2)/(W/2))**2 + ((yy-H/2)/(H/2))**2
    return img*(1-s*np.clip(d-0.35, 0, 1)/0.65)[..., None]

def gauss(x0, y0, sx, sy=None, amp=1.0, rot=0.0):
    sy = sy or sx
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    if rot:
        c, s = np.cos(rot), np.sin(rot)
        dx, dy = xx-x0, yy-y0
        dx, dy = dx*c-dy*s, dx*s+dy*c
    else:
        dx, dy = xx-x0, yy-y0
    return amp*np.exp(-(dx*dx/(2*sx*sx)+dy*dy/(2*sy*sy)))

def addc(img, field, rgb):
    for ch in range(3):
        img[:, :, ch] += field*rgb[ch]

def starfield(img, n=900, boost=1.0, seed=5):
    r = np.random.default_rng(seed)
    for i in range(n):
        x = int(r.integers(0, W)); y = int(r.integers(0, H)); b = float(r.uniform(0.15, 1.0))*boost
        s = int(r.integers(0, 2))
        img[max(0, y-s):y+s+1, max(0, x-s):x+s+1] += b

def sphere_mask(cx, cy, rad):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    d = np.sqrt((xx-cx)**2+(yy-cy)**2)/rad
    return (d < 1).astype(float), d

def make_layers():
    for seed, dens, bright in [(1, 0.00025, 0.9), (2, 0.00018, 0.6), (3, 0.00012, 0.4)]:
        r = np.random.default_rng(seed)
        img = np.zeros((H, W), np.float32); n = int(W*H*dens)
        xs = r.integers(0, W, n); ys = r.integers(0, H, n); vals = (r.random(n)**3)*bright
        np.add.at(img, (ys, xs), vals)
        for _ in range(20):
            cx, cy = int(r.integers(20, W-20)), int(r.integers(20, H-20)); s = float(r.uniform(0.8, 1.6))
            y0, y1, x0, x1 = max(0, cy-6), cy+6, max(0, cx-6), cx+6
            yy, xx = np.ogrid[y0:y1, x0:x1]
            img[y0:y1, x0:x1] += np.exp(-(((xx-cx)**2+((yy-cy)**2))/(2*s*s)))*bright
        Image.fromarray((np.clip(img, 0, 1)*255).astype(np.uint8), 'L').save(f'{WORK}/layers/stars_{seed}.png')
    for seed, sc in [(1, 0.9), (2, 0.6)]:
        b = fbm((H, W), 4, 40+seed)
        m = np.clip((b-0.45)/0.3, 0, 1)*sc
        r = np.random.default_rng(seed+9)
        for _ in range(60):
            x, y = int(r.integers(0, W)), int(r.integers(0, H)); s = float(r.uniform(2, 8))
            m += gauss(x, y, s)*float(r.uniform(0.2, 0.7))
        Image.fromarray((np.clip(m, 0, 1)*255).astype(np.uint8), 'L').save(f'{WORK}/layers/dust_{seed}.png')
    cells = np.zeros((H, W, 3))
    r = np.random.default_rng(12)
    for _ in range(46):
        x, y = int(r.integers(40, W-40)), int(r.integers(40, H-40)); rad = float(r.uniform(8, 46))
        ring = np.abs(gauss(x, y, rad)-gauss(x, y, rad*0.55))
        addc(cells, ring*2.2, (0.15, 0.8, 0.75))
        addc(cells, gauss(x, y, rad*0.4)*0.7, (0.1, 0.5, 0.5))
    Image.fromarray((np.clip(cells, 0, 1)*255).astype(np.uint8)).save(f'{WORK}/layers/cells.png')

SR = 48000
def wav(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(f'{WORK}/sfx/{name}.wav', 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x*32767).astype('<i2').tobytes())

def make_sfx():
    r = np.random.default_rng(3)
    t = np.arange(int(200*SR))/SR
    n = r.standard_normal(len(t))
    pink = sosfilt(butter(1, 400, 'low', output='sos', fs=SR), n)
    lfo = 0.6+0.4*np.sin(2*np.pi*0.05*t)+0.2*np.sin(2*np.pi*0.013*t+1)
    wav('spacewind', pink*lfo*0.5)
    t = np.arange(int(196*SR))/SR
    brown = sosfilt(butter(1, 90, 'low', output='sos', fs=SR), r.standard_normal(len(t)))
    wav('rumble', brown*0.8)
    t = np.arange(int(19*SR))/SR
    rn = r.standard_normal(len(t))
    rain = sosfilt(butter(1, 1200, 'high', output='sos', fs=SR), rn)*0.5
    rain += sosfilt(butter(1, 3000, 'high', output='sos', fs=SR), rn)*0.3
    wav('rain', rain)
    t = np.arange(int(51*SR))/SR
    sw = 0.6+0.4*np.sin(2*np.pi*0.07*t)
    wav('oceanhush', sosfilt(butter(1, 700, 'low', output='sos', fs=SR), r.standard_normal(len(t)))*sw*0.6)
    t = np.arange(int(259*SR))/SR
    wav('drone', (np.sin(2*np.pi*55*t)+0.6*np.sin(2*np.pi*82.5*t+0.7))*0.25)
    t = np.arange(int(1.6*SR))/SR
    swp = sosfilt(butter(2, [200, 2400], 'band', output='sos', fs=SR), r.standard_normal(len(t)))
    env = np.sin(np.pi*np.linspace(0, 1, len(t)))**1.5
    wav('whoosh', swp*env)
    t = np.arange(int(3.0*SR))/SR
    f = np.linspace(90, 28, len(t))
    boom = np.sin(2*np.pi*f*t)*np.exp(-t*1.8)
    boom += r.standard_normal(len(t))*np.exp(-t*9)*0.5
    wav('impact1', boom)
    t = np.arange(int(2.2*SR))/SR
    f = np.linspace(70, 24, len(t))
    wav('impact2', np.sin(2*np.pi*f*t)*np.exp(-t*2.2))

def font(sz): return ImageFont.truetype(FONT, sz)
def spaced(draw, text, x, y, f, fill, sp):
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f)+sp
    return x

def make_overlays():
    def blank():
        return Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for nn in ['05', '06', '07', '08', '09', '10', '11']:
        im = blank(); d = ImageDraw.Draw(im)
        f = font(42)
        spaced(d, f'CHAPTER {nn}', 92, 66, f, (235, 235, 240, 230), 9)
        d.rectangle([94, 128, 244, 131], fill=(235, 235, 240, 160))
        im.save(f'{WORK}/ov/chapter_{nn}.png')
    im = blank(); d = ImageDraw.Draw(im)
    f = font(128)
    txt = "Earth's History"
    wtxt = d.textlength(txt, font=f)
    d.text(((W-wtxt)/2, 400), txt, font=f, fill=(245, 245, 248, 255))
    im.save(f'{WORK}/ov/title_main.png')
    im = blank(); d = ImageDraw.Draw(im)
    f = font(46)
    txt = 'It begins with destruction.'
    wtxt = d.textlength(txt, font=f)
    d.text(((W-wtxt)/2, 585), txt, font=f, fill=(205, 205, 212, 240))
    im.save(f'{WORK}/ov/title_sub.png')
    im = blank(); d = ImageDraw.Draw(im)
    f = font(54)
    txt = 'And it started small.'
    wtxt = d.textlength(txt, font=f)
    d.text(((W-wtxt)/2, 790), txt, font=f, fill=(240, 240, 246, 250))
    im.save(f'{WORK}/ov/closing.png')
    for active in ['46', '45', '35']:
        im = blank(); d = ImageDraw.Draw(im)
        y = 940
        d.line([240, y, 1680, y], fill=(230, 230, 235, 90), width=2)
        labels = [('4.6 BYA', '46', 240), ('4.5 BYA', '45', 960), ('3.5 BYA', '35', 1680)]
        f = font(30)
        for lab, key, x in labels:
            on = key == active
            col = (240, 240, 245, 235) if on else (200, 200, 210, 90)
            d.line([x, y-8, x, y+8], fill=col, width=2)
            if on:
                d.polygon([(x, y-26), (x+9, y-16), (x, y-6), (x-9, y-16)], fill=(245, 245, 250, 250))
            tw = d.textlength(lab, font=f)
            d.text((x-tw/2, y+20), lab, font=f, fill=col)
        im.save(f'{WORK}/ov/tl_{active}.png')

def stills():
    r = np.random.default_rng(7)
    Y, X = np.mgrid[0:H, 0:W].astype(float)
    img = np.zeros((H, W, 3))
    h = fbm((H, W), 5, 301)
    addc(img, h**2*0.35, (0.55, 0.30, 0.90))
    glow = gauss(W*0.8, H*0.3, 500, 420)
    addc(img, glow, (0.55, 0.30, 0.12))
    for i in range(260):
        x = int(r.integers(0, W)); y = int(r.integers(0, H))
        rad = float(r.uniform(1.5, 20)); b = float(r.uniform(0.2, 1.0))*(0.35+0.9*glow[y, x])
        addc(img, gauss(x, y, rad), np.array([0.95, 0.62, 0.35])*b)
    th = np.linspace(0, 2.6, 1200)
    px = (W*0.5+np.cos(th*0.8)*(140+th*520)).astype(int); py = (H*0.5+np.sin(th*0.8)*(90+th*260)).astype(int)
    ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    img[py[ok], px[ok]] += np.exp(-th[ok]*0.5)[:, None]*np.array([0.8, 0.5, 0.28])*0.6
    save_img('12_dust_clumps', vignette(grain(img), 0.35))
    img = np.zeros((H, W, 3)); starfield(img, 500, 0.5)
    addc(img, gauss(W*0.85, H*0.2, 700, 500)*0.5, (0.30, 0.16, 0.06))
    for i in range(34):
        cx = float(r.uniform(-100, W+100)); cy = float(r.uniform(-60, H+60))
        rad = float(r.uniform(18, 150)); depth = r.uniform(0.35, 1.0)
        m, d = sphere_mask(cx, cy, rad)
        lam = np.clip(((X-cx)/rad)*0.7-((Y-cy)/rad)*0.25+np.sqrt(np.clip(1-d*d, 0, 1))*0.5, 0, 1)**1.6
        body = np.array([0.16, 0.10, 0.07])*depth
        col = (0.2+0.9*lam)[..., None]*body[None, None, :]
        rim = (np.clip((d-0.8)/0.2, 0, 1)**2*m*0.8*depth)[..., None]*np.array([1.0, 0.55, 0.25])
        img += m[..., None]*(col+rim)
        er = fbm((H, W), 4, 300+i)
        mask2 = (d < 1-0.12*np.abs(er-0.5)).astype(float)*m
        for ch in range(3):
            img[:, :, ch] *= (1-m)+mask2
    save_img('13_planetesimals', vignette(grain(img), 0.4))
    img = np.zeros((H, W, 3)); starfield(img, 700, 0.7)
    mE, dE = sphere_mask(-300, H*0.55, 900)
    cr = fbm((H, W), 5, 77)
    ember = np.clip((cr-0.62)/0.2, 0, 1)*mE
    for ch in range(3):
        img[:, :, ch] += mE*np.array([0.05, 0.03, 0.025])[ch]+ember*np.array([0.9, 0.25, 0.05])[ch]*0.8
        img[:, :, ch] += np.clip((dE-0.86)/0.14, 0, 1)**2*mE*0.5*np.array([1.0, 0.45, 0.2])[ch]
    tx, ty, tr = W*0.72, H*0.42, 150
    mT, dT = sphere_mask(tx, ty, tr)
    heat = np.clip(1-dT, 0, 1)
    for ch in range(3):
        img[:, :, ch] += mT*(np.array([0.9, 0.28, 0.08])[ch]*(0.25+0.9*heat**1.5))
    addc(img, gauss(tx, ty, tr*2.4)*0.5, (0.8, 0.25, 0.07))
    addc(img, gauss(tx+300, ty-90, 420, 26, 0.5, rot=0.35), (0.5, 0.18, 0.06))
    save_img('14_theia_approach', vignette(grain(img), 0.4))
    t1 = fbm((H, W), 6, 21); t2 = fbm((H, W), 4, 22)
    plates = np.clip((t2-0.55)/0.1, 0, 1)
    heat = np.clip((t1-0.28)/0.6, 0, 1)**1.2*(1-0.7*plates)
    img = np.zeros((H, W, 3))
    img += np.stack([0.02+1.1*heat**1.2, 0.012+0.5*heat**2.0, 0.006+0.14*heat**3], axis=-1)
    img += heat[..., None]*np.array([0.28, 0.09, 0.02])
    img += np.stack([heat**4*0.9, heat**4*0.55, heat**4*0.2], axis=-1)
    img *= (0.55+0.45*(Y/H)**0.6)[..., None]
    for i in range(60):
        x = int(r.uniform(0, W)); y = int(r.uniform(H*0.3, H))
        img[y, x] += np.array([1.0, 0.6, 0.2])*r.uniform(0.3, 1)
    save_img('15_magma_ocean', vignette(grain(img), 0.45))
    img = np.zeros((H, W, 3))
    addc(img, np.clip((1-(Y/H))*1.4, 0, 1)**1.5, (0.16, 0.03, 0.02))
    addc(img, gauss(W*0.5, H*0.62, 900, 140), (1.0, 0.24, 0.05))
    for i in range(8):
        x0 = float(r.uniform(0.05, 0.95)*W)
        addc(img, gauss(x0, H*0.60, 120, 40)*0.8, (1.0, 0.35, 0.08))
    ridge = 0.60+0.10*fbm((1, W), 4, 9)[0][None, :]*np.ones((H, 1))
    m = (Y/H > ridge).astype(float)
    sm = fbm((H, W), 5, 31)
    img = img*(1-m[..., None])+(m[..., None]*np.array([0.015, 0.008, 0.006]))
    for i in range(7):
        x0 = float(r.uniform(0.1, 0.9)*W)
        coln = np.exp(-((X-x0)/float(r.uniform(60, 140)))**2)*np.clip((ridge[0, 0]*H-Y)/H, 0, 1)**1.2
        addc(img, coln*0.6*(0.6+0.4*sm), (0.16, 0.07, 0.06))
    for i in range(220):
        x = int(r.uniform(0, W)); y = int(r.uniform(H*0.35, H))
        img[y, x] += np.array([1, 0.4, 0.1])*r.uniform(0.3, 1.0)
    save_img('16_volcanic_haze', vignette(grain(img), 0.45))
    img = np.zeros((H, W, 3)); starfield(img, 600, 0.6)
    mE, dE = sphere_mask(W*0.45, H*1.55, 1500)
    cr = fbm((H, W), 5, 78)
    ember = np.clip((cr-0.68)/0.15, 0, 1)*mE
    for ch in range(3):
        img[:, :, ch] += mE*np.array([0.02, 0.012, 0.01])[ch]+ember*np.array([0.8, 0.2, 0.04])[ch]*0.35
        img[:, :, ch] += np.clip((dE-0.965)/0.035, 0, 1)*mE*0.8*np.array([1.0, 0.4, 0.15])[ch]
    tx, ty, tr = W*0.68, H*0.30, 170
    mT, dT = sphere_mask(tx, ty, tr)
    heat = np.clip(1-dT, 0, 1)**1.5
    for ch in range(3):
        img[:, :, ch] += mT*np.array([1.0, 0.32, 0.10])[ch]*(0.3+heat)
    addc(img, gauss(tx, ty, tr*2.6)*0.6, (0.85, 0.28, 0.08))
    trail = np.exp(-((Y-(ty-(X-tx)*0.28))/38)**2)*np.clip((X-tx)/700, 0, 1)*np.exp(-(X-tx)/900)*0.5
    addc(img, trail, (0.8, 0.3, 0.1))
    save_img('17_preimpact', vignette(grain(img), 0.4))
    img = np.zeros((H, W, 3)); starfield(img, 300, 0.5)
    addc(img, gauss(W*0.55, H*0.45, 260, 220), (1.0, 0.85, 0.6))
    addc(img, gauss(W*0.55, H*0.45, 620, 520)*0.7, (1.0, 0.45, 0.15))
    addc(img, gauss(W*0.55, H*0.45, 1100, 900)*0.3, (0.8, 0.25, 0.08))
    ring = np.abs(np.sqrt(((X-W*0.55)/900)**2+((Y-H*0.45)/760)**2)-1)
    addc(img, np.exp(-(ring/0.05)**2)*0.8, (1.0, 0.6, 0.25))
    for i in range(260):
        a = r.uniform(0, 2*np.pi); rr = r.uniform(60, 900)
        x = int(W*0.55+np.cos(a)*rr); y = int(H*0.45+np.sin(a)*rr*0.85)
        if 0 <= x < W and 0 <= y < H:
            img[y, x] += np.array([1.0, 0.7, 0.3])*r.uniform(0.3, 1.2)*np.exp(-rr/700)
    save_img('18_impact_flash', vignette(grain(img), 0.35))
    img = np.zeros((H, W, 3)); starfield(img, 800, 0.8)
    mE, dE = sphere_mask(W*0.5, H*0.52, 300)
    cr = fbm((H, W), 5, 79)
    for ch in range(3):
        img[:, :, ch] += mE*np.array([0.05, 0.03, 0.025])[ch]*1.2
        img[:, :, ch] += np.clip((cr-0.58)/0.2, 0, 1)*mE*np.array([0.7, 0.2, 0.05])[ch]*1.6
        img[:, :, ch] += np.clip((dE-0.85)/0.15, 0, 1)**2*mE*0.7*np.array([1.0, 0.5, 0.25])[ch]
    th = np.linspace(0, 2*np.pi, 2000)
    for k, (ra, rb, til, br) in enumerate([(780, 240, -0.30, 1.0), (560, 170, -0.30, 0.7)]):
        ex = W*0.5+np.cos(th)*ra; ey = H*0.52+np.sin(th)*rb
        c, s = np.cos(til), np.sin(til); dx, dy = ex-W*0.5, ey-H*0.52
        ex, ey = W*0.5+dx*c-dy*s, H*0.52+dx*s+dy*c
        xx, yy = ex.astype(int), ey.astype(int)
        ok = (xx >= 0) & (xx < W) & (yy >= 0) & (yy < H)
        lum = br*2.6*(0.5+0.5*np.sin(th*3+k))
        img[yy[ok], xx[ok]] += lum[ok][:, None]*np.array([1.0, 0.55, 0.25])
        ok2 = (xx >= 0) & (xx < W) & (yy-3 >= 0) & (yy-3 < H)
        img[yy[ok2]-3, xx[ok2]] += lum[ok2][:, None]*np.array([0.6, 0.3, 0.12])
    for i in range(420):
        a = r.uniform(0, 2*np.pi); rr = float(r.uniform(380, 860))
        x = int(W*0.5+np.cos(a)*rr); y = int(H*0.52+np.sin(a)*rr*0.31)
        if 0 <= x < W and 0 <= y < H:
            img[y, x] += np.array([1.0, 0.6, 0.3])*r.uniform(0.2, 1.0)
    save_img('19_moon_forming', vignette(grain(img), 0.4))
    img = np.zeros((H, W, 3))
    addc(img, (1-Y/H)**2*0.5, (0.10, 0.02, 0.015))
    ground = (Y/H > 0.66)
    cr = fbm((H, W), 5, 55)
    cracks = np.clip((np.abs(cr-0.5)-0.02)*-8+1, 0, 1)*ground
    for ch in range(3):
        img[:, :, ch] += ground*np.array([0.02, 0.015, 0.012])[ch]+cracks*np.array([0.9, 0.3, 0.08])[ch]*0.8
    st = fbm((H, W), 5, 56)
    for x0 in np.linspace(0.15, 0.85, 4)*W:
        for yy in range(int(H*0.25), int(H*0.66)):
            sway = 50*st[yy, int(x0) % W]
            wdt = 26+(H*0.66-yy)*0.10
            prof = np.exp(-((X-(x0+sway))/wdt)**2)*np.exp(-(H*0.66-yy)/(H*0.45))
            addc(img, prof*0.0008, (0.75, 0.78, 0.82))
    save_img('20_cooling_steam', vignette(grain(img), 0.45))
    img = np.zeros((H, W, 3))
    cl = fbm((H, W), 5, 66)
    addc(img, np.clip(cl*1.3-0.3, 0, 1), (0.16, 0.20, 0.26))
    addc(img, gauss(W*0.3, H*0.25, 400, 260)*0.5, (0.20, 0.24, 0.30))
    addc(img, (Y/H)**3*0.6, (0.02, 0.03, 0.05))
    for i in range(1400):
        x = int(r.uniform(0, W)); y = int(r.uniform(0, H)); l = int(r.uniform(6, 22)); b = r.uniform(0.08, 0.5)
        y1 = min(H, y+l)
        img[y:y1, x] += b*np.stack([np.full(y1-y, 0.6), np.full(y1-y, 0.7), np.full(y1-y, 0.85)], axis=1)
    ground = (Y/H > 0.8)
    for ch in range(3):
        img[:, :, ch] += ground*np.array([0.01, 0.015, 0.02])[ch]
    sh = fbm((H, W), 4, 67)
    addc(img, ground*np.clip(sh-0.4, 0, 1)*0.5, (0.05, 0.08, 0.12))
    cr = fbm((H, W), 4, 68); sh2 = fbm((H, W), 4, 69)
    addc(img, ground*np.clip((np.abs(cr-0.5)-0.03)*-6+1, 0, 1)*np.clip(sh2-0.35, 0, 1)*0.6, (0.8, 0.25, 0.06))
    addc(img, gauss(W*0.5, H*0.80, 900, 60)*0.25, (0.10, 0.12, 0.16))
    save_img('21_first_rain', vignette(grain(img), 0.45))
    img = np.zeros((H, W, 3)); starfield(img, 800, 0.8)
    mE, dE = sphere_mask(W*0.5, H*0.55, 430)
    cl = fbm((H, W), 5, 88)
    swirl = np.clip((cl-0.5)/0.18, 0, 1)
    zz = np.sqrt(np.clip(1-dE*dE, 0, 1))
    lam = np.clip(((X-W*0.5)/430)*-0.5-((Y-H*0.55)/430)*0.4+zz*0.7, 0, 1)
    ocean = np.array([0.02, 0.10, 0.22])
    for ch in range(3):
        img[:, :, ch] += mE*(ocean[ch]*(0.35+0.9*lam)+swirl*np.array([0.7, 0.8, 0.9])[ch]*0.45)
        img[:, :, ch] += np.clip((dE-0.88)/0.12, 0, 1)**2*mE*0.35*np.array([0.4, 0.7, 1.0])[ch]
    addc(img, gauss(W*0.38, H*0.42, 120, 60)*mE*0.7, (0.8, 0.9, 1.0))
    save_img('22_ancient_ocean', vignette(grain(img), 0.4))
    img = np.zeros((H, W, 3))
    addc(img, (Y/H)*0.5, (0.010, 0.035, 0.045))
    addc(img, gauss(W*0.42, H*0.55, 420, 420)*0.35, (0.03, 0.10, 0.12))
    addc(img, gauss(W*0.35, H*0.9, 500, 300)*0.4, (0.02, 0.05, 0.06))
    chx = W*0.38
    chim = np.exp(-((X-chx-(Y/H)*40)/(60*(0.4+Y/H)))**2)*(Y/H > 0.45)
    img = img*(1-chim[..., None]*0.92)+chim[..., None]*np.array([0.01, 0.012, 0.014])
    glowm = np.exp(-((X-chx-(Y/H)*40)/(26*(0.4+Y/H)))**2)*(Y/H > 0.8)*np.clip((Y/H-0.8)/0.2, 0, 1)
    addc(img, glowm*0.5, (0.9, 0.5, 0.15))
    st = fbm((H, W), 5, 91)
    for yy in range(int(H*0.62), -1, -2):
        t = (H*0.62-yy)/(H*0.62)
        sway = 90*st[yy, 800]+40*np.sin(yy*0.02)
        cx = chx+30+sway*t
        wdt = 26+170*t
        prof = np.exp(-((X-cx)/wdt)**2)*0.007*(1-t*0.5)
        addc(img, prof, (0.35, 0.5, 0.55))
        if t < 0.25:
            addc(img, prof*0.35, (0.9, 0.55, 0.2))
    for i in range(900):
        t = r.uniform(0, 1); x = int(chx+30+r.normal(0, 40+240*t)); y = int(H*0.62-t*H*0.6)
        if 0 <= x < W and 0 <= y < H:
            img[y, x] += (np.array([0.7, 0.8, 0.85]) if r.uniform() > 0.2 else np.array([1.0, 0.6, 0.2]))*r.uniform(0.3, 1.6)
    for i in range(120):
        x = int(r.uniform(0, W)); y = int(r.uniform(0, H))
        img[y, x] += np.array([0.2, 0.8, 0.7])*r.uniform(0.1, 0.5)
    save_img('23_vent', vignette(grain(img), 0.45))
    img = np.zeros((H, W, 3)); starfield(img, 500, 0.4)
    mE, dE = sphere_mask(W*0.5, H*0.55, 470)
    zz = np.sqrt(np.clip(1-dE*dE, 0, 1))
    for ch in range(3):
        img[:, :, ch] += mE*np.array([0.01, 0.03, 0.045])[ch]*(0.4+0.8*zz)
        img[:, :, ch] += np.clip((dE-0.9)/0.1, 0, 1)**2*mE*0.5*np.array([0.2, 0.7, 0.7])[ch]
    cl = fbm((H, W), 4, 95)
    for i in range(70):
        a = r.uniform(0, 2*np.pi); rr = r.uniform(0, 1)**0.5*430
        x = int(W*0.5+np.cos(a)*rr); y = int(H*0.55+np.sin(a)*rr*0.9)
        if 0 <= x < W and 0 <= y < H:
            rad = r.uniform(6, 36); b = r.uniform(0.2, 0.8)
            addc(img, np.abs(gauss(x, y, rad)-gauss(x, y, rad*0.5))*b*3, (0.15, 0.8, 0.75))
            addc(img, gauss(x, y, rad*0.4)*b, (0.1, 0.5, 0.5))
    save_img('25_cells_planet', vignette(grain(img), 0.4))
    img = np.zeros((H, W, 3)); starfield(img, 400, 0.5)
    addc(img, (1-Y/H)**1.6*0.5, (0.16, 0.05, 0.22))
    mE, dE = sphere_mask(W*0.5, H*2.35, 1900)
    riml = np.clip((0.995-dE)/0.05, 0, 1)*mE
    addc(img, riml, (0.9, 0.5, 1.0))
    addc(img, np.clip((dE-0.999)/0.001, 0, 1)*mE*0.6, (1.0, 0.8, 1.0))
    addc(img, gauss(W*0.5, H*0.78, 900, 160)*0.5, (0.6, 0.25, 0.7))
    save_img('26_horizon', vignette(grain(img), 0.35))

if __name__ == '__main__':
    make_layers(); print('layers ok', flush=True)
    make_sfx(); print('sfx ok', flush=True)
    make_overlays(); print('overlays ok', flush=True)
    stills(); print('stills ok', flush=True)
