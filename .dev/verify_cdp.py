import os
from PIL import Image

T = os.environ['TEMP'] + r'\opencode'
fails = []

def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (' | ' + str(detail) if detail else ''))
    if not cond:
        fails.append(name)

def dark_count(im, x0, y0, x1, y1, thr=110):
    n = 0
    px = im.load()
    for x in range(x0, x1):
        for y in range(y0, y1):
            r, g, b = px[x, y][:3]
            if r < thr and g < thr and b < thr:
                n += 1
    return n

def strip_is(im, x, y, tol=12):
    p = im.load()[x, y]
    return p

# 1) mobile history (content-only harness): no rail, header content inside frame
im = Image.open(os.path.join(T, 'cdp-m390-history.png')).convert('RGB')
check('m390-history size 780x1688', im.size == (780, 1688), im.size)
px = im.load()
check('m390 no sidebar rail (left = page bg)', abs(px[6, 600][0] - 245) < 8 and abs(px[6, 600][2] - 248) < 8, px[6, 600])
navy_right = 0
for x in range(780):
    for y in range(0, 260):
        r, g, b = px[x, y]
        if r < 60 and g < 80 and 40 < b < 120:
            navy_right = max(navy_right, x)
check('m390 header navy (btn/bell) inside frame', navy_right < 770, navy_right)

# 2) mobile drawer: white panel + dark backdrop + visible labels
im = Image.open(os.path.join(T, 'cdp-m390-shell-drawer.png')).convert('RGB')
px = im.load()
check('m390-drawer white panel', px[150, 700][0] > 245 and px[150, 700][1] > 245 and px[150, 700][2] > 245, px[150, 700])
check('m390-drawer backdrop darker', px[730, 1000][0] < 210, px[730, 1000])
lbl = dark_count(im, 60, 400, 560, 1600, 120)
check('m390-drawer labels visible (dark text px)', lbl > 300, lbl)

# 3) mobile dashboard (content-only harness): cards present
im = Image.open(os.path.join(T, 'cdp-m390-dashboard.png')).convert('RGB')
px = im.load()
check('m390-dash no rail', abs(px[6, 600][0] - 245) < 8, px[6, 600])
white_cards = sum(1 for x in range(40, 740, 20) for y in range(500, 1400, 40) if px[x, y] == (255, 255, 255))
check('m390-dash cards present', white_cards > 40, white_cards)

# 4) tablet 768: rail present, no hamburger
im = Image.open(os.path.join(T, 'cdp-t768-shell-drawer.png')).convert('RGB')
px = im.load()
check('t768 size 1536x2048', im.size == (1536, 2048), im.size)
check('t768 rail white strip', px[40, 700][0] > 245 and px[40, 700][2] > 245, px[40, 700])
check('t768 rail ends (x=140 = bg)', abs(px[140, 700][0] - 245) < 10, px[140, 700])

# 5) desktop 1440: content fits frame (content-only harness)
im = Image.open(os.path.join(T, 'cdp-d1440-history.png')).convert('RGB')
px = im.load()
check('d1440 size 2880x1800', im.size == (2880, 1800), im.size)

print()
print('TOTAL FAILS:', len(fails), fails)
