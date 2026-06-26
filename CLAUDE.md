# CLAUDE.md

Orientation for Claude Code (and any agent) working in this repo.

👉 **Read [AGENTS.md](./AGENTS.md) first.** It contains the current build status, the next phase to implement, how to run/verify, the owner's phase-by-phase workflow, the repo map, and the project conventions.

**TL;DR**
- **Oathbound** = a solo-friendly 3D browser MMORPG (TypeScript + Vite + Three.js). Full design/plan in [docs/](./docs/README.md).
- **Where we are:** see the *Current status* section in [AGENTS.md](./AGENTS.md) and the live log in [CHANGELOG.md](./CHANGELOG.md).
- **Workflow:** build **one** roadmap phase at a time, verify, commit/push, then **stop and ask** before the next. Don't build multiple phases at once.
- **Hard rule:** keep gameplay logic (`src/sim`, `src/core/ecs`) free of `three`/DOM; rendering only reads sim state.
