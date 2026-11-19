"""Original 128 BPM workout track for the 30-second Ugent cut, locked to the film's beat map.

Beats 0-2: three hits on the intro words. Beat 4: the wordmark slam. Beats 4-7: snare-roll build and riser,
a short gap, then the drop on beat 8. Beats 8-61: four-on-the-floor kick, claps, hats, rolling bass with sidechain,
offbeat chord stabs; fills and crashes into Pro (beat 24) and Team (beat 40), with a pluck arpeggio added for
Pro and busier hats for Team. Beat 62: the final hit, then the tail.
Usage: python3 music-fast.py out.wav"""
import sys, wave
import numpy as np

SR = 44100
BPM = 128
B = 60 / BPM
BEATS = 64
DUR = BEATS * B
N = int(round(DUR * SR))
rng = np.random.default_rng(128)

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def at(beat):
    return int(round(beat * B * SR))

def filt(x, lo=None, hi=None, order=4):
    """Zero-phase filter in the frequency domain: lo = high-pass corner, hi = low-pass corner (Hz)."""
    n = len(x); size = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, size); f = np.fft.rfftfreq(size, 1 / SR)
    g = np.ones_like(f)
    if hi: g /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo: g /= np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, size)[:n]

def add(track, sample, pos, gain=1.0):
    if pos >= len(track): return
    end = min(len(track), pos + len(sample))
    track[pos:end] += sample[:end - pos] * gain

def tt(sec):
    return np.arange(int(sec * SR)) / SR

# ---------- One-shots ----------
def kick(big=False):
    t = tt(0.45)
    f = 48 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (5 if big else 7.5))
    click = filt(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * (2.2 if big else 1.8)) * 0.95

def clap():
    t = tt(0.32)
    n = filt(rng.standard_normal(len(t)), lo=900, hi=5000)
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        env += (t >= d) * np.exp(-np.clip(t - d, 0, None) * (60 if d < 0.02 else 14))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return (n * env * 0.6 + tone) * 0.9

def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    n = filt(rng.standard_normal(len(t)), lo=7500)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.32

def crash():
    t = tt(2.2)
    n = filt(rng.standard_normal(len(t)), lo=3500)
    return n * np.exp(-t * 3.4) * 0.3

def boom():
    t = tt(1.4)
    f = 38 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6) * 0.9

def saw(f, t, detune=0.0):
    ph = (f * (1 + detune)) * t + rng.uniform(0, 1)
    return 2 * (ph - np.floor(ph + 0.5))

# ---------- Tracks ----------
drums = np.zeros(N); bass = np.zeros(N); stabs_l = np.zeros(N); stabs_r = np.zeros(N)
arp = np.zeros(N); fx = np.zeros(N); hats_l = np.zeros(N); hats_r = np.zeros(N)

K, KB, CL, HC, HO, CR, BM = kick(), kick(True), clap(), hat(), hat(True), crash(), boom()

# Intro hits on the three words, then the wordmark slam.
for b in (0, 1, 2):
    add(drums, KB, at(b), 0.9); add(fx, BM, at(b), 0.35); add(drums, CL, at(b), 0.5)
add(drums, KB, at(4), 1.0); add(fx, BM, at(4), 0.8); add(fx, CR, at(4), 0.8)

# Build, beats 4-8: snare roll speeding up (8ths, 16ths, 32nds) and a rising riser, then a short gap.
roll = []
roll += [4 + i * 0.5 for i in range(2)]          # beat 4-5: 8ths
roll += [5 + i * 0.25 for i in range(4)]         # beat 5-6: 16ths
roll += [6 + i * 0.125 for i in range(8)]        # beat 6-7: 32nds
roll += [7 + i * 0.0625 for i in range(12)]      # beat 7 to 7.75: 64ths
for i, b in enumerate(roll):
    add(drums, CL, at(b), 0.25 + 0.55 * i / len(roll))
r0, r1 = at(4), at(7.75)
t = np.arange(r1 - r0) / SR; k = t / t[-1]
riser = filt(rng.standard_normal(len(t)), lo=1200) * k ** 2 * 0.35
f = 200 * 2 ** (k * 4)
riser += np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 1.5 * 0.12
fx[r0:r1] += riser

