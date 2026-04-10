#!/usr/bin/env python3
"""
Lil Homie Blender export bundle helper.

Run inside Blender after the hero rig is ready.
This script validates the rig, exports `ui/public/models/lilhomie.glb`, and writes
an updated sibling `lilhomie.manifest.json` with animation + viseme aliases that
match the detached Homie runtime.
"""
from __future__ import annotations

import json
from pathlib import Path

EXPECTED_ACTIONS = ["Idle", "Walk", "Talk", "Listen"]
EXPECTED_VISEMES = [
    "viseme_sil",
    "viseme_aa",
    "viseme_ee",
    "viseme_ih",
    "viseme_oh",
    "viseme_ou",
    "viseme_fv",
    "viseme_th",
    "viseme_bmp",
]



def require_blender():
    try:
        import bpy  # type: ignore
        return bpy
    except Exception as exc:  # pragma: no cover
        raise SystemExit("Run this script inside Blender's Python environment.") from exc


bpy = require_blender()



def find_armature():
    active = bpy.context.active_object
    if active and active.type == "ARMATURE":
        return active
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE" and obj.name.lower().startswith("lilhomie"):
            return obj
    raise SystemExit("Could not find the Lil Homie armature in the current scene.")



def face_mesh_candidates():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    preferred = [obj for obj in meshes if "face" in obj.name.lower() or "head" in obj.name.lower()]
    return preferred or meshes



def collect_shape_keys(mesh_obj):
    if not mesh_obj or mesh_obj.data.shape_keys is None:
        return []
    return [key.name for key in mesh_obj.data.shape_keys.key_blocks]



def build_manifest(shape_keys: list[str]):
    return {
        "scale": 0.62,
        "position": [0, -0.2, 0],
        "rotationY": 0,
        "animationMap": {
            "idle": ["Idle", "HeroIdle", "idle"],
            "walk": ["Walk", "HeroWalk", "walk"],
            "talk": ["Talk", "HeroTalk", "talk"],
            "listen": ["Listen", "HeroListen", "listen"],
        },
        "morphMap": {
            "mouth": [name for name in ["mouthOpen", "jawOpen", "viseme_aa"] if name in shape_keys],
            "blink": [name for name in ["blink", "blinkLeft", "blinkRight"] if name in shape_keys],
            "smile": [name for name in ["smile"] if name in shape_keys],
            "browUp": [name for name in ["browUp"] if name in shape_keys],
            "browDown": [name for name in ["browDown"] if name in shape_keys],
        },
        "visemeMap": {
            "sil": [name for name in ["viseme_sil"] if name in shape_keys],
            "aa": [name for name in ["viseme_aa"] if name in shape_keys],
            "ee": [name for name in ["viseme_ee"] if name in shape_keys],
            "ih": [name for name in ["viseme_ih"] if name in shape_keys],
            "oh": [name for name in ["viseme_oh"] if name in shape_keys],
            "ou": [name for name in ["viseme_ou"] if name in shape_keys],
            "fv": [name for name in ["viseme_fv"] if name in shape_keys],
            "th": [name for name in ["viseme_th"] if name in shape_keys],
            "bmp": [name for name in ["viseme_bmp"] if name in shape_keys],
        },
        "expressionMap": {
            "idle": {"smile": 0.05, "browUp": 0.03, "browDown": 0.0},
            "talk": {"smile": 0.12, "browUp": 0.04, "browDown": 0.0},
            "listen": {"smile": 0.03, "browUp": 0.13, "browDown": 0.02},
        },
        "blink": {"intervalSeconds": 4.2, "durationSeconds": 0.16},
        "notes": {
            "exportedBy": "lilhomie_blender_export_bundle.py",
            "shapeKeyCount": len(shape_keys),
        },
    }



def validate_actions():
    missing = [name for name in EXPECTED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing:
        print(f"Warning: missing actions: {', '.join(missing)}")
    else:
        print("All expected actions found.")



def export_glb(glb_path: Path):
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"ARMATURE", "MESH"}:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_morph=True,
        export_morph_normal=True,
        export_skins=True,
        export_yup=True,
    )
    print(f"Exported GLB: {glb_path}")



def main():
    armature = find_armature()
    bpy.context.view_layer.objects.active = armature
    validate_actions()
    face_mesh = face_mesh_candidates()[0] if face_mesh_candidates() else None
    shape_keys = collect_shape_keys(face_mesh)
    missing_visemes = [name for name in EXPECTED_VISEMES if name not in shape_keys]
    if missing_visemes:
        print(f"Warning: missing viseme keys: {', '.join(missing_visemes)}")

    root = Path(bpy.path.abspath("//"))
    glb_path = root / "ui" / "public" / "models" / "lilhomie.glb"
    manifest_path = root / "ui" / "public" / "models" / "lilhomie.manifest.json"

    export_glb(glb_path)
    manifest = build_manifest(shape_keys)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote manifest: {manifest_path}")
    print("Lil Homie export bundle complete.")


if __name__ == "__main__":
    main()
