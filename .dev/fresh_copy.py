import os
import sys
import time

from PIL import Image

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

base = os.path.dirname(os.path.abspath(__file__))
shots = os.path.join(base, 'shots')
tag = 'r' + time.strftime('%H%M%S') + f'{int(time.time() * 1000) % 1000:03d}'
outdir = os.path.join(shots, tag)
os.makedirs(outdir, exist_ok=True)

src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(shots, 'w_a_0.png')
im = Image.open(src).convert('RGB')
out = os.path.join(outdir, 'seg.png')
im.save(out)
print(out)
