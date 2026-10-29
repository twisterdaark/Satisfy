# Satisfy intro panels (pixel art, 480x270 saved x2): the VR boot grid, Winston's gate at dawn, the rumour, the
# legendary silhouette; plus the walker sprite
import math, random, os
from PIL import Image

W, H = 480, 270
OUT = os.path.join(os.path.dirname(__file__), "..", "sat", "ui")
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def dith(x, y, t):
    return t * 16 > BAYER[y % 4][x % 4] + 0.5

def lerp(a, b, t):
    t = max(0, min(1, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))

def save(img, name, k=2):
    img.resize((img.width * k, img.height * k), Image.NEAREST).save(os.path.join(OUT, name))
    print("saved", name)

def grad(img, stops, bands=12, y0=0, y1=None):
    p = img.load()
    y1 = y1 or img.height
    for y in range(y0, y1):
        v = (y - y0) / (y1 - y0)
        for i in range(len(stops) - 1):
            a, b = stops[i], stops[i + 1]
            if a[0] <= v <= b[0]:
                t = (v - a[0]) / (b[0] - a[0])
                break
        q = math.floor(t * bands) / bands
        f = t * bands - math.floor(t * bands)
        lo, hi = lerp(a[1], b[1], q), lerp(a[1], b[1], q + 1 / bands)
        for x in range(img.width):
            p[x, y] = hi if dith(x, y, f) else lo

def rect(p, x0, y0, x1, y1, c, w=W, h=H):
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            p[x, y] = c

# ---------- 1. the VR boot: a light grid floor running to a glowing horizon (transparent above) ----------
g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
p = g.load()
HZ = 120
for y in range(HZ - 30, HZ + 1):  # horizon glow
    t = 1 - (HZ - y) / 30
    for x in range(W):
        if dith(x, y, t * t * 0.7):
            p[x, y] = (90, 170, 255, int(60 + 120 * t))
for x in range(W):
    p[x, HZ] = hexc("#bfe6ff")
for i in range(1, 22):  # horizontal lines, closer together near the horizon
    z = i ** 1.9 * 0.35
    y = HZ + int(z)
    if y >= H:
        break
    a = min(255, 70 + i * 12)
    for x in range(W):
        p[x, y] = (110, 190, 255, a)
for k in range(-24, 25):  # lines to the vanishing point
    for y in range(HZ, H):
        x = int(W / 2 + k * 22 * (y - HZ) / (H - HZ))
        if 0 <= x < W:
            a = int(60 + 160 * (y - HZ) / (H - HZ))
            p[x, y] = (110, 190, 255, a)
save(g, "in_grid.png")

# ---------- 2. Winston's gate at dawn ----------
gate = Image.new("RGBA", (W, H), (0, 0, 0, 255))
grad(gate, [(0, hexc("#1d2a6b")), (0.35, hexc("#5a4a9a")), (0.62, hexc("#e0787a")), (0.8, hexc("#ffb36b")), (1, hexc("#ffd59a"))], 14, 0, 190)
p = gate.load()
r = random.Random(2)
for _ in range(40):
    x, y = r.randrange(W), r.randrange(70)
    p[x, y] = hexc("#e8eeff")
# the sun rising behind the walls
SX, SY = 240, 150
for y in range(100, 200):
    for x in range(170, 310):
        d = math.hypot(x - SX, y - SY)
        if d < 22:
            p[x, y] = hexc("#fff3c4") if d < 18 else hexc("#ffe08a")
        elif d < 60 and dith(x, y, (1 - (d - 22) / 38) ** 2 * 0.7):
            p[x, y] = lerp(p[x, y], hexc("#fff0b8"), 0.6)
# distant hills
for x in range(W):
    top = 168 + 8 * math.sin(x / 40) + 4 * math.sin(x / 13 + 1)
    for y in range(int(top), 200):
        p[x, y] = hexc("#7a4a78")
# the walls and the gatehouse
WALL, WALL2, LIT, DARK = hexc("#3b2d55"), hexc("#2c2242"), hexc("#ff9f6a"), hexc("#1a1430")
rect(p, 0, 160, W, 215, WALL)
for x in range(0, W, 10):
    rect(p, x, 154, x + 6, 160, WALL)
