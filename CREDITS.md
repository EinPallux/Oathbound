# Credits & Third-Party Assets

## UI Icons

The user-interface icons in Oathbound (hotbar abilities, currencies, equipment
slots, panel headers, action buttons, etc.) are sourced from
**[game-icons.net](https://game-icons.net)**, licensed under
**Creative Commons Attribution 3.0 (CC BY 3.0)**.

The glyphs are embedded as inline SVG (recoloured to `currentColor`) in
`src/render/ui/icons.ts`. Contributing artists from the game-icons.net collection
used here include **Lorc, Delapouite, sbed, Skoll, Willdabeast and Lucas**.

- License: https://creativecommons.org/licenses/by/3.0/
- Source: https://game-icons.net/ · https://github.com/game-icons/icons

No icon has been altered beyond removing its background plate and tinting it to
match the surrounding UI text colour.

## Fonts

The UI uses the player's **system fonts** — a serif display stack (Cinzel / Trajan
Pro / Georgia / Times) for headings and a serif body stack (Spectral / Iowan / Segoe
UI) for copy — so the game ships with **no external font dependency** and works fully
offline. If the named display fonts are installed locally they are used; otherwise it
falls back gracefully to the platform serif.
