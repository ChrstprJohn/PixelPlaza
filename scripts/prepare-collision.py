"""Extract ground-contact collision masks from the exact runtime prop artwork."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
result = {}
for theme in ['garden', 'haunted']:
    art = json.loads((ROOT / 'frontend/src/scenery-art.json').read_text(encoding='utf-8'))[theme]
    sheet = Image.open(ROOT / 'frontend/public' / art['image'].split('?')[0].lstrip('/')).convert('RGBA')
    result[theme] = {}
    for kind, frames in art['frames'].items():
        frame = frames[0]
        alpha = sheet.crop((frame['x'], frame['y'], frame['x'] + frame['width'], frame['y'] + frame['height'])).getchannel('A')
        bounds = alpha.point(lambda value: 255 if value >= 160 else 0).getbbox()
        ground_fraction = {'tree': .27, 'cherry': .24, 'bush': .55}.get(kind, 1)
        first = round(bounds[3] - (bounds[3] - bounds[1]) * ground_fraction)
        rows = []
        for y in range(alpha.height):
            spans, start = [], None
            for x in range(alpha.width + 1):
                solid = y >= first and x < alpha.width and alpha.getpixel((x, y)) >= 160
                if solid and start is None:
                    start = x
                elif not solid and start is not None:
                    spans.extend([start, x])
                    start = None
            rows.append(spans)
        result[theme][kind] = {**{key: frame[key] for key in ['width', 'height', 'anchorX', 'anchorY']}, 'bodyHeight': art['characterHeights'][kind], 'rows': rows}
    characters = json.loads((ROOT / ('frontend/src/haunted-art.json' if theme == 'haunted' else 'frontend/src/character-art.json')).read_text(encoding='utf-8'))
    character_sheet = Image.open(ROOT / 'frontend/public' / characters['image'].split('?')[0].lstrip('/')).convert('RGBA')
    result[theme]['actors'] = {}
    for name, frames in characters['frames'].items():
        frame = frames[0]
        alpha = character_sheet.crop((frame['x'], frame['y'], frame['x'] + frame['width'], frame['y'] + frame['height'])).getchannel('A')
        rows = []
        for y in range(alpha.height):
            spans, start = [], None
            for x in range(alpha.width + 1):
                solid = x < alpha.width and alpha.getpixel((x, y)) >= 160
                if solid and start is None:
                    start = x
                elif not solid and start is not None:
                    spans.extend([start, x])
                    start = None
            rows.append(spans)
        result[theme]['actors'][name] = {**{key: frame[key] for key in ['width', 'height', 'anchorX', 'anchorY']}, 'bodyHeight': characters['characterHeights'][name], 'rows': rows}
bench = Image.open(ROOT / 'frontend/public/assets/bench.webp').convert('RGBA')
rows = []
for y in range(bench.height):
    spans, start = [], None
    for x in range(bench.width + 1):
        solid = x < bench.width and bench.getpixel((x, y))[3] >= 160
        if solid and start is None:
            start = x
        elif not solid and start is not None:
            spans.extend([start, x])
            start = None
    rows.append(spans)
result['bench'] = {'width': bench.width, 'height': bench.height, 'anchorX': .5, 'anchorY': 1, 'rows': rows}
(ROOT / 'shared/collision-masks.json').write_text(json.dumps(result, separators=(',', ':')), encoding='utf-8')
print('Saved ground collision masks for both plaza themes and benches.')