# Groove, beats 8-61.
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]  # Am, F, C, G
ROOTS = [33, 29, 36, 31]                                              # A1, F1, C2, G1
kicks = []
for b in range(8, 62):
    bar = (b - 8) // 4
    chord, root = CHORDS[bar % 4], ROOTS[bar % 4]
    big = b in (8, 24, 40, 56)
    add(drums, KB if big else K, at(b), 1.0); kicks.append(at(b))
    if big:
        add(fx, CR, at(b), 0.9); add(fx, BM, at(b), 0.6)
    if b % 2 == 1:
        add(drums, CL, at(b), 0.75)
    # Hats: closed 16ths with the offbeat accented, an open hat on each "and"; busier for Team.
    for s in range(4):
        g = 0.55 if s == 2 else 0.28
        if s == 2:
            add(hats_l, HO, at(b + 0.5), 0.34); add(hats_r, HO, at(b + 0.5), 0.24)
        else:
            add(hats_l if s % 2 else hats_r, HC, at(b + s * 0.25), g)
    if b >= 40:
        for s in range(8):
            add(hats_r if s % 2 else hats_l, HC, at(b + s * 0.125), 0.12)
    # Rolling bass: the 2nd, 3rd and 4th 16th of each beat (the kick owns the 1st).
    for s in (1, 2, 3):
        p0 = at(b + s * 0.25); L = int(0.25 * B * SR * 0.92)
        tn = np.arange(L) / SR
        note = root + (12 if s == 3 and b % 2 else 0)
        wv = saw(hz(note), tn) * 0.7 + np.sin(2 * np.pi * hz(note) * tn) * 0.6
        env = np.clip(tn / 0.004, 0, 1) * np.exp(-tn * 9)
        add(bass, wv * env, p0, 0.55)
    # Offbeat chord stab on the "and".
    p0 = at(b + 0.5); L = int(0.22 * SR); tn = np.arange(L) / SR
    env = np.clip(tn / 0.003, 0, 1) * np.exp(-tn * 13)
    for m in chord:
        for d in (-0.008, -0.003, 0.0, 0.004, 0.009):
            add(stabs_l, saw(hz(m + 12), tn, d) * env, p0, 0.035)
            add(stabs_r, saw(hz(m + 12), tn, -d) * env, p0, 0.035)
    # Pro and Team: a bright 16th pluck arpeggio on top.
    if b >= 24:
        pat = [0, 1, 2, 1]
        for s in range(4):
            m = chord[pat[s]] + 24
            p0 = at(b + s * 0.25); L = int(0.2 * SR); tn = np.arange(L) / SR
            tone = np.sin(2 * np.pi * hz(m) * tn) + 0.3 * np.sin(4 * np.pi * hz(m) * tn)
            add(arp, tone * np.exp(-tn * 22) * np.clip(tn / 0.002, 0, 1), p0, 0.11 if b < 40 else 0.14)

# Fills into Pro and Team: a 16th snare fill and a quick riser on the beat before.
for b in (23, 39, 55):
    for s in range(4):
        add(drums, CL, at(b + s * 0.25), 0.35 + 0.15 * s)
    p0, p1 = at(b), at(b + 0.95)
    tn = np.arange(p1 - p0) / SR; k = tn / tn[-1]
    fx[p0:p1] += filt(rng.standard_normal(len(tn)), lo=2000) * k ** 2 * 0.25

# The final hit, then the tail.
add(drums, KB, at(62), 1.0); add(fx, BM, at(62), 1.0); add(fx, CR, at(62), 1.0); add(drums, CL, at(62), 0.8)
for m in [57, 64, 69, 72, 76]:
    tn = tt(DUR - 62 * B)
    for d in (-0.006, 0.0, 0.006):
        add(stabs_l, saw(hz(m), tn, d) * np.exp(-tn * 2.4), at(62), 0.03)
        add(stabs_r, saw(hz(m), tn, -d) * np.exp(-tn * 2.4), at(62), 0.03)

# ---------- Mix ----------
bass = filt(bass, lo=30, hi=900)
stabs_l = filt(stabs_l, lo=250, hi=6500); stabs_r = filt(stabs_r, lo=250, hi=6500)
arp = filt(arp, lo=400, hi=9000)

# Sidechain: everything melodic ducks under each kick, which gives the pump.
pos = np.arange(N)
kicks = np.array(kicks)
idx = np.searchsorted(kicks, pos, side='right') - 1
since = np.where(idx >= 0, (pos - kicks[np.clip(idx, 0, None)]) / SR, 10.0)
duck = 1 - 0.85 * np.exp(-since / 0.09)
bass *= duck; stabs_l *= duck; stabs_r *= duck; arp *= (0.5 + 0.5 * duck)

def reverb(x, seed, length=1.1, amt=0.12):
    r = np.random.default_rng(seed); L = int(length * SR)
    ir = r.standard_normal(L) * np.exp(-np.arange(L) / SR * 4.5); ir[0] = 0
    size = 1 << int(np.ceil(np.log2(len(x) + L)))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)] * amt * 0.08

left = drums + bass + stabs_l * 1.1 + arp * 0.9 + fx + hats_l + reverb(stabs_l + arp + drums * 0.3, 1)
right = drums + bass + stabs_r * 1.1 + arp * 0.9 + fx + hats_r + reverb(stabs_r + arp + drums * 0.3, 2)
st = np.stack([left, right], axis=1)

# Glue: gentle saturation, a short fade-out of the tail, normalise to -1 dBFS.
st = np.tanh(st * 1.4) / np.tanh(1.4)
tail = np.clip((DUR - pos / SR) / 0.25, 0, 1)
st *= tail[:, None]
st /= np.max(np.abs(st)) + 1e-9
st *= 10 ** (-1 / 20)
pcm = (st * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1], f'{DUR:.2f}s at {BPM} BPM')
