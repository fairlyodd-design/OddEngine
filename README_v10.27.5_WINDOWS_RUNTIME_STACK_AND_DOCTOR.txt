v10.27.5_WindowsRuntimeStackAndDoctorPass

What this pass adds:
- Windows install + lock scripts for the local music runtime stack
- pinned requirements for torch / transformers / torchaudio / Bark-compatible path
- optional audiocraft requirements for local MusicGen
- runtime_lock.json snapshot written after install
- bridge runtime doctor endpoint
- Music Lab runtime status UI with clean readiness states

Windows like-I'm-5 steps:
1. Open backend_scaffold
2. Run INSTALL_WINDOWS_MUSIC_RUNTIME.bat
3. Wait for the environment to install
4. Run TEST_WINDOWS_MUSIC_RUNTIME.bat
5. Start the bridge with RUN_MUSIC_PROVIDER_BRIDGE_RUNTIME.bat
6. Open Music Lab and click Probe provider / Refresh runtime doctor

Honest note:
This pass prepares and locks the Windows runtime stack from inside the project, but the actual package install still has to happen on your Windows machine because this environment cannot install GPU/Windows-local runtimes for you.
