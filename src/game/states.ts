// High-level in-world game state. The bootstrap toggles between these two; menu / char-select
// flow is handled separately in app.ts (it doesn't use this enum).

export enum GameState {
  Playing = 'playing',
  Paused = 'paused',
}
