import sys, os, wave
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py'))
import numpy as np
WORK = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUR = 258.912

def loadw(p):
    w = wave.open(p)
    return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64)/32768

N = int(DUR*SR)+SR*2
bed = np.zeros(N)

def place(name, t0, gain=1.0):
    x = loadw(f'{WORK}/sfx/{name}.wav'); s = int(t0*SR)
    e = min(N, s+len(x))
    bed[s:e] += x[:e-s]*gain

def env(name, pts, t0=0.0):
    x = loadw(f'{WORK}/sfx/{name}.wav'); L = len(x)
    ts = np.arange(L)/SR
    g = np.interp(ts, [p[0] for p in pts], [p[1] for p in pts])
    s = int(t0*SR); e = min(N, s+L)
    bed[s:e] += x[:e-s]*g[:e-s]

env('spacewind', [(0, 0.0), (1.5, 0.07), (21, 0.07), (38.6, 0.13), (79.5, 0.12), (89, 0.13), (163, 0.10), (170, 0.04), (178, 0.07), (195.5, 0.06), (200, 0.0)])
env('rumble', [(0, 0), (60, 0), (66, 0.08), (135.5, 0.10), (160, 0.16), (170.9, 0.20), (176, 0.14), (190, 0.06), (196, 0.0)])
env('rain', [(0, 0), (3, 0.09), (12, 0.09), (15, 0)], 204)
env('oceanhush', [(0, 0), (6, 0.10), (36, 0.10), (44, 0.08), (51, 0.06)], 208)
env('drone', [(0, 0), (79.5, 0), (81, 0.09), (87.5, 0.09), (89.1, 0), (89.2, 0), (245.9, 0), (247.5, 0.09), (256, 0.08), (258.9, 0.05)])
place('whoosh', 37.6, 0.10); place('whoosh', 88.1, 0.12); place('whoosh', 162.6, 0.07); place('whoosh', 194.6, 0.10)
place('impact1', 170.9, 0.55); place('impact2', 176.6, 0.30)
bed = bed/np.max(np.abs(bed))*0.6
with wave.open(f'{WORK}/bed.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((bed*32767).astype('<i2').tobytes())
print('bed done', len(bed)/SR, flush=True)
