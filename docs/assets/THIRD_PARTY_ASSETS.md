# Third-Party Assets Registry

The authoritative log of **every** externally-sourced asset in Oathbound. Governed by [THIRD_PARTY_ASSET_POLICY](./THIRD_PARTY_ASSET_POLICY.md). An asset **must not** ship without a complete row here.

> **Current status: EMPTY.** No third-party assets have been acquired. The project is **procedural-first** ([ASSET_PIPELINE](./ASSET_PIPELINE.md)); this file is the template/registry to be filled as (and only if) external assets are introduced. **No assets were downloaded during planning.**

## Registry

| # | Asset name | Type | Source (URL) | Creator | License | License URL | Attribution required? | Modifications | File location | Date acquired |
|---|-----------|------|--------------|---------|---------|-------------|----------------------|---------------|---------------|---------------|
| — | *(none yet)* | — | — | — | — | — | — | — | — | — |

## How to add an entry
1. Confirm the license is allowed ([policy](./THIRD_PARTY_ASSET_POLICY.md#allowed-license-types-in-order-of-preference)).
2. Fill **every** column (no blanks). "Attribution required?" = Yes/No; if Yes, ensure it appears on the Credits/Licenses screen.
3. Place the file under `/public/assets/...` and put that path in **File location**.
4. Record any edits in **Modifications** (e.g., "recolored, decimated to 400 tris").
5. Commit the asset **and** this registry update together.

## Field definitions
- **Type:** model / texture / audio / font / icon / shader / data.
- **License:** the specific license of *this file* (CC0, CC-BY-4.0, etc.) — not a vague "free".
- **Attribution required?:** if Yes, the exact attribution text/owner to display.
- **Modifications:** what we changed (or "none").
- **Date acquired:** ISO date.

## Audit
Reviewed whenever an asset is added and at the [Technical Beta Gate](../production/RELEASE_GATES.md#8-technical-beta-gate). Any asset lacking a complete entry blocks release (R20 — [RISK_REGISTER](../production/RISK_REGISTER.md)). A `LICENSES`/Credits screen is generated from this registry.
