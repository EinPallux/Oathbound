# Post-Beta MMO Horizon (Non-Committed Appendix)

A **clearly non-committed** outline of what *could* come after 1.0-BETA if Oathbound pursues real multiplayer. **Nothing here is scheduled or implemented.** The honest framing: **converting a local Three.js RPG into an MMO is a major project, not a feature.** The beta's job is to make the **solo loop excellent first**; this appendix only ensures we left the door open ([FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md)).

## Guiding principle
Pursue online **only after** the local beta is polished and enjoyable. Even then, **solo progression must remain fully protected** ([SOLO_BALANCE_RULES](../design/SOLO_BALANCE_RULES.md#future-multiplayer-fairness-recorded-now-not-built)).

## Possible eventual order (illustrative, not a commitment)
1. **Account & character persistence** (server-side identity; import local saves).
2. **Authoritative game server** (the sim tick moves server-side; clients send intents).
3. **Networking prototype** (one client ↔ server: movement + combat round-trip).
4. **Multiple connected players** in a shared zone.
5. **Interest management** (who-sees-what; area-of-interest culling).
6. **Server-side combat validation** (anti-cheat; the client becomes untrusted).
7. **Parties** (grouping, shared XP/loot rules that don't punish solo).
8. **Social features** (chat, friends).
9. **Group scaling** (encounters that scale to party size).
10. **Instanced dungeons** (the first true group PvE).
11. **Raid framework** (larger coordinated encounters).
12. **Trading** (player economy, with safeguards).
13. **Guilds.**
14. **Optional PvP** (factions/zones), with its own balance pass.
15. **Live economy, operational tools, moderation, security/anti-cheat** (ongoing).

## Reuse vs. rebuild (honest assessment)
**Reusable largely as-is**
- Content registries (items/abilities/enemies/zones), combat **formulas**, item-generation & loot logic, ECS-lite **systems** (run headless server-side), art/assets, UI components (re-bound to networked state), seedable RNG.

**Must move to / become server-authoritative**
- The simulation tick (movement, combat, AI, XP, loot rolls); spawning & rare/world-boss timers; drop rolls; persistence (local IndexedDB → server accounts).

**Net-new infrastructure required**
- Server runtime + transport; account/auth; interest management; state replication (snapshots/deltas); client prediction/reconciliation; lag compensation; **security/anti-cheat**; rate-limiting; chat/moderation; operational/observability tooling; instancing infrastructure for dungeons/raids; live economy controls.

## Save-data migration
- Local saves become a **one-time import** into server accounts (or remain a separate offline mode). The forward-only [save schema versioning](../technical/SAVE_SYSTEM_PLAN.md#save-schema-versioning--migration) makes a clean export feasible; inventory/progression/currency are already id-stable and zod-validated.

## Content changes required for groups
- World bosses re-tuned and/or **instanced** for parties; some best-in-slot may become **group content** via dungeons/raids — but **open-world solo progression and gear stay viable alone**, and group content must **not invalidate** it.

## Security risks introduced by going online
- The client becomes **untrusted**: every outcome must be server-validated; movement plausibility checks; rate limits; loot/economy exploit prevention; account security; moderation of social features. (Locally, a player editing their own save is harmless; online, it is cheating.)

## Optional design additions (only if online)
- A **Hunter Beastmaster** spec (pet) — deferred from beta ([CLASS_DESIGN](../design/CLASS_DESIGN.md#hunter-and-the-pet-question)); additional classes/races; seasons; cosmetics/transmog; trading economy; achievements. Each is a separate, scoped initiative — not a beta concern.

## What this appendix is **not**
- Not a roadmap, not a schedule, not a license to build networking now. The only multiplayer-related work permitted during the beta is the **cheap architectural seams** already justified in [FUTURE_MULTIPLAYER_BOUNDARIES](../technical/FUTURE_MULTIPLAYER_BOUNDARIES.md) (sim/render separation, command/event flow, entity-id targeting, seedable RNG, loot-owner field). Everything else here waits until the solo beta is proven.
