#!/usr/bin/env python3
"""
Lil Homie Blender action clips helper.

Run inside Blender after the hero rig exists.
This script gives the rig cleaner starter clips that the animator can polish:
- Idle: soft breathing sway
- Walk: compact loop
- Talk: subtle body talk loop
- Listen: attentive forward-lean loop
"""
from __future__ import annotations

ACTIONS = {
    "Idle": {"frame_end": 48, "chest": 0.05, "head": 0.02, "arm": 0.03, "leg": 0.0},
    "Walk": {"frame_end": 32, "chest": 0.06, "head": 0.01, "arm": 0.24, "leg": 0.18},
    "Talk": {"frame_end": 36, "chest": 0.07, "head": -0.02, "arm": 0.10, "leg": 0.0},
    "Listen": {"frame_end": 40, "chest": 0.08, "head": 0.05, "arm": 0.02, "leg": 0.0},
}


def require_blender():
    try:
        import bpy  # type: ignore
        from mathutils import Euler  # type: ignore
        return bpy, Euler
    except Exception as exc:  # pragma: no cover
        raise SystemExit("Run this script inside Blender's Python environment.") from exc


bpy, Euler = require_blender()



def active_armature():
    obj = bpy.context.active_object
    if obj and obj.type == "ARMATURE":
        return obj
    for candidate in bpy.context.selected_objects:
        if candidate.type == "ARMATURE":
            bpy.context.view_layer.objects.active = candidate
            return candidate
    raise SystemExit("Select the Lil Homie armature first.")



def set_rot(pose_bone, value):
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = Euler(value, "XYZ")



def key_pose(bone, frame: int):
    bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    bone.keyframe_insert(data_path="location", frame=frame)



def build_action(arm, name: str, spec: dict):
    action = bpy.data.actions.get(name) or bpy.data.actions.new(name=name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for fcurve in list(action.fcurves):
        action.fcurves.remove(fcurve)

    pose = arm.pose.bones
    root = pose.get("root")
    chest = pose.get("chest")
    head = pose.get("head")
    l_arm = pose.get("upper_arm.L")
    r_arm = pose.get("upper_arm.R")
    l_leg = pose.get("thigh.L")
    r_leg = pose.get("thigh.R")

    frame_end = int(spec["frame_end"])
    frames = [1, frame_end // 2, frame_end]
    for idx, frame in enumerate(frames):
        sign = 0 if idx == 0 else (-1 if idx == 1 else 1)
        if root:
            root.location = (0.0, 0.0, 0.02 if idx == 1 else 0.0)
            set_rot(root, (0.0, 0.0, 0.0))
            key_pose(root, frame)
        if chest:
            set_rot(chest, (spec["chest"] * (0.6 if idx else 0.3), 0.0, 0.0))
            key_pose(chest, frame)
        if head:
            set_rot(head, (spec["head"], 0.0, 0.0))
            key_pose(head, frame)
        if l_arm:
            set_rot(l_arm, (0.0, 0.0, spec["arm"] * sign))
            key_pose(l_arm, frame)
        if r_arm:
            set_rot(r_arm, (0.0, 0.0, -spec["arm"] * sign))
            key_pose(r_arm, frame)
        if l_leg:
            set_rot(l_leg, (0.0, 0.0, -spec["leg"] * sign))
            key_pose(l_leg, frame)
        if r_leg:
            set_rot(r_leg, (0.0, 0.0, spec["leg"] * sign))
            key_pose(r_leg, frame)
    action.use_fake_user = True
    print(f"Built action: {name}")



def main():
    arm = active_armature()
    for name, spec in ACTIONS.items():
        build_action(arm, name, spec)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = max(spec["frame_end"] for spec in ACTIONS.values())
    print("Lil Homie action clip helper finished.")


if __name__ == "__main__":
    main()
