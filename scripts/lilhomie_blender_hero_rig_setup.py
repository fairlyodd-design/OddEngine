#!/usr/bin/env python3
"""
Lil Homie Blender hero rig setup helper.

Run inside Blender's scripting workspace.
This script prepares a stronger hero-rig scene for the detached Homie companion:
- ensures a predictable armature with game-friendly bone names
- makes sure the face mesh has the expected viseme / blink / expression keys
- creates starter actions for Idle / Walk / Talk / Listen
- leaves everything editable so the artist can refine it by hand
"""
from __future__ import annotations

from dataclasses import dataclass

BONE_HEAD_TAILS = {
    "root": ((0.0, 0.0, 0.0), (0.0, 0.0, 0.12)),
    "pelvis": ((0.0, 0.0, 0.12), (0.0, 0.0, 0.32)),
    "spine": ((0.0, 0.0, 0.32), (0.0, 0.0, 0.7)),
    "chest": ((0.0, 0.0, 0.7), (0.0, 0.0, 1.05)),
    "neck": ((0.0, 0.0, 1.05), (0.0, 0.0, 1.18)),
    "head": ((0.0, 0.0, 1.18), (0.0, 0.0, 1.45)),
    "upper_arm.L": ((0.14, 0.0, 1.01), (0.42, 0.0, 0.95)),
    "forearm.L": ((0.42, 0.0, 0.95), (0.68, 0.0, 0.9)),
    "hand.L": ((0.68, 0.0, 0.9), (0.8, 0.0, 0.88)),
    "upper_arm.R": ((-0.14, 0.0, 1.01), (-0.42, 0.0, 0.95)),
    "forearm.R": ((-0.42, 0.0, 0.95), (-0.68, 0.0, 0.9)),
    "hand.R": ((-0.68, 0.0, 0.9), (-0.8, 0.0, 0.88)),
    "thigh.L": ((0.12, 0.0, 0.1), (0.16, 0.0, -0.55)),
    "shin.L": ((0.16, 0.0, -0.55), (0.17, 0.0, -1.08)),
    "foot.L": ((0.17, 0.0, -1.08), (0.3, 0.18, -1.12)),
    "thigh.R": ((-0.12, 0.0, 0.1), (-0.16, 0.0, -0.55)),
    "shin.R": ((-0.16, 0.0, -0.55), (-0.17, 0.0, -1.08)),
    "foot.R": ((-0.17, 0.0, -1.08), (-0.3, 0.18, -1.12)),
}

PARENTING = {
    "pelvis": "root",
    "spine": "pelvis",
    "chest": "spine",
    "neck": "chest",
    "head": "neck",
    "upper_arm.L": "chest",
    "forearm.L": "upper_arm.L",
    "hand.L": "forearm.L",
    "upper_arm.R": "chest",
    "forearm.R": "upper_arm.R",
    "hand.R": "forearm.R",
    "thigh.L": "pelvis",
    "shin.L": "thigh.L",
    "foot.L": "shin.L",
    "thigh.R": "pelvis",
    "shin.R": "thigh.R",
    "foot.R": "shin.R",
}

SHAPE_KEYS = [
    "Basis",
    "mouthOpen",
    "jawOpen",
    "viseme_sil",
    "viseme_aa",
    "viseme_ee",
    "viseme_ih",
    "viseme_oh",
    "viseme_ou",
    "viseme_fv",
    "viseme_th",
    "viseme_bmp",
    "blink",
    "blinkLeft",
    "blinkRight",
    "smile",
    "browUp",
    "browDown",
]


@dataclass
class ActionPlan:
    name: str
    frame_end: int
    root_offset: float = 0.0
    chest_pitch: float = 0.0
    hand_swing: float = 0.0
    head_pitch: float = 0.0


ACTION_PLANS = [
    ActionPlan("Idle", 48, root_offset=0.02, chest_pitch=0.04, hand_swing=0.03, head_pitch=0.02),
    ActionPlan("Walk", 32, root_offset=0.04, chest_pitch=0.05, hand_swing=0.22, head_pitch=0.01),
    ActionPlan("Talk", 36, root_offset=0.03, chest_pitch=0.06, hand_swing=0.12, head_pitch=-0.02),
    ActionPlan("Listen", 40, root_offset=0.02, chest_pitch=0.08, hand_swing=0.02, head_pitch=0.05),
]


def require_blender():
    try:
        import bpy  # type: ignore
        from mathutils import Euler  # type: ignore
        return bpy, Euler
    except Exception as exc:  # pragma: no cover
        raise SystemExit("Run this script inside Blender's Python environment.") from exc


bpy, Euler = require_blender()


def ensure_mode(mode: str):
    obj = bpy.context.object
    if obj and obj.mode != mode:
        bpy.ops.object.mode_set(mode=mode)



def ensure_collection(name: str):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection



def ensure_armature(name: str = "LilHomieHeroRig"):
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
        created[bone_name].use_connect = False

    ensure_mode("OBJECT")
    return created



def selected_meshes(exclude):
    return [obj for obj in bpy.context.selected_objects if obj != exclude and obj.type == "MESH"]



