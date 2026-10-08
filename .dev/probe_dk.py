import sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def probe(path, label):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    # green logo pixels in top 80 rows
    greens = sum(
        1 for x in range(0, min(w, 400), 3) for y in range(0, min(80, h), 3)
        if (lambda p: p[1] > 150 and p[0] < 90 and p[2] < 110)(im.getpixel((x, y)))
    )
    # "Good morning" white-ish text region brightness at rows 100-160
    white = sum(
        1 for x in range(120, 700, 4) for y in range(100, 170, 4)
        if sum(im.getpixel((x, y))) > 700
    )
    print(f'{label}: size={im.size} greenTop={greens} whiteText={white}')


probe('.dev/shots/dk_dash_full.png', 'FULL rows0..  (ref)')
probe('.dev/shots/v_dk1.png', 'v_dk1')
probe('.dev/shots/v_dk2.png', 'v_dk2')
probe('.dev/shots/v_dk3.png', 'v_dk3')
probe('.dev/shots/v_dk4.png', 'v_dk4')

# what is at rows 700..800 of FULL? header would have green logo
full = Image.open('.dev/shots/dk_dash_full.png').convert('RGB')
greens700 = sum(
    1 for x in range(0, 400, 3) for y in range(700, 780, 3)
    if (lambda p: p[1] > 150 and p[0] < 90 and p[2] < 110)(full.getpixel((x, y)))
)
print('FULL greenLogo@700-780:', greens700)
