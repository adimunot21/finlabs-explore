# Wayfinder — a guided, working tour of the Finternet stack

Wayfinder is a personal learning project structured as a professional one. The goal is to genuinely
understand the **Finternet** — term by term, layer by layer — by building one real digital-wallet-style
application that *uses* Finternet Labs' actual specs and (where they run) their real reference code,
rather than reinventing the infrastructure. The working app is the proof and the vehicle; the
understanding is the point.

See **[`PROJECT_PLAN.md`](PROJECT_PLAN.md)** for the full plan and phases, and
**[`CLAUDE.md`](CLAUDE.md)** for how this project is built (teach the concept first, then the code).

## Start here

- **[`docs/00_glossary.md`](docs/00_glossary.md)** — plain-English definitions of every core Finternet
  term, each tagged to its paper section and the spec file that embodies it. The single most important
  document in the repo; updated every phase.
- **[`docs/00_architecture_map.md`](docs/00_architecture_map.md)** — the paper's §5.3 architecture diagram
  mapped onto the real spec files and reference repos.
- **[`docs/paper/`](docs/paper/)** — the source paper: *Finternet: technology vision and architecture*
  (Nilekani, Varma, Shetty, 2024; CC BY-SA 4.0).

## Layout

| Path | What it is | Whose it is |
|---|---|---|
| `docs/` | Glossary, phase write-ups, the paper | Ours |
| `specs-vendor/` | Pinned copy of `finternet-io/specs` (see its `VENDOR.md`) | **Finternet Labs' — vendored, not ours** |
| `reference/finternet-api/` | Cloned Unified Ledger reference (Rust) — read-only | **Finternet Labs' community code, not ours** |
| `reference/finternet-sandbox/` | Cloned ledger-infra reference (Rust) — read-only | **Finternet Labs' community code, not ours** |
| `app/` | The Wayfinder wallet app (React) | Ours — added in Phase 3 |
| `standin-service/` | Minimal stand-ins, only where their code can't be used | Ours — added when needed, always marked `// STAND-IN:` |

Anything under `reference/` and `specs-vendor/` is Finternet Labs' work, included here so Wayfinder builds
against the real thing. Where we ever have to build a stand-in for a piece their code doesn't cover, it is
logged and clearly marked as such.

## Status

- **Phase 0** (Glossary & Orientation) — done.
- **Phase 1** (Run their reference code) — done. `reference/finternet-api` builds and runs (a real
  in-memory Finternet Application API: users → token managers → accounts); the Solana Unified Ledger
  provider does not build. See [`docs/01_reference_code_status.md`](docs/01_reference_code_status.md).
- **Phase 2** (Read the specs, file by file) — done. Plain-English walkthrough of all 8 API interfaces and
  6 schema domains in [`docs/02_spec_walkthrough.md`](docs/02_spec_walkthrough.md).
- **Phase 3** (Identity & keys) — done. `standin-service/` (spec-validated) + `app/` (React) do a real
  create-account → DID → sign → verify flow with genuine Ed25519/`did:key` crypto. See
  [`docs/03_identity_and_keys.md`](docs/03_identity_and_keys.md).
- **Phase 4** (Trust & credentials) — done. A stand-in trust provider issues a real Ed25519-signed
  verifiable credential bound to your DID; verification runs four independent checks and revocation makes it
  fail while the signature stays valid. See [`docs/04_credentials.md`](docs/04_credentials.md).
- **Phase 5** (Assets: tokens) — done. A UNITS token is minted from a KYC-gated token class, with the
  compliance hook enforced at mint time — minting is refused unless the owner holds a valid credential, so a
  non-compliant asset can't exist. See [`docs/05_tokens.md`](docs/05_tokens.md).
- **Phase 6** (Movement) — done. Transfer a token on a stand-in unified ledger, recorded as a tamper-evident
  state-commitment chain with a real Merkle proof of inclusion the browser re-verifies (leaf→root). See
  [`docs/06_movement.md`](docs/06_movement.md).

## Running it (Phases 3–6)

```bash
cd standin-service && npm install && npm start   # identity backend on :8081
cd app && npm install && npm run dev             # Wayfinder UI on :5173 (proxies /api -> :8081)
```

Building the Rust reference code needs Rust (`rustup`); it compiles to a git-ignored `target/`.
