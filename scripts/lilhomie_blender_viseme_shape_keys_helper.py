#!/usr/bin/env python3
"""
Lil Homie viseme + blink shape key helper.

Run inside Blender with the face mesh selected.
This creates export-friendly names that match the runtime manifest aliases.
"""
from __future__ import annotations

VISeme_NAMES = [
    "Basis",
    "mouthOpen",
    "jawOpen",
    "viseme_aa",
    "viseme_oh",
    "viseme_ee",
    "blink",
    "blinkLeft",
    "blinkRight",
]


def require_blender():
    try:
        import bpy  # type: ignore
        return bpy
    except Exception as exc:  # pragma: no cover
        raise SystemExit("Run this script inside Blender's Python environment.") from exc


bpy = require_blender()


def active_mesh():
    obj = bpy.context.active_object
    if not obj or obj.type != "MESH":
        raise SystemExit("Select the face mesh first, then run this helper.")
    return obj



def ensure_shape_keys(obj):
    if obj.data.shape_keys is None:
        bpy.context.view_layer.objects.active = obj
        obj.shape_key_add(name="Basis", from_mix=False)

    existing = {key.name for key in obj.data.shape_keys.key_blocks}
    for name in VISeme_NAMES:
        if name in existing:
            continue
        obj.shape_key_add(name=name, from_mix=False)
        print(f"Added shape key: {name}")

    print("Shape key setup complete.")
    print("Sculpt each target next: mouthOpen / jawOpen / visemes / blink.")



def main():
    obj = active_mesh()
    ensure_shape_keys(obj)


if __name__ == "__main__":
    main()
