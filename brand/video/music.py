"""Original ambient music bed for the Ugent brand film: a warm pad, a soft plucked arpeggio,
a gentle sub bass and a light pulse, with a swell into each plan chapter.
Usage: python3 music.py timeline.json out.wav"""
import json, sys, wave
import numpy as np

SR = 44100
tl = json.load(open(sys.argv[1]))
DUR = tl['total'] + 0.5
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def hz(m):  # MIDI note to frequency
    return 440.0 * 2 ** ((m - 69) / 12)

# I - vi - IV - V flavour in C, with added 9ths for an open, modern colour. 8 s per chord.
CHORDS = [
    [48, 55, 64, 67, 71, 74],   # Cmaj9
    [45, 52, 60, 64, 67, 71],   # Am9
    [41, 48, 57, 60, 64, 67],   # Fmaj9
    [43, 50, 59, 62, 64, 69],   # G6/9
]
BAR = 8.0

def chord_at(x):
    return CHORDS[int(x // BAR) % len(CHORDS)]

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); acc = 0.0
    # vectorised one-pole via cumulative trick is unstable; a simple loop in chunks is fine for 110 s
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y

out = np.zeros(N)

# Pad: each chord fades in and out with long overlaps; slightly detuned voices for width.
pad = np.zeros(N)
for k in range(int(DUR // BAR) + 2):
    c0 = k * BAR
    env = np.clip((t - (c0 - 1.5)) / 2.5, 0, 1) * np.clip(((c0 + BAR + 1.5) - t) / 2.5, 0, 1)
    if env.max() == 0:
        continue
    for m in CHORDS[k % len(CHORDS)][1:]:
        f = hz(m)
        for det in (-0.12, 0.0, 0.13):
            ph = rng.uniform(0, 2 * np.pi)
            wv = np.sin(2 * np.pi * (f + det) * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * (f + det) * t + ph)
            pad += env * wv
pad *= 0.016 * (1 + 0.15 * np.sin(2 * np.pi * 0.07 * t))

# Sub bass: the chord root, softly.
bass = np.zeros(N)
for k in range(int(DUR // BAR) + 1):
    c0 = k * BAR
    seg = (t >= c0) & (t < c0 + BAR)
    f = hz(CHORDS[k % len(CHORDS)][0] - 12)
    env = np.clip((t - c0) / 0.4, 0, 1) * np.clip((c0 + BAR - t) / 0.6, 0, 1)
    bass += seg * env * np.sin(2 * np.pi * f * t)
bass *= 0.10

# Pluck arpeggio on eighth notes at 105 bpm, from the intro's end; quieter in the intro and outro tail.
pluck = np.zeros(N)
step = 60 / 105 / 2
pattern = [2, 3, 4, 5, 4, 3, 2, 4]
start = 5.5
n = 0
x = start
while x < DUR - 4:
    notes = chord_at(x)
    m = notes[pattern[n % len(pattern)]] + 12
    f = hz(m)
    i0 = int(x * SR); L = int(1.4 * SR)
    seg = np.arange(min(L, N - i0)) / SR
    tone = (np.sin(2 * np.pi * f * seg) + 0.35 * np.sin(2 * np.pi * 2 * f * seg) + 0.12 * np.sin(2 * np.pi * 3 * f * seg))
    vel = 0.75 + 0.25 * (n % 4 == 0)
    pluck[i0:i0 + len(seg)] += vel * tone * np.exp(-seg * 5.5) * np.clip(seg / 0.004, 0, 1)
    x += step; n += 1
pluck *= 0.030

# Light pulse: a soft low thump on each beat once the plans begin.
pulse = np.zeros(N)
beat = 60 / 105
x = 13.5
while x < DUR - 9:
    i0 = int(x * SR); L = int(0.35 * SR)
    seg = np.arange(min(L, N - i0)) / SR
    pulse[i0:i0 + len(seg)] += np.sin(2 * np.pi * (55 + 60 * np.exp(-seg * 30)) * seg) * np.exp(-seg * 12)
    x += beat
pulse *= 0.07

# Swells into each chapter: filtered noise rising for 1.6 s, then a bell-like chime on the title.
fx = np.zeros(N)
chapters = [s['start'] for s in tl['segs'] if s['type'] in ('chapter', 'outro')]
for c in chapters:
    a, b = int((c - 1.6) * SR), int(c * SR)
    if a < 0:
        continue
    noise = rng.standard_normal(b - a)
    for _ in range(3):  # three passes of smoothing: a soft, airy whoosh rather than hiss
        noise = np.convolve(noise, np.ones(48) / 48, mode='same')
    ramp = np.linspace(0, 1, b - a) ** 2
    fx[a:b] += noise * ramp * 0.9
    L = int(3.5 * SR); seg = np.arange(min(L, N - b)) / SR
    for m, g in ((84, 1.0), (91, 0.5), (96, 0.3)):
        fx[b:b + len(seg)] += g * np.sin(2 * np.pi * hz(m) * seg) * np.exp(-seg * 1.6) * 0.05
# Intro shimmer when the wordmark lands.
L = int(4 * SR); seg = np.arange(L) / SR
for m, g in ((72, 1.0), (79, 0.6), (84, 0.4), (88, 0.3)):
    fx[int(0.4 * SR):int(0.4 * SR) + L] += g * np.sin(2 * np.pi * hz(m) * seg) * np.exp(-seg * 0.9) * np.clip(seg / 0.6, 0, 1) * 0.035

mix = pad + bass + pluck + pulse + fx
mix = lowpass(mix, 6500)

# Simple stereo reverb: a decaying noise impulse, different per side.
def reverb(x, seed):
    r = np.random.default_rng(seed)
    L = int(2.4 * SR)
    ir = r.standard_normal(L) * np.exp(-np.arange(L) / SR * 2.6)
    ir[0] = 0
    size = 1 << int(np.ceil(np.log2(len(x) + L)))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)] * 0.012

left = mix + reverb(mix, 1)
right = mix + reverb(mix, 2)
stereo = np.stack([left, right], axis=1)

# Fade in, fade out, and normalise with headroom.
fade = np.clip(t / 1.2, 0, 1) * np.clip((DUR - 0.3 - t) / 3.0, 0, 1)
stereo *= fade[:, None]
stereo /= np.max(np.abs(stereo)) + 1e-9
stereo *= 0.82
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', sys.argv[2], f'{DUR:.1f}s')
