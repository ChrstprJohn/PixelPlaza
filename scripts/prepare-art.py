"""Prepare the generated PNG sources as small, registered WebP runtime atlases."""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public/assets'
SOURCE = ROOT / 'art/source'
SOURCE.mkdir(parents=True, exist_ok=True)
SRC = ROOT / 'frontend/src'
DIRECTIONS = ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast']

def runs(values, minimum=8):
    result, start = [], None
    for index, active in enumerate(list(values) + [False]):
        if active and start is None:
            start = index
        if not active and start is not None:
            if index - start >= minimum:
                result.append((start, index))
            start = None
    return result

def body_centre(crop):
    core = np.array(crop.getchannel('A')) >= 160
    core = core[round(crop.height * .2):round(crop.height * .6)]
    centres = [(np.flatnonzero(line)[0] + np.flatnonzero(line)[-1] + 1) / 2 for line in core if line.any()]
    return float(np.median(centres)) if centres else crop.width / 2

def atlas(path, labels, columns, cell, runtime_name, lock_body=False):
    image = Image.open(path).convert('RGBA')
    alpha = np.array(image.getchannel('A')) >= 160
    bands = runs(alpha.sum(axis=1) > 8)
    if len(bands) != len(labels):
        bands = [(round(i * image.height / len(labels)), round((i + 1) * image.height / len(labels))) for i in range(len(labels))]
    cropped_rows = []
    for row, (top, bottom) in enumerate(bands):
        spans = runs(alpha[top:bottom].sum(axis=0) > 3)
        if len(spans) != columns:
            spans = [(round(i * image.width / columns), round((i + 1) * image.width / columns)) for i in range(columns)]
        crops = []
        for left, right in spans:
            yy, xx = np.where(alpha[top:bottom, left:right])
            assert len(xx), f'Empty frame: {path.name} row {row}'
            box = (left + int(xx.min()), top + int(yy.min()), left + int(xx.max()) + 1, top + int(yy.max()) + 1)
            crops.append((image.crop(box), box))
        cropped_rows.append(crops)
    # One scale and root for every pose; the fixed row ground line preserves bob.
    maximum = max(max(crop.width, crop.height) for row in cropped_rows for crop, box in row)
    if lock_body:
        maximum = max(max(max(box[3] for _, box in row) - box[1], 2 * max(body_centre(crop), crop.width - body_centre(crop))) for row in cropped_rows for crop, box in row)
    margin = 12 if lock_body else 6
    scale = min(52, cell - margin * 2) / maximum if lock_body else (cell - 12) / maximum
    output = Image.new('RGBA', (columns * cell, len(labels) * cell))
    frames, heights = {}, {}
    for row, label in enumerate(labels):
        crops = cropped_rows[row]
        baseline = max(box[3] for crop, box in crops)
        row_height = max(crop.height for crop, box in crops)
        heights[label] = row_height * scale
        frames[label] = []
        for col, (crop, box) in enumerate(crops):
            # Contact anchor is consistent across frames instead of alpha-bbox bottoms.
            if lock_body:
                x = col * cell + cell // 2 - round(body_centre(crop) * scale)
            else:
                x = col * cell + (cell - round(crop.width * scale)) // 2
            y = row * cell + cell - margin - round((baseline - box[1]) * scale)
            resized = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.Resampling.LANCZOS)
            if lock_body:
                resized.putalpha(resized.getchannel('A').point(lambda value: 255 if value >= 128 else 0))
            assert col * cell <= x and x + resized.width <= (col + 1) * cell, f'Horizontal frame spill: {path.name} {label}/{col}'
            assert row * cell <= y and y + resized.height <= (row + 1) * cell, f'Vertical frame spill: {path.name} {label}/{col}'
            output.alpha_composite(resized, (x, y))
            frames[label].append({'x': col * cell, 'y': row * cell, 'width': cell, 'height': cell, 'anchorX': .5, 'anchorY': (cell - margin) / cell})
    output.save(PUBLIC / runtime_name, 'WEBP', quality=88, method=6, exact=True)
    digest = hashlib.sha256((PUBLIC / runtime_name).read_bytes()).hexdigest()[:10]
    return {'image': '/assets/' + runtime_name + '?v=' + digest, 'width': output.width, 'height': output.height, 'frames': frames, 'characterHeights': heights}

def archive(name):
    raw = PUBLIC / name
    destination = SOURCE / name
    if not destination.exists():
        destination.write_bytes(raw.read_bytes())
    return destination

for theme, raw, output in [('garden', 'characters-v2.png', 'character-art.json'), ('haunted', 'characters-haunted.png', 'haunted-art.json')]:
    data = atlas(archive(raw), ['cat', 'sprout', 'mushroom', 'robot'], 8, 64, f'characters-{theme}.webp')
    (SRC / output).write_text(json.dumps(data, indent=2), encoding='utf-8')

directional = {}
scenery = {}
for theme in ['garden', 'haunted']:
    directional[theme] = {}
    for name in ['cat', 'sprout', 'mushroom', 'robot']:
        source = SOURCE / f'{theme}-{name}-directional-v2.png'
        if not source.exists(): source = SOURCE / f'{theme}-{name}-directional.png'
        data = atlas(source, DIRECTIONS, 8, 80, f'{theme}-{name}-walk-v2.webp', lock_body=True)
        data['bodyHeight'] = max(data.pop('characterHeights').values())
        directional[theme][name] = data
    scenery[theme] = atlas(SOURCE / f'{theme}-scenery.png', ['fountain', 'tree', 'cherry', 'bush'], 4, 160, f'scenery-{theme}.webp')
    base = Image.open(SOURCE / f'{theme}-base-layers.png').convert('RGB').resize((960, 760), Image.Resampling.LANCZOS)
    base.save(PUBLIC / f'plaza-{theme}.webp', 'WEBP', quality=88, method=6)

(SRC / 'directional-art.json').write_text(json.dumps(directional, indent=2), encoding='utf-8')
(SRC / 'scenery-art.json').write_text(json.dumps(scenery, indent=2), encoding='utf-8')
for theme, raw in [('garden', 'cloud-garden.png'), ('haunted', 'cloud-haunted.png')]:
    image = Image.open(archive(raw)).convert('RGBA').resize((384, 576), Image.Resampling.LANCZOS)
    image.save(PUBLIC / f'cloud-{theme}.webp', 'WEBP', quality=85, method=6)
bench = Image.open(archive('bench.png')).convert('RGBA')
bench = bench.crop(bench.getchannel('A').point(lambda x: 255 if x >= 40 else 0).getbbox())
bench.thumbnail((160, 96), Image.Resampling.LANCZOS)
bench.save(PUBLIC / 'bench.webp', 'WEBP', quality=88, method=6, exact=True)
(SRC / 'bench-art.json').write_text(json.dumps({'x': 0, 'y': 0, 'width': bench.width, 'height': bench.height}), encoding='utf-8')
sizes = {path.name: path.stat().st_size for path in PUBLIC.glob('*.webp')}
(ROOT / 'art/runtime-sizes.json').write_text(json.dumps({'bytes': sizes, 'total': sum(sizes.values())}, indent=2), encoding='utf-8')
print(json.dumps({'runtimeBytes': sum(sizes.values()), 'atlases': len(sizes)}))
