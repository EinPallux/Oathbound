// Resolve a `?map=` query value to a URL the loader can fetch.
//
//   ?map=tanaria                        → <base>maps/tanaria.oathbound-map.json
//   ?map=tanaria.oathbound-map.json     → <base>maps/tanaria.oathbound-map.json  (suffix tolerated)
//   ?map=tanaria.json                   → <base>maps/tanaria.oathbound-map.json
//   ?map=/maps/x.json  ·  ?map=https://… → used verbatim (anything containing a slash)
//
// `base` is Vite's import.meta.env.BASE_URL (passed in so this stays pure + unit-testable).

export function resolveMapUrl(name: string, base: string): string {
  // An explicit path or full URL (anything with a slash) is used as-is.
  if (name.includes('/')) return name;
  // A bare name — tolerate a typed-in `.oathbound-map.json` / `.json` suffix.
  const stem = name.replace(/\.oathbound-map\.json$/i, '').replace(/\.json$/i, '');
  return `${base}maps/${stem}.oathbound-map.json`;
}

/** The bare map name (no directory, no extension) — used for user-facing hints. */
export function mapNameHint(name: string): string {
  const last = name.split('/').pop() ?? name;
  return last.replace(/\.oathbound-map\.json$/i, '').replace(/\.json$/i, '');
}
