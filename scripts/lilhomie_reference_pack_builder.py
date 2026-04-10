#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def crop_face_texture(src: Path, out: Path, size: int = 512) -> None:
    try:
        from PIL import Image
    except Exception:
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)
        return

    img = Image.open(src).convert('RGBA')
    width, height = img.size
    side = min(width, height)
    left = max(0, (width - side) // 2)
    top = max(0, int((height - side) * 0.18))
    if top + side > height:
        top = max(0, height - side)
    img = img.crop((left, top, left + side, top + side)).resize((size, size))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)


def main() -> None:
    parser = argparse.ArgumentParser(description='Build Lil Homie reference pack assets from real photos.')
    parser.add_argument('--front', required=True, help='Front-facing face image')
    parser.add_argument('--side', help='Side profile face image')
    parser.add_argument('--hoodie', help='Hoodie reference image')
    parser.add_argument('--cap', help='Cap reference image')
    parser.add_argument('--name', default='Lil Homie', help='Display name')
    parser.add_argument('--hoodie-core', default='#1f2430')
    parser.add_argument('--hoodie-trim', default='#24756b')
    parser.add_argument('--hoodie-glow', default='#54429e')
    parser.add_argument('--cap-color', default='#d4d6df')
    parser.add_argument('--accent-color', default='#111317')
    parser.add_argument('--skin-color', default='#e0cdbd')
    parser.add_argument('--hoodie-style', default='relaxed zip hoodie')
    parser.add_argument('--cap-style', default='soft curved-brim cap')
    parser.add_argument('--body-style', default='compact game-companion silhouette')
    parser.add_argument('--expression', default='warm grounded helper')
    parser.add_argument('--repo-root', default=None, help='Repo root; defaults to the script parent repo')
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parents[1]
    models_dir = repo_root / 'ui' / 'public' / 'models'
    refs_dir = models_dir / 'references'
    refs_dir.mkdir(parents=True, exist_ok=True)

    front = Path(args.front).resolve()
    side = Path(args.side).resolve() if args.side else None
    hoodie = Path(args.hoodie).resolve() if args.hoodie else None
    cap = Path(args.cap).resolve() if args.cap else None

    front_out = refs_dir / 'front-face.png'
    shutil.copy2(front, front_out)
    if side and side.exists():
        shutil.copy2(side, refs_dir / 'side-face.png')
    if hoodie and hoodie.exists():
        shutil.copy2(hoodie, refs_dir / 'hoodie-look.png')
    if cap and cap.exists():
        shutil.copy2(cap, refs_dir / 'cap-look.png')

    face_texture = models_dir / 'lilhomie.face.reference.png'
    crop_face_texture(front, face_texture)

    identity = {
        'displayName': args.name,
        'faceTexture': face_texture.name,
        'references': {
            'front': 'references/front-face.png',
            'side': 'references/side-face.png' if side and side.exists() else '',
            'hoodie': 'references/hoodie-look.png' if hoodie and hoodie.exists() else '',
            'cap': 'references/cap-look.png' if cap and cap.exists() else '',
        },
        'look': {
            'hoodieStyle': args.hoodie_style,
            'capStyle': args.cap_style,
            'bodyStyle': args.body_style,
            'expression': args.expression,
        },
        'palette': {
            'hoodieCore': args.hoodie_core,
            'hoodieTrim': args.hoodie_trim,
            'hoodieGlow': args.hoodie_glow,
            'cap': args.cap_color,
            'accent': args.accent_color,
            'skin': args.skin_color,
        },
    }
    

    (models_dir / 'lilhomie.hero.identity.json').write_text(json.dumps(identity, indent=2) + '\n', encoding='utf-8')

    print(f'Wrote {face_texture}')
    print(f'Wrote {models_dir / "lilhomie.hero.identity.json"}')


if __name__ == '__main__':
    main()