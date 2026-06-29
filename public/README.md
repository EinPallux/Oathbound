# Static assets (`public/`)

Files in this folder are served from the site root (Vite copies them verbatim
into the build). Reference them with a leading slash, e.g. `/bgm.mp3`.

## Background music

Drop a music file named **`bgm`** into this folder and it will loop as the
game's background music — no code changes needed:

```
public/bgm.mp3      ← preferred
public/bgm.ogg      ← also supported
public/bgm.wav      ← also supported
```

The game probes those names in order and plays the first one it finds. If no
file is present, the game simply runs without music (no errors).

Notes:
- The music starts when you enter the world and respects the **Volume** /
  **Mute audio** settings (it's mixed lower than the sound effects so it stays
  in the background).
- Browsers only allow audio after a user interaction, so playback begins on
  your first click/keypress (e.g. pressing **Enter** on the title screen).
- Use a track you have the rights to. Audio files are intentionally **not**
  committed to the repo — add yours locally (or in your deployment).
