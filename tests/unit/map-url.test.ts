import { describe, it, expect } from 'vitest';
import { resolveMapUrl, mapNameHint } from '../../src/world/map-url';

describe('resolveMapUrl', () => {
  it('expands a bare name into public/maps/<name>.oathbound-map.json', () => {
    expect(resolveMapUrl('tanaria', '/')).toBe('/maps/tanaria.oathbound-map.json');
  });

  it('tolerates a typed-in .oathbound-map.json suffix (the common mistake)', () => {
    // ?map=tanaria.oathbound-map.json used to be fetched as a relative path → HTML/404.
    expect(resolveMapUrl('tanaria.oathbound-map.json', '/')).toBe('/maps/tanaria.oathbound-map.json');
  });

  it('tolerates a plain .json suffix', () => {
    expect(resolveMapUrl('tanaria.json', '/')).toBe('/maps/tanaria.oathbound-map.json');
  });

  it('honours a non-root base URL', () => {
    expect(resolveMapUrl('tanaria', '/game/')).toBe('/game/maps/tanaria.oathbound-map.json');
  });

  it('uses an explicit path or URL verbatim (anything with a slash)', () => {
    expect(resolveMapUrl('/maps/x.oathbound-map.json', '/')).toBe('/maps/x.oathbound-map.json');
    expect(resolveMapUrl('https://cdn.example.com/m.json', '/')).toBe('https://cdn.example.com/m.json');
    expect(resolveMapUrl('worlds/tanaria.json', '/')).toBe('worlds/tanaria.json');
  });
});

describe('mapNameHint', () => {
  it('strips directory + extension for user-facing hints', () => {
    expect(mapNameHint('tanaria')).toBe('tanaria');
    expect(mapNameHint('tanaria.oathbound-map.json')).toBe('tanaria');
    expect(mapNameHint('/maps/tanaria.oathbound-map.json')).toBe('tanaria');
    expect(mapNameHint('tanaria.json')).toBe('tanaria');
  });
});
