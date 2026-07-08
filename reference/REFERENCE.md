# Reference code (Finternet Labs' — read-only, not ours)

These are **pinned copies of Finternet Labs' community reference implementations**, vendored so Wayfinder
can build against — and learn from — the real thing (per `PROJECT_PLAN.md` §5, "use their real thing").
They are **their work, not ours.** We do not edit them; we read them and, in Phase 1, try to build and run
them. Anything we ever have to build ourselves because these don't run goes in `standin-service/`, clearly
marked, never mixed in here.

| Repo | Source | Pinned commit | Commit date | Language |
|---|---|---|---|---|
| `finternet-api/` | https://github.com/NishantJoshi00/finternet-api | `e07b8aa924e98a3879d3a9d327a19662dd310ee2` | 2024-12-13 | Rust |
| `finternet-sandbox/` | https://github.com/abishekk92/finternet-sandbox | `da50b2bbad05aa659a4e01fd6b44a54e3aad16ca` | 2024-08-26 | Rust |

Vendored on 2026-07-08. The nested `.git` directories were removed so the parent repo tracks these as plain
files (not broken submodules); the commit SHAs above are the record of exactly what version we have.

## What each one is (from their READMEs)

- **`finternet-api`** — "Finternet **Application** API." The application-facing API server (has `config/`,
  `samples/`, a `postman-collection/`, `src/`). Maps to the **Token managers / application API** surface in
  the §5.3 diagram (see `docs/00_architecture_map.md`, box 3).
- **`finternet-sandbox`** — "Finternet **Unified Ledger** Sandbox." A reference for Unified Ledger
  *providers*: `finternet-core` (primitives, runtime, smart-contract interface incl. **User Manager** and
  **Token Manager** traits) + `solana-ul-provider` (an example UL provider on Solana). Maps to the
  **Unified ledger** box (box 4).

## Heads-up for Phase 1

- Both are **stale** (last commits Dec 2024 / Aug 2024) and small community repos → they may not build
  cleanly on a current toolchain. Finding this out honestly is exactly what Phase 1 is for; the result goes
  in `docs/01_reference_code_status.md`.
- Building them needs **Rust/Cargo** (via `rustup`), which is **not yet installed** on this machine.
- Build artifacts (`target/`) are git-ignored.
