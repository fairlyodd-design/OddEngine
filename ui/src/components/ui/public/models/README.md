# Lil Homie 3D model drop-in

Put your exported 3D character here:

- `lilhomie.glb`

OddEngine will auto-detect it and render Lil Homie in **true 3D**. If the file is missing, the app falls back to a lightweight 3D "billboard" version using the Fortnite mascot texture.

## Recommended pipeline (Option A)

### Tools
- **Blender** (model + rig + animate)
- Export to **glTF Binary**: `.glb`

### Scale / orientation
- Unit scale: **1 Blender unit = 1 meter**
- Forward: **-Z Forward**, Up: **Y Up** (glTF default)

### Animation names (important)
Create (or name) these actions so the app can pick them automatically:
- `Idle`
- `Walk`
- `Talk`

(Names are case-insensitive; contains-matching also works.)

### Cartoon realism tips
- Use **PBR materials** (Base Color + Roughness/Metalness)
- Keep roughness slightly higher (0.45–0.75) for a soft toon-real feel
- Add a subtle rim-light in shading if you want extra "mascot pop"

### Face + hat
You asked for **same face and hat**. Two good approaches:
1) **Texture projection**: unwrap the face/hat area and paint a texture matching the mascot face.
2) **Billboard face plane**: if you want speed, keep a simple head mesh and place a face plane with the mascot texture.

### Mouth / talking (optional but recommended)
If you add a mouth morph target, name it one of:
- `MouthOpen`, `JawOpen`, or `viseme_aa`

OddEngine will drive it automatically while Lil Homie is speaking.

### Export settings (Blender)
- File → Export → glTF 2.0
- Format: **glTF Binary (.glb)**
- Include: **Selected Objects** (recommended)
- Animations: ✅ on
- Skinning: ✅ on
- Morph Targets: ✅ on (if you add mouth shapes)
- Embed textures: ✅ (or keep images in the .glb)

## Troubleshooting
- If the model is huge/tiny: apply **Ctrl+A → All Transforms** before export.
- If animations don't play: make sure actions are pushed to NLA / included in export.
