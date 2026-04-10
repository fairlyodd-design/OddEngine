# Lil Homie Reference Personalization Pipeline Pass

Version: 10.26.14n

This pass moves Lil Homie from a generic hero starter toward a true custom companion workflow.

## What it adds

- a reference-pack lane under `ui/public/models/references/`
- `lilhomie.hero.identity.template.json` so the final hoodie / cap / palette / face path can be locked from references
- `scripts/lilhomie_reference_pack_builder.py` to generate a square face texture and identity file from reference shots
- `scripts/lilhomie_blender_personalization_helper.py` to set up reference planes and a clean starter armature in Blender
- `scripts/build_lilhomie_glb.py` now prefers the personalized face texture and color palette when present
- Homie panel guidance for the real personalization workflow

## Plain-English flow

1. Drop your real reference images into `ui/public/models/references/`
2. Copy `lilhomie.hero.identity.template.json` to `lilhomie.hero.identity.json`
3. Run the reference-pack builder to generate `lilhomie.face.reference.png`
4. Rebuild `lilhomie.glb`
5. For the full custom character, run the Blender helper and export a proper rig over the same manifest contract

## Why this matters

Even before the final Blender hero rig is done, the detached Homie shell can start using your real face texture and your chosen hoodie / cap palette, so the in-OS companion starts feeling personal immediately.
