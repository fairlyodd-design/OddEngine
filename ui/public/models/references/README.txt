Drop the real personalization references here.

Recommended files:
- front-face.png  -> clear front-facing face shot
- side-face.png   -> side profile face shot
- hoodie-look.png -> hoodie style / color reference
- cap-look.png    -> cap style / color reference

Then:
1) Copy lilhomie.hero.identity.template.json to lilhomie.hero.identity.json
2) Tweak the palette / style notes
3) Run: python scripts/lilhomie_reference_pack_builder.py --front ui/public/models/references/front-face.png --side ui/public/models/references/side-face.png
4) Run: python scripts/build_lilhomie_glb.py

For the full Blender path, run the Blender helper script from scripts/lilhomie_blender_personalization_helper.py inside Blender.