def ensure_armature_modifier(mesh_obj, arm_obj):
    modifier = next((m for m in mesh_obj.modifiers if m.type == "ARMATURE"), None)
    if modifier is None:
        modifier = mesh_obj.modifiers.new(name="LilHomieArmature", type="ARMATURE")
    modifier.object = arm_obj



def parent_meshes_to_armature(arm_obj):
    meshes = selected_meshes(arm_obj)
    if not meshes:
        print("No selected mesh objects found. Armature created, but nothing was parented.")
        return []

    bpy.ops.object.select_all(action="DESELECT")
    for mesh in meshes:
        mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    for mesh in meshes:
        ensure_armature_modifier(mesh, arm_obj)
    print(f"Parented {len(meshes)} mesh object(s) to {arm_obj.name} with automatic weights.")
    return meshes



def detect_face_mesh(meshes):
    if not meshes:
        return None
    preferred = [m for m in meshes if "face" in m.name.lower() or "head" in m.name.lower()]
    return preferred[0] if preferred else meshes[0]



def ensure_shape_keys(mesh_obj):
    if mesh_obj is None:
        print("No face mesh selected; skipped shape key setup.")
        return
    bpy.context.view_layer.objects.active = mesh_obj
    if mesh_obj.data.shape_keys is None:
        mesh_obj.shape_key_add(name="Basis", from_mix=False)
    existing = {key.name for key in mesh_obj.data.shape_keys.key_blocks}
    for name in SHAPE_KEYS:
        if name in existing:
            continue
        mesh_obj.shape_key_add(name=name, from_mix=False)
        print(f"Added shape key: {name}")



def _insert_pose_keyframe(pose_bone, frame: int):
    pose_bone.keyframe_insert(data_path="location", frame=frame)
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)



def _set_bone_rotation(pose_bone, values):
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = Euler(values, "XYZ")



def ensure_action(arm_obj, plan: ActionPlan):
    action = bpy.data.actions.get(plan.name) or bpy.data.actions.new(name=plan.name)
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action

    for fcurve in list(action.fcurves):
        action.fcurves.remove(fcurve)

    pose = arm_obj.pose.bones
    root = pose.get("root")
    pelvis = pose.get("pelvis")
    chest = pose.get("chest")
    head = pose.get("head")
    left_arm = pose.get("upper_arm.L")
    right_arm = pose.get("upper_arm.R")
    left_leg = pose.get("thigh.L")
    right_leg = pose.get("thigh.R")

    frames = [1, int(plan.frame_end * 0.5), plan.frame_end]
    for index, frame in enumerate(frames):
        phase = 0 if index == 0 else (1 if index == 1 else 2)
        swing_sign = -1 if phase == 1 else (1 if phase == 2 else 0)

        if root:
            root.location = (0.0, 0.0, plan.root_offset if phase == 1 else 0.0)
            _set_bone_rotation(root, (0.0, 0.0, 0.0))
            _insert_pose_keyframe(root, frame)
        if pelvis:
            _set_bone_rotation(pelvis, (0.02 if plan.name == "Walk" else 0.0, 0.0, 0.0))
            _insert_pose_keyframe(pelvis, frame)
        if chest:
            _set_bone_rotation(chest, (plan.chest_pitch * (0.5 if phase == 1 else 0.25), 0.0, 0.0))
            _insert_pose_keyframe(chest, frame)
        if head:
            _set_bone_rotation(head, (plan.head_pitch, 0.0, 0.0))
            _insert_pose_keyframe(head, frame)
        if left_arm:
            _set_bone_rotation(left_arm, (0.0, 0.0, plan.hand_swing * swing_sign))
            _insert_pose_keyframe(left_arm, frame)
        if right_arm:
            _set_bone_rotation(right_arm, (0.0, 0.0, -plan.hand_swing * swing_sign))
            _insert_pose_keyframe(right_arm, frame)
        if left_leg:
            _set_bone_rotation(left_leg, (0.0, 0.0, -0.16 * swing_sign if plan.name == "Walk" else 0.0))
            _insert_pose_keyframe(left_leg, frame)
        if right_leg:
            _set_bone_rotation(right_leg, (0.0, 0.0, 0.16 * swing_sign if plan.name == "Walk" else 0.0))
            _insert_pose_keyframe(right_leg, frame)

    action.use_fake_user = True
    print(f"Action ready: {action.name}")
    return action



def ensure_actions(arm_obj):
    created = [ensure_action(arm_obj, plan) for plan in ACTION_PLANS]
    if created:
        bpy.context.scene.frame_start = 1
        bpy.context.scene.frame_end = max(action.frame_range[1] for action in created)



def main():
    ensure_collection("LilHomieHero")
    arm_obj = ensure_armature()
    build_bones(arm_obj)
    meshes = parent_meshes_to_armature(arm_obj)
    face_mesh = detect_face_mesh(meshes)
    ensure_shape_keys(face_mesh)
    ensure_actions(arm_obj)
    print("Lil Homie hero rig setup finished.")
    print("Next: sculpt the hero head / hoodie weights, tune visemes, then export with lilhomie_blender_export_bundle.py.")


if __name__ == "__main__":
    main()
