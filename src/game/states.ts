// High-level game states. Phase 0.0.2 only ever sits in `Playing`; the menu/pause/
// char-select states are wired up in later phases (see docs/technical/ARCHITECTURE_PLAN.md).

export enum GameState {
  Boot = 'boot',
  Menu = 'menu',
  Playing = 'playing',
  Paused = 'paused',
}
