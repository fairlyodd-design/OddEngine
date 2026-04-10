# v10.26.14m Hero Rig Companion Pass

This pass upgrades Lil Homie from a plain starter actor into a stronger **hero-rig starter** that feels more like a game companion in the detached shell.

## What changed

- rebuilt `ui/public/models/lilhomie.glb`
- upgraded silhouette: layered hoodie shell, hood, shoulders, hands, shoes, chest emblem, cap brim, hoodie strings
- improved motion curves for `Idle`, `Walk`, `Talk`, and `Listen`
- tuned `ui/public/models/lilhomie.manifest.json` for the hero-rig profile
- added `ui/public/models/lilhomie.hero.look.json` as the style source of truth
- upgraded `scripts/build_lilhomie_glb.py` so the repo can regenerate the hero starter asset without Blender

## Truthful scope

This is a **hero-rig starter asset**, not a photoreal or user-specific custom character.

It gives the OS a more game-like default Homie right now while keeping the real upgrade lane open:

- later custom face sculpt
- better lip-sync blendshapes
- hoodie/cap/body refinements from reference art
- Blender-authored skeleton and animation polish

## Rebuild

From repo root:

```bash
python scripts/build_lilhomie_glb.py
```

That regenerates:

- `ui/public/models/lilhomie.glb`

## Next best move

Hero rig **reference lock pass**:

- choose final face direction
- choose hoodie / cap / body style
- create turnarounds or reference sheet
- rebuild in Blender onto a real armature while preserving clip naming and manifest aliases
