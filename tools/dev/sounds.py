"""JOY-05: the sound pack, synthesised so nothing is borrowed. Usage: python tools/dev/sounds.py apps/mobile/assets/sounds"""
import sys
import wave

import numpy as np

OUT = sys.argv[1]
RATE = 22050


def save(name, signal):
    signal = signal / max(1e-9, np.max(np.abs(signal))) * 0.8
    pcm = (signal * 32767).astype(np.int16)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def t(seconds):
    return np.arange(int(RATE * seconds)) / RATE


def clink():
    # Two glasses: inharmonic partials with fast decay, the second a touch later and higher.
    out = np.zeros(int(RATE * 0.7))
    for delay, base in ((0.0, 2350.0), (0.035, 2610.0)):
        x = t(0.6)
        tone = sum(a * np.sin(2 * np.pi * base * r * x) * np.exp(-x * d) for a, r, d in ((1.0, 1.0, 9), (0.55, 1.47, 13), (0.3, 2.21, 18), (0.15, 3.05, 24)))
        start = int(RATE * delay)
        out[start : start + len(tone)] += tone
    return out


def pour():
    # Filtered noise that settles, with a few bubbles rising through it.
    rng = np.random.default_rng(7)
    x = t(0.8)
    noise = rng.normal(0, 1, len(x))
    kernel = np.ones(18) / 18
    body = np.convolve(noise, kernel, mode="same") * np.minimum(1, x * 12) * np.exp(-x * 2.5)
    for at in (0.12, 0.25, 0.33, 0.47, 0.58):
        b = t(0.05)
        f = 600 + 900 * b / 0.05
        bubble = np.sin(2 * np.pi * np.cumsum(f) / RATE) * np.exp(-b * 60) * 0.6
        i = int(RATE * at)
        body[i : i + len(bubble)] += bubble
    return body


def crown():
    # A short rising figure, soft attack, for a takeover or a new leader.
    out = np.zeros(int(RATE * 0.7))
    for i, freq in enumerate((523.25, 659.25, 783.99, 1046.5)):
        x = t(0.35)
        note = (np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(4 * np.pi * freq * x)) * np.minimum(1, x * 80) * np.exp(-x * 7)
        start = int(RATE * i * 0.09)
        out[start : start + len(note)] += note
    return out


save("clink", clink())
save("pour", pour())
save("crown", crown())
print("ok")
