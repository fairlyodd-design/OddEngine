import bpy

# FairlyOdd OS / Homie export helper
# Usage in Blender Text Editor:
# 1) Open your Homie rig file
# 2) Set OUTPUT_PATH below if needed
# 3) Run script

OUTPUT_PATH = bpy.path.abspath("//lilhomie.glb")

# Optional clip aliases expected by the app manifest:
RECOMMENDED_ACTIONS = ["Idle", "Walk", "Talk", "Listen"]

armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

print("Armatures:", [obj.name for obj in armatures])
print("Meshes:", [obj.name for obj in meshes])

for obj in bpy.context.selected_objects:
    obj.select_set(False)

for obj in armatures + meshes:
    obj.select_set(True)

bpy.context.view_layer.objects.active = armatures[0] if armatures else (meshes[0] if meshes else None)

print("Exporting lilhomie rig to", OUTPUT_PATH)
print("Recommended actions:", RECOMMENDED_ACTIONS)

bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_animations=True,
    export_morph=True,
    export_morph_normal=True,
    export_morph_tangent=False,
    export_jpeg_quality=90,
    export_texcoords=True,
    export_normals=True,
    export_draco_mesh_compression_enable=False,
)

print("Done. Copy lilhomie.glb into ui/public/models/ and tune lilhomie.manifest.json if clip names differ.")
