# 3D anatomy models

The viewer (`/anatomy`) loads any **GLB/GLTF** file whose meshes are named after
anatomical structures. Without a model it shows a small built-in demo skeleton.

## Free sources

| Source | Content | Licence |
| --- | --- | --- |
| [Z-Anatomy](https://www.z-anatomy.com/) | Complete atlas (bones, muscles, organs, nerves), Blender files | CC BY-SA 4.0 |
| [BodyParts3D](https://lifesciencedb.jp/bp3d/) | ~2 000 structures from the Japanese DBCLS | CC BY-SA 2.1 JP |
| [Sketchfab](https://sketchfab.com/search?q=anatomy&features=downloadable&licenses=7c23a1ba438d4306920229c12afcb5f9&licenses=b9ddc40b93e34cdca1fc152f39b9f375) | Many CC-BY anatomy models (download as glTF) | Per model |

Always keep the attribution: it is stored with each model in `anatomy_models.attribution`.

## Preparing a model

1. Export as **GLB** from Blender (File → Export → glTF 2.0, format *glTF Binary*).
   Keep one mesh per structure and give meshes meaningful names (`Femur_L`, `Heart`…).
2. Compress it (10× smaller files, important on mobile data):

   ```bash
   npx @gltf-transform/cli optimize input.glb skeleton.glb --compress draco --texture-compress webp
   ```

3. Upload it to the public `anatomy-models` Supabase Storage bucket (or place it in
   this folder for local tests, e.g. `public/models/skeleton.glb`).
4. Register it (SQL editor, as an admin):

   ```sql
   insert into public.anatomy_models (slug, title_fr, title_en, system, model_url, license, attribution, structures)
   values (
     'squelette',
     'Squelette', 'Skeleton', 'skeletal',
     'https://<project>.supabase.co/storage/v1/object/public/anatomy-models/skeleton.glb',
     'CC BY-SA 4.0', 'Z-Anatomy',
     '{"Femur_L": {"fr": "Fémur gauche", "en": "Left femur"}}'
   );
   ```

   `structures` maps mesh names to FR/EN labels; unmapped meshes show their cleaned-up name.

To embed a Sketchfab viewer instead of the built-in one, set `model_url` to
`sketchfab:<model id>` (the id is the last part of the model URL).

Draco decoding downloads the decoder from Google's CDN (www.gstatic.com). To self-host it, copy
`node_modules/three/examples/jsm/libs/draco/` to `public/draco/` and pass
`'/draco/'` as the second argument of `useGLTF` in `anatomy-canvas.tsx`.
