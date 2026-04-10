"""
Run this inside Blender's scripting workspace.

What it does:
- creates a LilHomieReferences collection
- loads front / side / hoodie / cap reference images as reference empties when present
- creates a simple starter armature with names that match the intended hero rig
- prints the next export steps for the final GLB pipeline
"""
from __future__ import annotations

from pathlib import Path

try:
    import bpy  # type: ignore
except Exception as exc:  # pragma: no cover
    raise SystemExit('This helper must be run inside Blender.') from exc


BONE_LAYOUT = [
    ('root', None, (0.0, 0.0, 0.0), (0.0, 0.0, 0.18)),
    ('spine', 'root', (0.0, 0.0, 0.18), (0.0, 0.0, 0.62)),
    ('neck', 'spine', (0.0, 0.0, 0.62), (0.0, 0.0, 0.76)),
    ('head', 'neck', (0.0, 0.0, 0.76), (0.0, 0.0, 0.98)),
    ('jaw', 'head', (0.0, 0.06, 0.84), (0.0, 0.13, 0.78)),
    ('arm.L', 'spine', (-0.10, 0.0, 0.56), (-0.42, 0.0, 0.46)),
    ('forearm.L', 'arm.L', (-0.42, 0.0, 0.46), (-0.62, 0.0, 0.36)),
    ('hand.L', 'forearm.L', (-0.62, 0.0, 0.36), (-0.72, 0.0, 0.34)),
    ('arm.R', 'spine', (0.10, 0.0, 0.56), (0.42, 0.0, 0.46)),
    ('forearm.R', 'arm.R', (0.42, 0.0, 0.46), (0.62, 0.0, 0.36)),
    ('hand.R', 'forearm.R', (0.62, 0.0, 0.36), (0.72, 0.0, 0.34)),
    ('thigh.L', 'root', (-0.10, 0.0, 0.18), (-0.10, 0.0, -0.32)),
    ('shin.L', 'thigh.L', (-0.10, 0.0, -0.32), (-0.10, 0.0, -0.74)),
    ('foot.L', 'shin.L', (-0.10, 0.0, -0.74), (-0.10, 0.18, -0.84)),
    ('thigh.R', 'root', (0.10, 0.0, 0.18), (0.10, 0.0, -0.32)),
    ('shin.R', 'thigh.R', (0.10, 0.0, -0.32), (0.10, 0.0, -0.74)),
    ('foot.R', 'shin.R', (0.10, 0.0, -0.74), (0.10, 0.18, -0.84)),
]


def ensure_collection(name: str):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def make_reference_empty(path: Path, name: str, location: tuple[float, float, float], rotation=(0.0, 0.0, 0.0)):
    if not path.exists():
        return
    bpy.ops.object.empty_add(type='IMAGE', location=location, rotation=rotation)
    empty = bpy.context.active_object
    empty.name = name
    empty.empty_display_size = 1.0
    empty.data = bpy.data.images.load(str(path), check_existing=True)
    empty.empty_image_side = 'FRONT'


def create_armature(name: str = 'LilHomieHeroRig'):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0.0, 0.0, 0.0))
    arm = bpy.context.active_object
    arm.name = name
    arm_data = arm.data
    arm_data.name = name
    edit_bones = arm_data.edit_bones
    edit_bones.remove(edit_bones[0])

    created = {}
    for bone_name, parent_name, head, tail in BONE_LAYOUT:
        bone = edit_bones.new(bone_name)
        bone.head = head
        bone.tail = tail
        if parent_name:
            bone.parent = created[parent_name]
            bone.use_connect = False
        created[bone_name] = bone
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def main():
    repo_root = Path(bpy.path.abspath('//')).resolve()
    refs_dir = repo_root / 'ui' / 'public' / 'models' / 'references'
    ref_coll = ensure_collection('LilHomieReferences')
    rig_coll = ensure_collection('LilHomieRig')

    make_reference_empty(refs_dir / 'front-face.png', 'Ref_FrontFace', (0.0, -2.0, 0.9))
    make_reference_empty(refs_dir / 'side-face.png', 'Ref_SideFace', (2.0, 0.0, 0.9), rotation=(0.0, 0.0, 1.5708))
    make_reference_empty(refs_dir / 'hoodie-look.png', 'Ref_Hoodie', (-2.2, -1.2, 0.8))
    make_reference_empty(refs_dir / 'cap-look.png', 'Ref_Cap', (2.2, -1.2, 1.4))

    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith('Ref_'):
            if obj.name not in ref_coll.objects:
                for coll in obj.users_collection:
                    coll.objects.unlink(obj)
                ref_coll.objects.link(obj)

    rig = create_armature()
    for coll in rig.users_collection:
        coll.objects.unlink(rig)
    rig_coll.objects.link(rig)

    print('Lil Homie reference planes and starter armature created.')
    print('Next steps: model face / hoodie / cap to the references, add shape keys for jawOpen + blink, then export lilhomie.glb over ui/public/models/.')


main()
