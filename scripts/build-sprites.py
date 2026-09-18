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

# Sets = skins. Each set maps type -> tier -> parts.
# eyes: list of (name, rel_x, rel_y, scale); rel coords relative to body bbox (0..1)
def classic():
    return {
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

COLOR = {'volt': 'yellow', 'frost': 'blue', 'blaze': 'red', 'venom': 'green', 'shadow': 'dark'}
BODIES = {'volt': ('A', 'A', 'D'), 'frost': ('B', 'B', 'F'), 'blaze': ('A', 'A', 'E'), 'venom': ('C', 'C', 'F'), 'shadow': ('D', 'D', 'E')}

def styled(body_color, eyes_fn, mouth, details_fn):
    """Generic set: same silhouettes as classic, different colors/faces."""
    out = {}
    for t, shapes in BODIES.items():
        c = body_color(t)
        out[t] = {}
        for tier in (1, 2, 3):
            out[t][tier] = dict(body=f'body_{c}{shapes[tier-1]}.png', eyes=eyes_fn(t, tier), mouth=mouth(t, tier), details=details_fn(t, tier))
    return out

def cute():
    # same colors, round cute eyes, happy mouths, ears growing with tier
    return styled(
        lambda t: COLOR[t],
        lambda t, tier: [('eye_cute_light.png', .36, .42, .7), ('eye_cute_light.png', .64, .42, .7)] if tier < 3 else [('eye_cute_dark.png', .5, .38, 1.0)],
        lambda t, tier: ('mouth_closed_happy.png', .5, .66, .9) if tier < 3 else ('mouthB.png', .5, .62, .9),
        lambda t, tier: [] if tier == 1 else [(f'detail_{COLOR[t]}_ear_round.png', .12, .12, 1, False), (f'detail_{COLOR[t]}_ear_round.png', .88, .12, 1, True)],
    )

def villains():
    # dark bodies, colored horns/eyes by type
    eye = {'volt': 'eye_angry_blue.png', 'frost': 'eye_angry_blue.png', 'blaze': 'eye_angry_red.png', 'venom': 'eye_angry_green.png', 'shadow': 'eye_red.png'}
    return styled(
        lambda t: 'dark',
        lambda t, tier: [(eye[t], .36, .42, .7), (eye[t], .64, .42, .7)] if tier < 3 else [(eye[t], .5, .38, 1.0)],
        lambda t, tier: ('mouth_closed_fangs.png', .5, .68, .9) if tier < 3 else ('mouthC.png', .5, .6, 1),
        lambda t, tier: [(f'detail_{COLOR[t]}_horn_small.png', .22, .04, 1, False), (f'detail_{COLOR[t]}_horn_small.png', .78, .04, 1, True)] if tier == 2
                        else [(f'detail_{COLOR[t]}_horn_large.png', .2, .0, 1.2, False), (f'detail_{COLOR[t]}_horn_large.png', .8, .0, 1.2, True)] if tier == 3 else [],
    )

def gold():
    # event skin: all-yellow bodies with a yellow antenna crown; face style by type
    eye = {'volt': 'eye_human.png', 'frost': 'eye_cute_light.png', 'blaze': 'eye_angry_red.png', 'venom': 'eye_psycho_light.png', 'shadow': 'eye_dead.png'}
    return styled(
        lambda t: 'yellow',
        lambda t, tier: [(eye[t], .36, .42, .7), (eye[t], .64, .42, .7)] if tier < 3 else [(eye[t], .5, .38, 1.0)],
        lambda t, tier: ('mouth_closed_happy.png', .5, .66, .9) if tier < 3 else ('mouthA.png', .5, .64, .9),
        lambda t, tier: [('detail_yellow_antenna_small.png', .3, .0, 1, False), ('detail_yellow_antenna_small.png', .7, .0, 1, True)] if tier == 2
                        else [('detail_yellow_antenna_large.png', .22, .0, 1, False), ('detail_yellow_antenna_large.png', .5, -.04, 1.1, False), ('detail_yellow_antenna_large.png', .78, .0, 1, True)] if tier == 3 else [],
    )

SETS = {'classic': classic, 'cute': cute, 'villains': villains, 'gold': gold}

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

# ---- Merge Defense towers: elemental monsters (one sprite per tower type)
def towers():
    E = {'fire': 'red', 'ice': 'blue', 'robot': 'dark', 'storm': 'white', 'nature': 'green'}
    def base(color, eye, mouth, detail=None):
        return dict(body=f'body_{color}A.png', eyes=[(eye, .36, .42, .7), (eye, .64, .42, .7)], mouth=(mouth, .5, .66, .9), details=detail or [])
    def tier2(color, eye, mouth, horn_color, extra=None):
        d = [(f'detail_{horn_color}_horn_small.png', .22, .04, 1, False), (f'detail_{horn_color}_horn_small.png', .78, .04, 1, True)] + (extra or [])
        return dict(body=f'body_{color}D.png', eyes=[(eye, .36, .4, .7), (eye, .64, .4, .7)], mouth=(mouth, .5, .64, .9), details=d)
    def tier3(color, eye, mouth, horn_color):
        d = [(f'detail_{horn_color}_horn_large.png', .18, .0, 1.2, False), (f'detail_{horn_color}_horn_large.png', .82, .0, 1.2, True),
             (f'detail_{horn_color}_antenna_large.png', .5, -.04, 1.1, False)]
        return dict(body=f'body_{color}F.png', eyes=[(eye, .5, .36, 1.0)], mouth=(mouth, .5, .6, 1), details=d)
    return {
      'fire':      base('red', 'eye_angry_red.png', 'mouth_closed_fangs.png'),
      'ice':       base('blue', 'eye_cute_light.png', 'mouth_closed_happy.png'),
      'robot':     base('dark', 'eye_human_blue.png', 'mouth_closed_teeth.png', [('detail_dark_antenna_small.png', .5, .0, 1, False)]),
      'storm':     base('white', 'eye_psycho_light.png', 'mouth_closed_sad.png'),
      'nature':    base('green', 'eye_human_green.png', 'mouth_closed_happy.png', [('detail_green_ear.png', .12, .12, 1, False), ('detail_green_ear.png', .88, .12, 1, True)]),
      'firebot':   tier2('dark', 'eye_angry_red.png', 'mouth_closed_fangs.png', 'red', [('detail_dark_antenna_small.png', .5, .0, 1, False)]),
      'firestorm': tier2('red', 'eye_psycho_light.png', 'mouthC.png', 'white'),
      'blizzard':  tier2('white', 'eye_cute_light.png', 'mouth_closed_happy.png', 'blue'),
      'cryobot':   tier2('blue', 'eye_human_blue.png', 'mouth_closed_teeth.png', 'dark', [('detail_dark_antenna_small.png', .5, .0, 1, False)]),
      'tesla':     tier2('dark', 'eye_psycho_light.png', 'mouthE.png', 'white', [('detail_white_antenna_large.png', .5, .0, 1, False)]),
      'wildfire':  tier2('green', 'eye_angry_red.png', 'mouth_closed_fangs.png', 'red'),
      'mechagod':  tier3('red', 'eye_red.png', 'mouthC.png', 'yellow'),
      'glacius':   tier3('white', 'eye_cute_dark.png', 'mouthB.png', 'blue'),
      'titan':     tier3('green', 'eye_psycho_dark.png', 'mouthJ.png', 'yellow'),
    }

tower_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'games', 'merge-td', 'towers')
os.makedirs(tower_dir, exist_ok=True)
tw = towers()
sheet = Image.new('RGBA', (128 * 5, 128 * 3), (30, 30, 40, 255))
for i, (name, recipe) in enumerate(tw.items()):
    img = compose(recipe).resize((128, 128), Image.LANCZOS)
    img.save(os.path.join(tower_dir, f'{name}.png'), optimize=True)
    sheet.alpha_composite(img, (128 * (i % 5), 128 * (i // 5)))
sheet.save(os.path.join(tower_dir, '_preview.png'))
print('towers ->', os.path.abspath(tower_dir))

for set_name, make in SETS.items():
    recipes = make()
    out_dir = os.path.join(OUT, set_name)
    os.makedirs(out_dir, exist_ok=True)
    sheet = Image.new('RGBA', (128 * 3, 128 * 5), (30, 30, 40, 255))
    for row, (t, tiers) in enumerate(recipes.items()):
        for tier, recipe in tiers.items():
            img = compose(recipe).resize((128, 128), Image.LANCZOS)
            img.save(os.path.join(out_dir, f'{t}_{tier}.png'), optimize=True)
            sheet.alpha_composite(img, (128 * (tier - 1), 128 * row))
    sheet.save(os.path.join(out_dir, '_preview.png'))
    print('set', set_name, '->', out_dir)
