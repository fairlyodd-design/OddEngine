#!/usr/bin/env python3
"""
Lil Homie Blender armature helper.

Run inside Blender's scripting workspace.
Goal: create a predictable humanoid armature and parent the selected mesh so
FairlyOdd OS has a clean export target for the real Homie actor.
"""
from __future__ import annotations

BONE_HEAD_TAILS = {
    "root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.12)),
    "spine": ((0.0, 0.0, 0.12), (0.0, 0.0, 0.65)),
    "chest": ((0.0, 0.0, 0.65), (0.0, 0.0, 1.05)),
    "neck": ((0.0, 0.0, 1.05), (0.0, 0.0, 1.2)),
    "head": ((0.0, 0.0, 1.2), (0.0, 0.0, 1.45)),
    "upper_arm.L": ((0.12, 0.0, 1.0), (0.42, 0.0, 0.95)),
    "forearm.L": ((0.42, 0.0, 0.95), (0.67, 0.0, 0.88)),
    "hand.L": ((0.67, 0.0, 0.88), (0.78, 0.0, 0.86)),
    "upper_arm.R": ((-0.12, 0.0, 1.0), (-0.42, 0.0, 0.95)),
    "forearm.R": ((-0.42, 0.0, 0.95), (-0.67, 0.0, 0.88)),
    "hand.R": ((-0.67, 0.0, 0.88), (-0.78, 0.0, 0.86)),
    "thigh.L": ((0.11, 0.0, 0.1), (0.15, 0.0, -0.55)),
    "shin.L": ((0.15, 0.0, -0.55), (0.16, 0.0, -1.08)),
    "foot.L": ((0.16, 0.0, -1.08), (0.26, 0.18, -1.12)),
    "thigh.R": ((-0.11, 0.0, 0.1), (-0.15, 0.0, -0.55)),
    "shin.R": ((-0.15, 0.0, -0.55), (-0.16, 0.0, -1.08)),
    "foot.R": ((-0.16, 0.0, -1.08), (-0.26, 0.18, -1.12)),
}

PARENTING = {
    "spine": "root",
    "chest": "spine",
    "neck": "chest",
    "head": "neck",
    "upper_arm.L": "chest",
    "forearm.L": "upper_arm.L",
    "hand.L": "forearm.L",
    "upper_arm.R": "chest",
    "forearm.R": "upper_arm.R",
    "hand.R": "forearm.R",
    "thigh.L": "root",
    "shin.L": "thigh.L",
    "foot.L": "shin.L",
    "thigh.R": "root",
    "shin.R": "thigh.R",
    "foot.R": "shin.R",
}


def require_blender():
    try:
        import bpy  # type: ignore
        return bpy
    except Exception as exc:  # pragma: no cover
        raise SystemExit("Run this script inside Blender's Python environment.") from exc


bpy = require_blender()


def ensure_mode(mode: str):
    if bpy.context.object and bpy.context.object.mode != mode:
        bpy.ops.object.mode_set(mode=mode)



def ensure_armature(name: str = "LilHomieRig"):
    arm = bpy.data.objects.get(name)
    if arm and arm.type == "ARMATURE":
        return arm
    bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = name
    arm.data.name = name
    return arm



def build_bones(arm_obj):
    bpy.context.view_layer.objects.active = arm_obj
    ensure_mode("EDIT")
    edit_bones = arm_obj.data.edit_bones

    for bone in list(edit_bones):
        edit_bones.remove(bone)

    created = {}
    for bone_name, (head, tail) in BONE_HEAD_TAILS.items():
        bone = edit_bones.new(bone_name)
        bone.head = head
        bone.tail = tail
        created[bone_name] = bone

    for bone_name, parent_name in PARENTING.items():
        created[bone_name].parent = created[parent_name]
        if ".L" in bone_name or ".R" in bone_name or bone_name in {"spine", "chest", "neck", "head", "shin.L", "shin.R"}:
            created[bone_name].use_connect = False

    ensure_mode("OBJECT")



def selected_meshes(exclude):
    return [obj for obj in bpy.context.selected_objects if obj != exclude and obj.type == "MESH"]



def parent_meshes_to_armature(arm_obj):
    meshes = selected_meshes(arm_obj)
    if not meshes:
        print("No selected mesh objects found. Armature created, but nothing was parented.")
        return

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    print(f"Parented {len(meshes)} mesh object(s) to {arm_obj.name} with automatic weights.")



def ensure_action_placeholders():
    expected = ["Idle", "Walk", "Talk", "Listen"]
    for name in expected:
        action = bpy.data.actions.get(name)
        if action is None:
            action = bpy.data.actions.new(name=name)
        print(f"Action ready: {action.name}")



def main():
    arm_obj = ensure_armature()
    build_bones(arm_obj)
    parent_meshes_to_armature(arm_obj)
    ensure_action_placeholders()
    print("Lil Homie armature helper finished.")
    print("Next: pose + animate Idle / Walk / Talk / Listen, then export lilhomie.glb.")


if __name__ == "__main__":
    main()
