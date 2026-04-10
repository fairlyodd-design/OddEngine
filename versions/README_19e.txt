v10.26.19e_FinalArtifactMaterializationAndOutputLibraryPass

What this pass does
- materializes finished One Prompt Studio runs into a local artifact library
- auto-saves final package files when package stage completes
- adds a Finished Products Library to the Writers / Magic Studio flow
- adds artifact preview + downloadable final-pack, storyboard, and listing-copy files
- keeps the bridge path for live creative backend rendering

Important note
- Book/script artifacts are materialized locally as final content packs immediately.
- Video/audio prompts now materialize into audience-ready script/storyboard/release packs locally, but true rendered mp4/audio still depends on the creative backend bridge.
