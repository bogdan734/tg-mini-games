"""Compose unit sprites from Kenney's Monster Builder Pack (CC0).
Usage: python3 scripts/build-sprites.py <path/to/mbp/PNG/Default>
Writes public/games/snake-td/units/<type>_<tier>.png (128x128) and a preview sheet.
"""
import sys, os
from PIL import Image, ImageOps

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'games', 'snake-td', 'units')
os.makedirs(OUT, exist_ok=True)

def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')

# type -> tier -> parts. eyes: list of (name, rel_x, rel_y, scale). rel coords relative to body bbox (0..1)
RECIPES = {
  'volt': {
    1: dict(body='body_yellowA.png', eyes=[('eye_human.png', .5, .42, .8)], mouth=('mouth_closed_happy.png', .5, .68, .9), details=[]),
    2: dict(body='body_yellowA.png', eyes=[('eye_human.png', .5, .42, .8)], mouth=('mouth_closed_happy.png', .5, .68, .9),
            details=[('detail_yellow_antenna_small.png', .3, .0, 1, False), ('detail_yellow_antenna_small.png', .7, .0, 1, True)]),
    3: dict(body='body_yellowD.png', eyes=[('eye_angry_blue.png', .36, .4, .7), ('eye_angry_blue.png', .64, .4, .7)], mouth=('mouthA.png', .5, .66, .9),
            details=[('detail_yellow_antenna_large.png', .28, .0, 1, False), ('detail_yellow_antenna_large.png', .72, .0, 1, True)]),
  },
  'frost': {
    1: dict(body='body_blueB.png', eyes=[('eye_cute_light.png', .36, .42, .7), ('eye_cute_light.png', .64, .42, .7)], mouth=('mouth_closed_happy.png', .5, .66, .9), details=[]),
    2: dict(body='body_blueB.png', eyes=[('eye_cute_light.png', .36, .42, .7), ('eye_cute_light.png', .64, .42, .7)], mouth=('mouth_closed_happy.png', .5, .66, .9),
            details=[('detail_blue_ear_round.png', .12, .12, 1, False), ('detail_blue_ear_round.png', .88, .12, 1, True)]),
    3: dict(body='body_blueF.png', eyes=[('eye_cute_dark.png', .5, .38, 1.0)], mouth=('mouth_closed_fangs.png', .5, .62, 1),
            details=[('detail_blue_horn_large.png', .22, .02, 1.1, False), ('detail_blue_horn_large.png', .78, .02, 1.1, True)]),
  },
  'blaze': {
    1: dict(body='body_redA.png', eyes=[('eye_angry_red.png', .36, .42, .7), ('eye_angry_red.png', .64, .42, .7)], mouth=('mouth_closed_fangs.png', .5, .68, .9), details=[]),
    2: dict(body='body_redA.png', eyes=[('eye_angry_red.png', .36, .42, .7), ('eye_angry_red.png', .64, .42, .7)], mouth=('mouth_closed_fangs.png', .5, .68, .9),
            details=[('detail_red_horn_small.png', .22, .04, 1, False), ('detail_red_horn_small.png', .78, .04, 1, True)]),
    3: dict(body='body_redE.png', eyes=[('eye_red.png', .5, .34, .9)], mouth=('mouthC.png', .5, .58, 1),
            details=[('detail_red_horn_large.png', .2, .0, 1.2, False), ('detail_red_horn_large.png', .8, .0, 1.2, True)]),
  },
  'venom': {
    1: dict(body='body_greenC.png', eyes=[('eye_psycho_light.png', .5, .36, .8)], mouth=('mouth_closed_teeth.png', .5, .6, .9), details=[]),
    2: dict(body='body_greenC.png', eyes=[('eye_psycho_light.png', .5, .36, .8)], mouth=('mouth_closed_teeth.png', .5, .6, .9),
            details=[('snot_small.png', .5, .48, .8, False)]),
    3: dict(body='body_greenF.png', eyes=[('eye_psycho_dark.png', .5, .34, .9)], mouth=('mouthE.png', .5, .6, 1),
            details=[('detail_green_antenna_large.png', .5, .0, 1, False), ('snot_large.png', .5, .48, .9, False)]),
  },
  'shadow': {
    1: dict(body='body_darkD.png', eyes=[('eye_dead.png', .36, .4, .7), ('eye_dead.png', .64, .4, .7)], mouth=('mouth_closed_sad.png', .5, .66, .9), details=[]),
    2: dict(body='body_darkD.png', eyes=[('eye_dead.png', .36, .4, .7), ('eye_dead.png', .64, .4, .7)], mouth=('mouth_closed_sad.png', .5, .66, .9),
            details=[('detail_dark_ear.png', .1, .1, 1, False), ('detail_dark_ear.png', .9, .1, 1, True)]),
    3: dict(body='body_darkE.png', eyes=[('eye_red.png', .5, .3, 1)], mouth=('mouthJ.png', .5, .56, 1),
            details=[('detail_dark_horn_large.png', .2, .0, 1.2, False), ('detail_dark_horn_large.png', .8, .0, 1.2, True)]),
  },
}

CANVAS = 300
BODY_H = 210

def paste_centered(canvas, part, cx, cy, scale=1.0, mirror=False):
    if scale != 1.0:
        part = part.resize((max(1, int(part.width * scale)), max(1, int(part.height * scale))), Image.LANCZOS)
    if mirror:
        part = ImageOps.mirror(part)
    canvas.alpha_composite(part, (int(cx - part.width / 2), int(cy - part.height / 2)))

def compose(recipe):
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    body = load(recipe['body'])
    k = BODY_H / body.height
    body = body.resize((int(body.width * k), BODY_H), Image.LANCZOS)
    bx = (CANVAS - body.width) // 2
    by = CANVAS - 20 - body.height
    for name, rx, ry, sc, mirror in recipe['details']:
        d = load(name)
        # anchor details by their bottom center at (rx, ry) on the body bbox
        d = d.resize((int(d.width * sc * k * 1.3), int(d.height * sc * k * 1.3)), Image.LANCZOS)
        if mirror: d = ImageOps.mirror(d)
        canvas.alpha_composite(d, (int(bx + body.width * rx - d.width / 2), int(by + body.height * ry - d.height * 0.75)))
    canvas.alpha_composite(body, (bx, by))
    for name, rx, ry, sc in recipe['eyes']:
        paste_centered(canvas, load(name), bx + body.width * rx, by + body.height * ry, sc * k * 1.2)
    name, rx, ry, sc = recipe['mouth']
    paste_centered(canvas, load(name), bx + body.width * rx, by + body.height * ry, sc * k * 1.2)
    return canvas

sheet = Image.new('RGBA', (128 * 3, 128 * 5), (30, 30, 40, 255))
for row, (t, tiers) in enumerate(RECIPES.items()):
    for tier, recipe in tiers.items():
        img = compose(recipe).resize((128, 128), Image.LANCZOS)
        img.save(os.path.join(OUT, f'{t}_{tier}.png'), optimize=True)
        sheet.alpha_composite(img, (128 * (tier - 1), 128 * row))
sheet.save(os.path.join(OUT, '_preview.png'))
print('sprites written to', os.path.abspath(OUT))
