# Satisfy title scene: pixel-art parallax layers at 480x270, saved x2 (nearest) to sat/ui/ts_*.png
import math, random, os
from PIL import Image

W, H = 480, 270
OUT = os.path.join(os.path.dirname(__file__), "..", "sat", "ui")
rnd = random.Random(7)

def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def new(opaque=False):
    return Image.new("RGBA", (W, H), (0, 0, 0, 255 if opaque else 0))

def save(img, name):
    img.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(OUT, name))
    print("saved", name)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def dith(x, y, t):  # t in 0..1: true when this pixel takes the second colour
    return t * 16 > BAYER[y % 4][x % 4] + 0.5

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))

# ---------- 1. sky: banded night gradient, stars, the moon ----------
sky = new(True)
px = sky.load()
stops = [(0, hexc("#060a1c")), (0.35, hexc("#0d1536")), (0.6, hexc("#1c2558")), (0.78, hexc("#3a3170")), (1.0, hexc("#5a3f7a"))]
BANDS = 14
def skycol(y):
    v = y / (H * 0.85)
    v = min(1, v)
    for i in range(len(stops) - 1):
        a, b = stops[i], stops[i + 1]
        if a[0] <= v <= b[0]:
            return a[1], b[1], (v - a[0]) / (b[0] - a[0])
    return stops[-1][1], stops[-1][1], 0
for y in range(H):
    c1, c2, t = skycol(y)
    q = math.floor(t * BANDS) / BANDS
    f = t * BANDS - math.floor(t * BANDS)
    lo, hi = lerp(c1, c2, q), lerp(c1, c2, min(1, q + 1 / BANDS))
    for x in range(W):
        px[x, y] = hi if dith(x, y, f) else lo
# stars
for _ in range(170):
    x, y = rnd.randrange(W), rnd.randrange(int(H * 0.62))
    b = rnd.random()
    c = hexc("#ffffff") if b > 0.85 else hexc("#bcd2ff") if b > 0.45 else hexc("#6f84c4")
    px[x, y] = c
for _ in range(9):  # bright crosses
    x, y = rnd.randrange(8, W - 8), rnd.randrange(8, int(H * 0.5))
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        px[x + dx, y + dy] = hexc("#ffffff") if (dx, dy) == (0, 0) else hexc("#9fc0ff")
# moon with a dithered halo
MX, MY, MR = 92, 54, 17
for y in range(MY - 70, MY + 70):
    for x in range(MX - 70, MX + 70):
        if not (0 <= x < W and 0 <= y < H):
            continue
        d = math.hypot(x - MX, y - MY)
        if d <= MR:
            shade = (MX - x + y - MY) / (2 * MR)  # lighter top-right
            c = hexc("#fff6d8") if shade < -0.25 else hexc("#f3e3b0") if shade < 0.35 else hexc("#d8c48e")
            px[x, y] = c
        elif d <= MR + 40:
            t = 1 - (d - MR) / 40
            if dith(x, y, t * t * 0.6):
                px[x, y] = lerp(px[x, y], hexc("#8f8ad0"), 0.5)
for cx, cy, r in [(86, 50, 3), (98, 60, 4), (91, 63, 2), (100, 47, 2)]:
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if math.hypot(x - cx, y - cy) <= r:
                px[x, y] = hexc("#cdb57c")
save(sky, "ts_sky.png")

# ---------- helpers for tileable ridges ----------
def ridge(base, amps, seed):
    r = random.Random(seed)
    waves = [(a, k, r.random() * math.tau) for a, k in amps]
    return [base + sum(a * math.sin(math.tau * k * x / W + p) for a, k, p in waves) for x in range(W)]

# ---------- 2. mountains (two ranges, snow caps, rim light from the moon side) ----------
mtn = new()
px = mtn.load()
far = ridge(150, [(22, 2), (12, 5), (5, 11), (2, 23)], 1)
near = ridge(172, [(18, 3), (9, 7), (4, 13), (2, 29)], 2)
for x in range(W):
    for y in range(int(far[x]), H):
        px[x, y] = hexc("#2a2c66")
        if y < far[x] + 9 and far[x] < 140 and dith(x, y, 0.7 - (y - far[x]) / 12):
            px[x, y] = hexc("#8e93d6")  # snow
    slope = near[(x + 1) % W] - near[x - 1]
    for y in range(int(near[x]), H):
        px[x, y] = hexc("#1b1d4a")
        if y < near[x] + 2 and slope < -0.4:
            px[x, y] = hexc("#4b4f9c")  # lit edge
        if y < near[x] + 7 and near[x] < 160 and dith(x, y, 0.65 - (y - near[x]) / 10):
            px[x, y] = hexc("#7d82c8")
save(mtn, "ts_mtn.png")

