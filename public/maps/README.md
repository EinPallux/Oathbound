# Custom maps

Drop maps exported from the **Oathbound Map Builder** (the `Oathbound-AdminTools` repo)
here, then load one by name:

```
http://localhost:5173/?map=<name>      # → public/maps/<name>.oathbound-map.json
```

`?map=` also accepts an explicit path or URL. With no `?map=`, the game boots the default
procedural world unchanged.

A ready-made demo ships here: **`?map=sample`** (`sample.oathbound-map.json`).

The map format is defined in `src/world/map-format.ts` (mirrored in the builder).
