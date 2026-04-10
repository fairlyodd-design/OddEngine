#!/usr/bin/env python3
"""
Build a stronger lilhomie.glb hero actor asset for FairlyOdd OS.

This keeps the no-Blender fallback path alive, but upgrades the look and motion so the
in-OS companion feels closer to a game companion actor:
- stylized hero proportions
- layered hoodie + hood shell + chest emblem
- cap with larger brim
- hands, shoulders, shoes, and glow accents
- smoother Idle / Walk / Talk / Listen clips
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import numpy as np
import trimesh

COMPONENT_TYPE = {
    np.dtype(np.float32): 5126,
    np.dtype(np.uint16): 5123,
    np.dtype(np.uint32): 5125,
}
TYPE_NUM_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def hex_rgba(value: str, alpha: float = 1.0) -> list[float]:
    value = (value or "").strip().lstrip("#")
    if len(value) != 6:
        return [1.0, 1.0, 1.0, alpha]
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    return [r, g, b, alpha]


def load_identity(models_dir: Path) -> dict:
    for name in ("lilhomie.hero.identity.json", "lilhomie.hero.identity.template.json"):
        candidate = models_dir / name
        if candidate.exists():
            try:
                return json.loads(candidate.read_text(encoding="utf-8"))
            except Exception:
                pass
    return {}


def accessory_flag(identity: dict, name: str, default: bool = False) -> bool:
    if not isinstance(identity, dict):
        return default
    look = identity.get("look") if isinstance(identity.get("look"), dict) else {}
    accessories = look.get("accessories") if isinstance(look.get("accessories"), dict) else {}
    value = accessories.get(name, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def q_from_euler(rx: float = 0.0, ry: float = 0.0, rz: float = 0.0) -> list[float]:
    cx, sx = math.cos(rx / 2), math.sin(rx / 2)
    cy, sy = math.cos(ry / 2), math.sin(ry / 2)
    cz, sz = math.cos(rz / 2), math.sin(rz / 2)
    x = sx * cy * cz + cx * sy * sz
    y = cx * sy * cz - sx * cy * sz
    z = cx * cy * sz + sx * sy * cz
    w = cx * cy * cz - sx * sy * sz
    return [x, y, z, w]


def quat_array(eulers: list[tuple[float, float, float]]) -> np.ndarray:
    return np.array([q_from_euler(*e) for e in eulers], dtype=np.float32)


def make_box(extents, center=(0, 0, 0)):
    mesh = trimesh.creation.box(extents=extents)
    if center != (0, 0, 0):
        mesh.apply_translation(center)
    return mesh


def make_sphere(radius, subdivisions=2, center=(0, 0, 0), scale=(1.0, 1.0, 1.0)):
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=radius)
    mesh.apply_scale(scale)
    if center != (0, 0, 0):
        mesh.apply_translation(center)
    return mesh


def make_cylinder(radius: float, height: float, sections: int = 16, center=(0, 0, 0), rotation=(0.0, 0.0, 0.0)):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    rx, ry, rz = rotation
    if rx:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(rx, [1, 0, 0]))
    if ry:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(ry, [0, 1, 0]))
    if rz:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(rz, [0, 0, 1]))
    if center != (0, 0, 0):
        mesh.apply_translation(center)
    return mesh


def make_plane(width: float, height: float):
    w = width / 2
    h = height / 2
    positions = np.array([[-w, -h, 0], [w, -h, 0], [w, h, 0], [-w, h, 0]], dtype=np.float32)
    normals = np.array([[0, 0, 1]] * 4, dtype=np.float32)
    uvs = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
    indices = np.array([0, 1, 2, 0, 2, 3], dtype=np.uint32)
    return positions, normals, indices, uvs


def mesh_data(mesh: trimesh.Trimesh):
    return (
        np.asarray(mesh.vertices, dtype=np.float32),
        np.asarray(mesh.vertex_normals, dtype=np.float32),
        np.asarray(mesh.faces.reshape(-1), dtype=np.uint32),
    )


class GLBBuilder:
    def __init__(self):
        self.binary = bytearray()
        self.json = {
            "asset": {"version": "2.0", "generator": "OpenAI lilhomie hero builder"},
            "scene": 0,
            "scenes": [{"nodes": []}],
            "nodes": [],
            "meshes": [],
            "materials": [],
            "textures": [],
            "images": [],
            "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
            "accessors": [],
            "bufferViews": [],
            "buffers": [{"byteLength": 0}],
            "animations": [],
        }

    def _align(self, n: int = 4):
        while len(self.binary) % n:
            self.binary.append(0)

    def add_bytes(self, data: bytes, target=None) -> int:
        self._align(4)
        offset = len(self.binary)
        self.binary.extend(data)
        buffer_view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target is not None:
            buffer_view["target"] = target
        self.json["bufferViews"].append(buffer_view)
        return len(self.json["bufferViews"]) - 1

    def add_array(self, arr, accessor_type="SCALAR", target=None) -> int:
        arr = np.asarray(arr)
        buffer_view = self.add_bytes(arr.tobytes(order="C"), target=target)
        num = TYPE_NUM_COMPONENTS[accessor_type]
        count = len(arr) if num == 1 else arr.shape[0]
        accessor = {
            "bufferView": buffer_view,
            "componentType": COMPONENT_TYPE[arr.dtype],
            "count": int(count),
            "type": accessor_type,
        }
        if num == 1:
            accessor["min"] = [float(arr.min())]
            accessor["max"] = [float(arr.max())]
        else:
            accessor["min"] = np.min(arr, axis=0).astype(float).tolist()
            accessor["max"] = np.max(arr, axis=0).astype(float).tolist()
        self.json["accessors"].append(accessor)
        return len(self.json["accessors"]) - 1

    def add_material(self, material: dict) -> int:
        self.json["materials"].append(material)
        return len(self.json["materials"]) - 1

    def add_texture_png(self, png_bytes: bytes) -> int:
        view = self.add_bytes(png_bytes)
        self.json["images"].append({"bufferView": view, "mimeType": "image/png"})
        image_idx = len(self.json["images"]) - 1
        self.json["textures"].append({"sampler": 0, "source": image_idx})
        return len(self.json["textures"]) - 1

    def add_mesh(self, positions, normals, indices, material, texcoords=None) -> int:
        primitive = {
            "attributes": {
                "POSITION": self.add_array(np.asarray(positions, dtype=np.float32), accessor_type="VEC3", target=34962),
                "NORMAL": self.add_array(np.asarray(normals, dtype=np.float32), accessor_type="VEC3", target=34962),
            },
            "indices": self.add_array(np.asarray(indices, dtype=np.uint32).reshape(-1), accessor_type="SCALAR", target=34963),
            "material": material,
        }
        if texcoords is not None:
            primitive["attributes"]["TEXCOORD_0"] = self.add_array(np.asarray(texcoords, dtype=np.float32), accessor_type="VEC2", target=34962)
        self.json["meshes"].append({"primitives": [primitive]})
        return len(self.json["meshes"]) - 1

    def add_node(self, name: str, mesh=None, translation=None, rotation=None, scale=None, children=None) -> int:
        node = {"name": name}
        if mesh is not None:
            node["mesh"] = mesh
        if translation is not None:
            node["translation"] = [float(v) for v in translation]
        if rotation is not None:
            node["rotation"] = [float(v) for v in rotation]
        if scale is not None:
            node["scale"] = [float(v) for v in scale]
        if children:
            node["children"] = list(children)
        self.json["nodes"].append(node)
        return len(self.json["nodes"]) - 1

    def add_animation(self, name: str, channels: list[dict]):
        samplers = []
        anim_channels = []
        for channel in channels:
            input_acc = self.add_array(np.asarray(channel["times"], dtype=np.float32), accessor_type="SCALAR")
            output_acc = self.add_array(np.asarray(channel["values"], dtype=np.float32), accessor_type=channel["type"])
            samplers.append({"input": input_acc, "output": output_acc, "interpolation": channel.get("interpolation", "LINEAR")})
            anim_channels.append({"sampler": len(samplers) - 1, "target": {"node": channel["node"], "path": channel["path"]}})
        self.json["animations"].append({"name": name, "samplers": samplers, "channels": anim_channels})

    def save(self, path: Path):
        self.json["buffers"][0]["byteLength"] = len(self.binary)
        json_bytes = json.dumps(self.json, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.binary)
        while len(bin_bytes) % 4:
            bin_bytes += b"\x00"
        total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        with path.open("wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total_length))
            f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
            f.write(json_bytes)
            f.write(struct.pack("<I4s", len(bin_bytes), b"BIN\x00"))
            f.write(bin_bytes)


def build_actor(root: Path):
    models_dir = root / "ui" / "public" / "models"
    assets_dir = root / "ui" / "public" / "assets"
    out_path = models_dir / "lilhomie.glb"

    builder = GLBBuilder()
    identity = load_identity(models_dir)
    palette = identity.get("palette", {}) if isinstance(identity, dict) else {}
    show_beard = accessory_flag(identity, "beard")
    show_glasses = accessory_flag(identity, "glasses")
    face_texture_name = identity.get("faceTexture") if isinstance(identity, dict) else None
    face_texture_path = (models_dir / face_texture_name) if face_texture_name else (models_dir / "lilhomie.face.reference.png")
    if not face_texture_path.exists():
        face_texture_path = assets_dir / "homie-mascot.png"
    face_texture_index = builder.add_texture_png(face_texture_path.read_bytes())

    hoodie_dark = builder.add_material({
        "name": "hoodie-dark",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("hoodieCore", "#1f2430")), "metallicFactor": 0.12, "roughnessFactor": 0.58},
    })
    hoodie_trim = builder.add_material({
        "name": "hoodie-trim",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("hoodieTrim", "#24756b")), "metallicFactor": 0.06, "roughnessFactor": 0.46},
        "emissiveFactor": hex_rgba(palette.get("hoodieTrim", "#24756b"), 1.0)[:3],
    })
    hoodie_glow = builder.add_material({
        "name": "hoodie-glow",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("hoodieGlow", "#54429e"), 0.96), "metallicFactor": 0.10, "roughnessFactor": 0.34},
        "emissiveFactor": hex_rgba(palette.get("hoodieGlow", "#54429e"), 1.0)[:3],
        "alphaMode": "BLEND",
    })
    skin_soft = builder.add_material({
        "name": "skin-soft",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("skin", "#e0cdbd")), "metallicFactor": 0.0, "roughnessFactor": 0.88},
    })
    cap_soft = builder.add_material({
        "name": "cap-soft",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("cap", "#d4d6df")), "metallicFactor": 0.08, "roughnessFactor": 0.54},
    })
    accent_dark = builder.add_material({
        "name": "accent-dark",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("accent", "#111317")), "metallicFactor": 0.12, "roughnessFactor": 0.60},
    })
    beard_dark = builder.add_material({
        "name": "beard-dark",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("beard", "#5b3928")), "metallicFactor": 0.0, "roughnessFactor": 0.92},
    })
    glasses_dark = builder.add_material({
        "name": "glasses-dark",
        "pbrMetallicRoughness": {"baseColorFactor": hex_rgba(palette.get("glasses", "#2b2b2f"), 0.92), "metallicFactor": 0.20, "roughnessFactor": 0.28},
        "alphaMode": "BLEND",
    })
    face_card = builder.add_material({
        "name": "mascot-face",
        "pbrMetallicRoughness": {"baseColorTexture": {"index": face_texture_index}, "metallicFactor": 0.0, "roughnessFactor": 0.96},
        "alphaMode": "BLEND",
        "doubleSided": True,
    })

    body_core_mesh = builder.add_mesh(*mesh_data(make_box((0.72, 0.98, 0.38), center=(0, -0.49, 0.0))), hoodie_dark)
    torso_shell_mesh = builder.add_mesh(*mesh_data(make_box((0.94, 0.70, 0.56), center=(0, -0.30, 0.02))), hoodie_trim)
    hood_shell_mesh = builder.add_mesh(*mesh_data(make_sphere(0.40, subdivisions=2, center=(0, 0.22, -0.17), scale=(1.08, 0.90, 0.78))), hoodie_glow)
    chest_emblem_mesh = builder.add_mesh(*mesh_data(make_box((0.18, 0.18, 0.03), center=(0, -0.06, 0.23))), hoodie_glow)
    shoulder_mesh = builder.add_mesh(*mesh_data(make_box((0.20, 0.24, 0.24), center=(0, 0, 0))), hoodie_trim)
    hoodie_string_mesh = builder.add_mesh(*mesh_data(make_cylinder(0.018, 0.34, center=(0, -0.17, 0.0))), cap_soft)
    head_mesh = builder.add_mesh(*mesh_data(make_sphere(0.33, subdivisions=2, center=(0, 0.32, 0))), skin_soft)
    cap_mesh = builder.add_mesh(*mesh_data(make_sphere(0.31, subdivisions=2, center=(0, 0.14, -0.01), scale=(1.02, 0.60, 1.02))), cap_soft)
    brim_mesh = builder.add_mesh(*mesh_data(make_box((0.42, 0.045, 0.22), center=(0, 0.03, 0.17))), cap_soft)
    ear_mesh = builder.add_mesh(*mesh_data(make_sphere(0.055, subdivisions=1, center=(0, 0, 0), scale=(0.9, 1.2, 0.8))), skin_soft)
    jaw_mesh = builder.add_mesh(*mesh_data(make_box((0.22, 0.12, 0.11), center=(0, -0.08, 0.085))), skin_soft)
    hand_mesh = builder.add_mesh(*mesh_data(make_sphere(0.09, subdivisions=1, center=(0, 0, 0), scale=(0.95, 1.05, 0.88))), skin_soft)
    arm_mesh = builder.add_mesh(*mesh_data(make_box((0.16, 0.76, 0.18), center=(0, -0.38, 0))), hoodie_dark)
    leg_mesh = builder.add_mesh(*mesh_data(make_box((0.19, 0.84, 0.22), center=(0, -0.42, 0.0))), accent_dark)
    shoe_mesh = builder.add_mesh(*mesh_data(make_box((0.26, 0.11, 0.37), center=(0, -0.055, 0.085))), cap_soft)
    sole_mesh = builder.add_mesh(*mesh_data(make_box((0.27, 0.025, 0.39), center=(0, -0.11, 0.09))), hoodie_glow)
    face_pos, face_norm, face_idx, face_uv = make_plane(0.62, 0.62)
    face_mesh = builder.add_mesh(face_pos, face_norm, face_idx, face_card, texcoords=face_uv)
    beard_mesh = builder.add_mesh(*mesh_data(make_sphere(0.15, subdivisions=1, center=(0, 0, 0), scale=(1.10, 1.32, 0.58))), beard_dark)
    glasses_rim_mesh = builder.add_mesh(*mesh_data(make_box((0.16, 0.07, 0.02), center=(0, 0, 0))), glasses_dark)
    glasses_bridge_mesh = builder.add_mesh(*mesh_data(make_box((0.07, 0.02, 0.02), center=(0, 0, 0))), glasses_dark)
    glasses_arm_mesh = builder.add_mesh(*mesh_data(make_box((0.02, 0.03, 0.16), center=(0, 0, 0))), glasses_dark)

    root_node = builder.add_node("LilHomieRoot", translation=[0, 0, 0])
    torso_node = builder.add_node("TorsoCore", mesh=body_core_mesh)
    torso_shell_node = builder.add_node("TorsoShell", mesh=torso_shell_mesh, translation=[0, 0.02, 0])
    hood_shell_node = builder.add_node("HoodShell", mesh=hood_shell_mesh, translation=[0, 0.12, -0.10])
    chest_emblem_node = builder.add_node("ChestEmblem", mesh=chest_emblem_mesh)
    l_shoulder_node = builder.add_node("LeftShoulderPad", mesh=shoulder_mesh, translation=[-0.41, -0.06, 0.02])
    r_shoulder_node = builder.add_node("RightShoulderPad", mesh=shoulder_mesh, translation=[0.41, -0.06, 0.02])
    l_string_node = builder.add_node("LeftHoodieString", mesh=hoodie_string_mesh, translation=[-0.08, 0.02, 0.25], rotation=q_from_euler(0.02, 0.0, -0.04))
    r_string_node = builder.add_node("RightHoodieString", mesh=hoodie_string_mesh, translation=[0.08, 0.02, 0.25], rotation=q_from_euler(-0.02, 0.0, 0.04))

    head_pivot = builder.add_node("HeadPivot", translation=[0, 0.02, 0.10])
    head_node = builder.add_node("Head", mesh=head_mesh)
    cap_node = builder.add_node("Cap", mesh=cap_mesh, translation=[0, 0.48, 0.00])
    brim_node = builder.add_node("CapBrim", mesh=brim_mesh, translation=[0, 0.45, 0.18])
    l_ear_node = builder.add_node("LeftEar", mesh=ear_mesh, translation=[-0.28, 0.33, -0.01])
    r_ear_node = builder.add_node("RightEar", mesh=ear_mesh, translation=[0.28, 0.33, -0.01])
    face_node = builder.add_node("FaceCard", mesh=face_mesh, translation=[0, 0.34, 0.33])
    jaw_node = builder.add_node("Jaw", mesh=jaw_mesh, translation=[0, 0.16, 0.20])
    beard_node = builder.add_node("Beard", mesh=beard_mesh, translation=[0, 0.15, 0.27]) if show_beard else None
    glasses_left_node = builder.add_node("GlassesLeft", mesh=glasses_rim_mesh, translation=[-0.10, 0.38, 0.33]) if show_glasses else None
    glasses_right_node = builder.add_node("GlassesRight", mesh=glasses_rim_mesh, translation=[0.10, 0.38, 0.33]) if show_glasses else None
    glasses_bridge_node = builder.add_node("GlassesBridge", mesh=glasses_bridge_mesh, translation=[0, 0.38, 0.33]) if show_glasses else None
    glasses_left_arm_node = builder.add_node("GlassesLeftArm", mesh=glasses_arm_mesh, translation=[-0.19, 0.38, 0.27], rotation=q_from_euler(0.0, 0.22, 0.0)) if show_glasses else None
    glasses_right_arm_node = builder.add_node("GlassesRightArm", mesh=glasses_arm_mesh, translation=[0.19, 0.38, 0.27], rotation=q_from_euler(0.0, -0.22, 0.0)) if show_glasses else None

    l_arm_node = builder.add_node("LeftArm", mesh=arm_mesh, translation=[-0.50, -0.02, 0.02])
    r_arm_node = builder.add_node("RightArm", mesh=arm_mesh, translation=[0.50, -0.02, 0.02])
    l_hand_node = builder.add_node("LeftHand", mesh=hand_mesh, translation=[0, -0.74, 0.03])
    r_hand_node = builder.add_node("RightHand", mesh=hand_mesh, translation=[0, -0.74, 0.03])
    l_leg_node = builder.add_node("LeftLeg", mesh=leg_mesh, translation=[-0.18, -0.98, 0.0])
    r_leg_node = builder.add_node("RightLeg", mesh=leg_mesh, translation=[0.18, -0.98, 0.0])
    l_shoe_node = builder.add_node("LeftShoe", mesh=shoe_mesh, translation=[0, -0.84, 0.04])
    r_shoe_node = builder.add_node("RightShoe", mesh=shoe_mesh, translation=[0, -0.84, 0.04])
    l_sole_node = builder.add_node("LeftSoleGlow", mesh=sole_mesh, translation=[0, -0.84, 0.04])
    r_sole_node = builder.add_node("RightSoleGlow", mesh=sole_mesh, translation=[0, -0.84, 0.04])

    head_children = [head_node, cap_node, brim_node, l_ear_node, r_ear_node, face_node, jaw_node]
    if beard_node is not None:
        head_children.append(beard_node)
    if glasses_left_node is not None:
        head_children.extend([glasses_left_node, glasses_right_node, glasses_bridge_node, glasses_left_arm_node, glasses_right_arm_node])
    builder.json["nodes"][head_pivot]["children"] = head_children
    builder.json["nodes"][l_arm_node]["children"] = [l_hand_node]
    builder.json["nodes"][r_arm_node]["children"] = [r_hand_node]
    builder.json["nodes"][l_leg_node]["children"] = [l_shoe_node, l_sole_node]
    builder.json["nodes"][r_leg_node]["children"] = [r_shoe_node, r_sole_node]
    builder.json["nodes"][root_node]["children"] = [
        torso_node, torso_shell_node, hood_shell_node, chest_emblem_node,
        l_shoulder_node, r_shoulder_node, l_string_node, r_string_node,
        head_pivot, l_arm_node, r_arm_node, l_leg_node, r_leg_node,
    ]
    builder.json["scenes"][0]["nodes"] = [root_node]

    t = np.array([0.0, 0.4, 0.8, 1.2, 1.6, 2.0], dtype=np.float32)

    idle_channels = [
        {"node": root_node, "path": "translation", "times": t, "values": np.array([[0, 0.00, 0], [0, 0.02, 0], [0, 0.01, 0], [0, -0.01, 0], [0, 0.01, 0], [0, 0.00, 0]], dtype=np.float32), "type": "VEC3"},
        {"node": head_pivot, "path": "rotation", "times": t, "values": quat_array([(0.00, 0.00, 0.00), (0.03, 0.04, 0.05), (0.01, -0.03, 0.01), (-0.02, -0.02, -0.04), (0.02, 0.03, 0.02), (0.00, 0.00, 0.00)]), "type": "VEC4"},
        {"node": l_arm_node, "path": "rotation", "times": t, "values": quat_array([(0.02, 0.0, -0.11), (0.05, 0.0, -0.04), (0.01, 0.0, 0.02), (-0.04, 0.0, -0.03), (0.01, 0.0, -0.08), (0.02, 0.0, -0.11)]), "type": "VEC4"},
        {"node": r_arm_node, "path": "rotation", "times": t, "values": quat_array([(0.02, 0.0, 0.11), (-0.05, 0.0, 0.04), (0.01, 0.0, -0.02), (0.04, 0.0, 0.03), (0.01, 0.0, 0.08), (0.02, 0.0, 0.11)]), "type": "VEC4"},
        {"node": l_string_node, "path": "rotation", "times": t, "values": quat_array([(0.02, 0.0, -0.04), (0.08, 0.0, -0.08), (0.05, 0.0, -0.02), (0.01, 0.0, 0.02), (0.03, 0.0, -0.05), (0.02, 0.0, -0.04)]), "type": "VEC4"},
        {"node": r_string_node, "path": "rotation", "times": t, "values": quat_array([(-0.02, 0.0, 0.04), (0.02, 0.0, 0.08), (0.00, 0.0, 0.02), (-0.04, 0.0, -0.02), (-0.01, 0.0, 0.05), (-0.02, 0.0, 0.04)]), "type": "VEC4"},
    ]
    builder.add_animation("Idle", idle_channels)

    walk_channels = [
        {"node": root_node, "path": "translation", "times": t, "values": np.array([[0, 0.00, 0], [0, 0.05, 0], [0, 0.00, 0], [0, 0.05, 0], [0, 0.00, 0], [0, 0.00, 0]], dtype=np.float32), "type": "VEC3"},
        {"node": head_pivot, "path": "rotation", "times": t, "values": quat_array([(0.03, 0.0, 0.00), (-0.04, 0.0, 0.00), (0.03, 0.0, 0.01), (-0.04, 0.0, -0.01), (0.03, 0.0, 0.00), (0.03, 0.0, 0.00)]), "type": "VEC4"},
        {"node": l_arm_node, "path": "rotation", "times": t, "values": quat_array([(-0.78, 0, -0.10), (0.74, 0, -0.03), (-0.78, 0, -0.10), (0.74, 0, -0.03), (-0.78, 0, -0.10), (-0.78, 0, -0.10)]), "type": "VEC4"},
        {"node": r_arm_node, "path": "rotation", "times": t, "values": quat_array([(0.78, 0, 0.10), (-0.74, 0, 0.03), (0.78, 0, 0.10), (-0.74, 0, 0.03), (0.78, 0, 0.10), (0.78, 0, 0.10)]), "type": "VEC4"},
        {"node": l_leg_node, "path": "rotation", "times": t, "values": quat_array([(0.74, 0, 0.0), (-0.74, 0, 0.0), (0.74, 0, 0.0), (-0.74, 0, 0.0), (0.74, 0, 0.0), (0.74, 0, 0.0)]), "type": "VEC4"},
        {"node": r_leg_node, "path": "rotation", "times": t, "values": quat_array([(-0.74, 0, 0.0), (0.74, 0, 0.0), (-0.74, 0, 0.0), (0.74, 0, 0.0), (-0.74, 0, 0.0), (-0.74, 0, 0.0)]), "type": "VEC4"},
    ]
    builder.add_animation("Walk", walk_channels)

    talk_channels = [
        {"node": root_node, "path": "translation", "times": t, "values": np.array([[0, 0.00, 0], [0, 0.015, 0], [0, 0.00, 0], [0, 0.02, 0], [0, 0.00, 0], [0, 0.00, 0]], dtype=np.float32), "type": "VEC3"},
        {"node": head_pivot, "path": "rotation", "times": t, "values": quat_array([(0.00, 0.0, 0.00), (0.12, 0.05, 0.03), (0.01, -0.04, 0.01), (0.10, 0.06, -0.02), (0.00, 0.00, 0.00), (0.00, 0.00, 0.00)]), "type": "VEC4"},
        {"node": jaw_node, "path": "rotation", "times": t, "values": quat_array([(0.00, 0.0, 0.0), (0.38, 0.0, 0.0), (0.14, 0.0, 0.0), (0.30, 0.0, 0.0), (0.05, 0.0, 0.0), (0.00, 0.0, 0.0)]), "type": "VEC4"},
        {"node": r_arm_node, "path": "rotation", "times": t, "values": quat_array([(-0.10, 0.0, 0.20), (-0.48, 0.0, 0.54), (-0.12, 0.0, 0.12), (-0.54, 0.0, 0.46), (-0.18, 0.0, 0.18), (-0.10, 0.0, 0.20)]), "type": "VEC4"},
        {"node": l_arm_node, "path": "rotation", "times": t, "values": quat_array([(0.00, 0.0, -0.06), (0.10, 0.0, -0.01), (0.02, 0.0, 0.03), (-0.06, 0.0, -0.01), (0.01, 0.0, -0.05), (0.00, 0.0, -0.06)]), "type": "VEC4"},
        {"node": l_string_node, "path": "rotation", "times": t, "values": quat_array([(0.02, 0.0, -0.04), (0.10, 0.0, -0.10), (0.04, 0.0, -0.03), (0.08, 0.0, -0.09), (0.02, 0.0, -0.04), (0.02, 0.0, -0.04)]), "type": "VEC4"},
        {"node": r_string_node, "path": "rotation", "times": t, "values": quat_array([(-0.02, 0.0, 0.04), (0.04, 0.0, 0.10), (0.00, 0.0, 0.03), (0.02, 0.0, 0.09), (-0.01, 0.0, 0.04), (-0.02, 0.0, 0.04)]), "type": "VEC4"},
    ]
    builder.add_animation("Talk", talk_channels)

    listen_channels = [
        {"node": root_node, "path": "translation", "times": t, "values": np.array([[0, 0.0, 0], [0.0, 0.01, 0], [0, 0.0, 0], [0.0, 0.014, 0], [0, 0.0, 0], [0, 0.0, 0]], dtype=np.float32), "type": "VEC3"},
        {"node": head_pivot, "path": "rotation", "times": t, "values": quat_array([(0.00, 0.10, 0.16), (0.02, 0.14, 0.22), (0.00, 0.12, 0.18), (-0.01, 0.14, 0.20), (0.00, 0.10, 0.16), (0.00, 0.10, 0.16)]), "type": "VEC4"},
        {"node": l_arm_node, "path": "rotation", "times": t, "values": quat_array([(-0.14, 0.0, -0.22), (-0.18, 0.0, -0.30), (-0.10, 0.0, -0.16), (-0.18, 0.0, -0.28), (-0.12, 0.0, -0.22), (-0.14, 0.0, -0.22)]), "type": "VEC4"},
        {"node": r_arm_node, "path": "rotation", "times": t, "values": quat_array([(0.08, 0.0, 0.12), (0.02, 0.0, 0.07), (0.10, 0.0, 0.14), (0.04, 0.0, 0.10), (0.08, 0.0, 0.12), (0.08, 0.0, 0.12)]), "type": "VEC4"},
        {"node": jaw_node, "path": "rotation", "times": t, "values": quat_array([(0.0, 0, 0), (0.02, 0, 0), (0.0, 0, 0), (0.03, 0, 0), (0.0, 0, 0), (0.0, 0, 0)]), "type": "VEC4"},
    ]
    builder.add_animation("Listen", listen_channels)

    builder.save(out_path)
    return out_path


def main():
    repo_root = Path(__file__).resolve().parents[1]
    out = build_actor(repo_root)
    print(f"built {out}")


if __name__ == "__main__":
    main()