# ---------- 3. the castle on its hill (not tiled) ----------
cas = new()
px = cas.load()
DARK, MID, RIM, WIN, WIN2 = hexc("#10123a"), hexc("#181b4c"), hexc("#3d4592"), hexc("#ffd25a"), hexc("#ff9a3a")
def rect(x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            px[x, y] = c
# hill
for x in range(250, 480):
    t = (x - 375) / 125
    top = 196 - 26 * math.cos(t * math.pi / 2) ** 1.6 if abs(t) < 1 else 230
    for y in range(int(top), H):
        px[x, y] = DARK
CX = 375
def tower(cx, w, top, roof=True):
    rect(cx - w // 2, top, cx + w // 2, 200, MID)
    rect(cx - w // 2, top, cx - w // 2 + 2, 200, RIM)  # moonlit left edge
    if roof:
        h = w + 6
        for i in range(h):
            half = int((w // 2 + 2) * (1 - i / h))
            for x in range(cx - half, cx + half + 1):
                px[x, top - 1 - i] = DARK if x > cx - half + 1 else RIM
        # flag
        fx, fy = cx, top - h - 1
        rect(fx, fy - 9, fx + 1, fy, hexc("#8a90c8"))
        rect(fx + 1, fy - 9, fx + 7, fy - 5, hexc("#c8303a"))
        rect(fx + 1, fy - 8, fx + 6, fy - 6, hexc("#e8b23a"))
    else:
        for x in range(cx - w // 2, cx + w // 2, 4):
            rect(x, top - 3, x + 2, top, MID)
# curtain wall
rect(CX - 70, 168, CX + 70, 200, MID)
for x in range(CX - 70, CX + 70, 5):
    rect(x, 164, x + 3, 168, MID)
rect(CX - 70, 164, CX - 68, 200, RIM)
# gate
for y in range(178, 200):
    for x in range(CX - 7, CX + 7):
        if (x - CX) ** 2 / 49 + (y - 184) ** 2 / 64 <= 1 or y >= 184:
            px[x, y] = hexc("#07081e")
rect(CX - 6, 196, CX + 6, 200, hexc("#ffb347"))
# keep and towers
tower(CX, 34, 118)
tower(CX - 44, 18, 140)
tower(CX + 44, 18, 140)
tower(CX - 72, 14, 154, roof=False)
tower(CX + 72, 14, 154, roof=False)
tower(CX - 18, 12, 128)
tower(CX + 18, 12, 128)
# windows (lit, a few dark)
wr = random.Random(3)
for wx, wy in [(CX - 8, 130), (CX + 4, 130), (CX - 8, 146), (CX + 4, 146), (CX - 2, 160), (CX - 46, 152), (CX + 42, 152),
               (CX - 46, 168), (CX + 42, 168), (CX - 20, 140), (CX + 16, 140), (CX - 74, 166), (CX + 70, 166),
               (CX - 40, 182), (CX + 36, 182), (CX - 56, 180), (CX + 52, 180)]:
    c = WIN if wr.random() > 0.25 else WIN2
    rect(wx, wy, wx + 3, wy + 5, c)
    rect(wx, wy, wx + 3, wy + 1, hexc("#fff0b0"))
# a winding path up the hill with lanterns
for i in range(70):
    t = i / 69
    x = int(CX + 40 * math.sin(t * 5) * (1 - t) )
    y = int(200 + t * 70)
    for dx in range(-1 - int(t * 3), 2 + int(t * 3)):
        if 0 <= x + dx < W and y < H:
            px[x + dx, y] = hexc("#2a2550")
for t in (0.25, 0.55, 0.85):
    x = int(CX + 40 * math.sin(t * 5) * (1 - t)) + 6
    y = int(200 + t * 70)
    rect(x, y - 6, x + 1, y, hexc("#3a3a6a"))
    rect(x - 1, y - 8, x + 2, y - 5, hexc("#ffcf5a"))
save(cas, "ts_castle.png")

# ---------- 4. pine forest band (tileable) ----------
def pines(img, base, hmin, hmax, colour, rim, count, seed, fill_to=H):
    r = random.Random(seed)
    p = img.load()
    for x in range(W):
        for y in range(int(base[x]), fill_to):
            p[x, y] = colour
    for _ in range(count):
        cx = r.randrange(W)
        h = r.randint(hmin, hmax)
        top = int(base[cx]) - h
        for i in range(h):
            half = max(0, int((i / h) * h * 0.32) - (i % 6 == 5))
            for dx in range(-half, half + 1):
                x = (cx + dx) % W
                y = top + i
                if 0 <= y < H:
                    p[x, y] = rim if dx == half and half > 1 else colour
        for y in range(top + h, min(H, top + h + 3)):
            p[cx % W, y] = colour
trees = new()
pines(trees, ridge(214, [(6, 2), (3, 5), (2, 9)], 4), 14, 30, hexc("#0c0f2e"), hexc("#262f6a"), 95, 5)
save(trees, "ts_trees.png")

# ---------- 5. foreground (tileable): a dark grassy rise and big pines at the edges ----------
front = new()
pines(front, ridge(250, [(5, 1), (3, 3), (2, 7)], 6), 34, 70, hexc("#05071a"), hexc("#141a44"), 9, 8)
p = front.load()
gr = random.Random(9)
for x in range(W):  # grass tufts on the rise
    if gr.random() < 0.35:
        y0 = next((y for y in range(H) if p[x, y][3] > 0), H)
        for k in range(gr.randint(1, 4)):
            if y0 - k - 1 >= 0:
                p[x, y0 - k - 1] = hexc("#05071a")
# fireflies
for _ in range(16):
    x, y = gr.randrange(W), gr.randrange(205, 262)
    p[x, y] = hexc("#ffe27a")
save(front, "ts_front.png")

# ---------- 6. fog band (tileable, dithered, three strengths) ----------
fog = new()
p = fog.load()
for x in range(W):
    for y in range(H):
        c = 226 + 6 * math.sin(math.tau * 2 * x / W) + 4 * math.sin(math.tau * 5 * x / W + 1)
        d = abs(y - c) / 16
        t = max(0, 1 - d)
        if t > 0 and dith(x, y, t * 0.6):
            a = 50 if t < 0.4 else 80 if t < 0.75 else 110
            p[x, y] = (150, 165, 230, a)
save(fog, "ts_fog.png")