for x in range(0, W, 16):  # stone courses
    for y in range(166, 215, 8):
        rect(p, x + (8 if (y // 8) % 2 else 0), y, x + (8 if (y // 8) % 2 else 0) + 1, y + 8, WALL2)
rect(p, 0, 160, W, 162, LIT)
def tower(cx, w, top):
    rect(p, cx - w // 2, top, cx + w // 2, 215, WALL)
    rect(p, cx - w // 2, top, cx + w // 2, top + 2, LIT)
    for x in range(cx - w // 2, cx + w // 2, 7):
        rect(p, x, top - 6, x + 4, top, WALL)
    rect(p, cx - 3, top + 14, cx + 3, top + 22, hexc("#ffd25a"))
    # banner
    rect(p, cx - 5, top + 28, cx + 5, top + 52, hexc("#2d4fb0"))
    rect(p, cx - 5, top + 28, cx + 5, top + 30, hexc("#e8b23a"))
    for i in range(5):
        rect(p, cx - 5 + i, top + 52 + i, cx + 5 - i, top + 53 + i, hexc("#2d4fb0"))
    rect(p, cx - 2, top + 36, cx + 2, top + 42, hexc("#e8b23a"))
tower(165, 46, 112)
tower(315, 46, 112)
rect(p, 188, 128, 292, 215, WALL)
rect(p, 188, 128, 292, 130, LIT)
for x in range(188, 292, 8):
    rect(p, x, 122, x + 5, 128, WALL)
# the open gate: an arch with light coming through
for y in range(150, 215):
    for x in range(214, 266):
        if (x - 240) ** 2 / 676 + (y - 170) ** 2 / 400 <= 1 or y >= 170:
            t = (y - 150) / 65
            p[x, y] = lerp(hexc("#ffe6a8"), hexc("#ffb36b"), t)
for x in range(214, 266, 6):  # the raised portcullis
    rect(p, x, 150, x + 2, 157, DARK)
rect(p, 214, 156, 266, 158, DARK)
# the road
for y in range(215, H):
    t = (y - 215) / (H - 215)
    half = int(26 + t * 120)
    for x in range(W):
        if abs(x - 240) < half:
            p[x, y] = hexc("#8a6a5a") if dith(x, y, 0.3 + 0.4 * t) else hexc("#6e5250")
        else:
            p[x, y] = hexc("#3a5a3a") if dith(x, y, t) else hexc("#2e4a34")
# grass edge tufts and torches
for x in range(0, W, 3):
    if r.random() < 0.5 and abs(x - 240) > 30:
        rect(p, x, 213, x + 1, 216, hexc("#2e4a34"))
for tx in (204, 274):
    rect(p, tx, 176, tx + 2, 196, hexc("#4a3020"))
    rect(p, tx - 1, 170, tx + 3, 177, hexc("#ffcf5a"))
    rect(p, tx, 167, tx + 2, 171, hexc("#fff0a0"))
save(gate, "in_gate.png")

# ---------- 3. the walker: a small figure seen from behind, two steps ----------
for f in range(2):
    s = Image.new("RGBA", (16, 28), (0, 0, 0, 0))
    q = s.load()
    C = hexc("#141028")
    def r2(x0, y0, x1, y1):
        rect(q, x0, y0, x1, y1, C, 16, 28)
    r2(5, 1, 11, 7)  # head
    r2(4, 7, 12, 17)  # body and cloak
    r2(3, 9, 4, 16)
    r2(12, 9, 13, 16)
    if f == 0:
        r2(5, 17, 7, 27)
        r2(9, 17, 11, 25)
    else:
        r2(5, 17, 7, 25)
        r2(9, 17, 11, 27)
    for y in range(1, 17):  # rim light from the gate
        for x in range(16):
            if q[x, y][3] and (x + 1 >= 16 or q[x + 1, y][3] == 0):
                q[x, y] = hexc("#ffb36b")
    save(s, "in_walk%d.png" % (f + 1), 4)

# ---------- 4. the rumour: a hooded smith at a forge, glowing eyes ----------
rm = Image.new("RGBA", (W, H), (0, 0, 0, 255))
grad(rm, [(0, hexc("#05040c")), (0.6, hexc("#120a1e")), (1, hexc("#2a0f14"))], 10)
p = rm.load()
FX, FY = 300, 200  # the forge's fire
for y in range(H):
    for x in range(W):
        d = math.hypot((x - FX) * 0.8, y - FY)
        if d < 110 and dith(x, y, (1 - d / 110) ** 1.6):
            p[x, y] = lerp(p[x, y], hexc("#ff5a1e"), 0.55)
for y in range(185, 215):
    for x in range(265, 335):
        if (x - 300) ** 2 / 1225 + (y - 215) ** 2 / 400 <= 1:
            p[x, y] = hexc("#ffcf5a") if (x + y) % 5 else hexc("#ff7a2a")
rect(p, 255, 213, 345, 270, hexc("#1a0c10"))
rect(p, 255, 213, 345, 215, hexc("#ff7a2a"))
from PIL import ImageDraw
dr = ImageDraw.Draw(rm)
SIL, RIMC = hexc("#07050d"), hexc("#ff8a3a")
# the anvil in front of the fire
dr.polygon([(196, 214), (300, 214), (312, 206), (300, 222), (284, 222), (276, 236), (290, 250), (206, 250), (220, 236), (212, 222), (196, 222)], fill=SIL)
dr.line([(196, 214), (300, 214), (312, 206)], fill=RIMC)
# the hooded smith in profile, facing the anvil: hood, back, cloak to the ground
dr.polygon([(120, 270), (112, 200), (118, 150), (128, 118), (140, 96), (152, 84), (168, 82), (180, 90), (186, 104),
            (184, 118), (176, 124), (182, 150), (192, 196), (204, 270)], fill=SIL)
# the hood's opening and the face in shadow
dr.polygon([(168, 92), (182, 100), (184, 114), (174, 120)], fill=hexc("#020104"))
# the arm up, the hammer over the head
dr.polygon([(170, 128), (184, 122), (214, 84), (222, 88), (194, 132), (178, 140)], fill=SIL)
dr.rectangle([(212, 66), (238, 82)], fill=SIL)
dr.line([(214, 84), (222, 88)], fill=SIL, width=3)
# rim light on the side facing the fire
for x0, y0, x1, y1 in [(186, 104, 184, 118), (176, 124, 182, 150), (182, 150, 192, 196), (192, 196, 204, 270),
                       (184, 122, 214, 84), (238, 66, 238, 82), (212, 66, 238, 66)]:
    dr.line([(x0, y0), (x1, y1)], fill=RIMC)
# glowing eyes inside the hood
p = rm.load()
for ex in (175, 180):
    rect(p, ex, 106, ex + 2, 108, hexc("#ffe27a"))
# sparks
sr = random.Random(5)
for _ in range(60):
    x, y = 180 + sr.randrange(160), 60 + sr.randrange(160)
    p[x, y] = sr.choice([hexc("#ffcf5a"), hexc("#ff8a3a"), hexc("#fff0a0")])
save(rm, "in_rumor.png")

# ---------- 5. the legendary silhouette: a dark figure in a golden burst (square, transparent outside) ----------
S = 200
lg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
p = lg.load()
C0 = S // 2
for y in range(S):
    for x in range(S):
        dx, dy = x - C0, y - C0
        d = math.hypot(dx, dy)
        a = math.atan2(dy, dx)
        ray = (math.cos(a * 12) + 1) / 2
        t = max(0, 1 - d / 98)
        if t > 0 and dith(x, y, t * (0.35 + 0.65 * ray) * 0.9):
            p[x, y] = lerp(hexc("#ff9a2a", 180), hexc("#fff0a0", 255), t)
# the figure: a cloaked hero holding a long blade, black
FIG = hexc("#05040a")
for y in range(40, 186):
    if y < 70:
        half = int(13 * math.sqrt(max(0, 1 - ((y - 56) / 15) ** 2)))
        cx = C0
    else:
        half = int(18 + (y - 70) * 0.28)
        cx = C0
    for x in range(cx - half, cx + half):
        p[x, y] = FIG
for y in range(70, 150):  # cape flaring right
    for x in range(C0 + 15, C0 + 15 + int((y - 70) * 0.45)):
        p[x, y] = FIG
rect(p, C0 + 44, 70, C0 + 47, 186, FIG, S, S)  # a greatsword planted at its side
rect(p, C0 + 38, 78, C0 + 53, 81, FIG, S, S)
rect(p, C0 + 43, 62, C0 + 48, 70, FIG, S, S)
# eyes
rect(p, C0 - 6, 54, C0 - 2, 56, hexc("#9fe0ff"), S, S)
rect(p, C0 + 3, 54, C0 + 7, 56, hexc("#9fe0ff"), S, S)
save(lg, "in_legend.png")
