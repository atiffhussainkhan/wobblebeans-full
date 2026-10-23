# Wobblebeans procedural audio

| Field | Value |
|---|---|
| Work | Runtime synthesis for music beds, stingers, character, obstacle, UI, and ambience |
| Where | `apps/client/src/audio/` (`recipes.ts`, `synth.ts`, `music-plan.ts`) |
| Samples | None. No `.wav`, `.ogg`, `.mp3`, or Kenney/other pack files are shipped |
| Voice-over | None. No speech synthesis |
| Author | Wobblebeans workstream 6 |
| Licence | CC0 1.0 Universal |
| AI-use | none |
| Retrieved | Not retrieved. Generated in-process by Web Audio oscillators, a deterministic noise buffer, and biquad filters |
| Loudness | Programme trim −6 dB into a −1 dBTP limiter. Headless CI does not measure LUFS; see the audio design notes in the pull request |

The asset pack has no scored music bed. These loops stand in until a CC0 bed is added under `assets/audio/` with its own licence file.
