# 01 — Reference Code Status (Phase 1)

**Purpose (from `PROJECT_PLAN.md` §7, Phase 1):** honestly find out what Finternet Labs' real reference
code can actually do on this machine, so every later "use theirs vs. build a stand-in" decision rests on
fact, not assumption. This is the basis for those decisions; it gets updated if the situation changes.

**When:** 2026-07-09. **Toolchain installed this phase:** Rust **1.96.1** (stable, via `rustup`) — nothing
Rust-related was installed before. **Machine:** i7-9750H, 32 GB, Ubuntu 24.04. No GPU used.

## TL;DR

| Repo / crate | Builds? | Runs? | Verdict |
|---|---|---|---|
| `reference/finternet-api` (Application API server) | ✅ 27s | ✅ full identity flow works | **USE THEIRS** — our backend for Phases 3–5 |
| `reference/finternet-sandbox/finternet-core` | ✅ 31s | n/a (library of definitions) | **Reference reading only** — not a service |
| `reference/finternet-sandbox/solana-ul-provider` | ❌ dependency resolution fails | ✗ | **Not viable** — ledger/UILP layer will need a stand-in later |

One real, working service (`finternet-api`) covers the **Applications → Users → Token-manager → Accounts**
surface — exactly what Phases 3–5 need. The Solana-based Unified Ledger provider does not build. Net: we
have a real backend for identity/accounts; the *unified-ledger + UILP* layer (arch-map boxes 4–5) is where a
labeled stand-in is most likely.

---

## 1. `finternet-api` — ✅ builds and runs (USE THEIRS)

**What it is.** A self-contained **axum** web server with **in-memory** storage (`AppState::imc_backed`) —
no database, no blockchain, no external services. Pure-Rust deps only (tokio, axum, serde, config, tracing).
Maps to the **Token managers / Application API** surface of the §5.3 diagram (see `00_architecture_map.md`,
box 3), and gives us Accounts/Users for box 2.

**Build & run (reproducible):**
```bash
. "$HOME/.cargo/env"
cd reference/finternet-api
cargo build --bin server                 # ~27s first time; deps are all crates.io, no patches
RUN_ENV=Development ./target/debug/server # listens on 127.0.0.1:8080 (config/development.toml)
```

**Verified end-to-end** (real requests → real responses, in-memory):

| Step | Request | Result |
|---|---|---|
| Health | `GET /health` | `Health is Good!` (200) |
| Create user | `POST /v1/users` `{email,name,public_key,ua_addr}` | `{"user_id":"Z6N-T","ua_addr":"alice"}` |
| Read user | `GET /v1/users/{id}` | `{"ua_addr","email","name"}` |
| Create token manager | `POST /v1/token_managers` `{token_manager_name,public_key}` | `{"token_manager_id":"-B_oc",...}` |
| Register supported asset | `POST /v1/token_managers/{id}/supported_assets` `{asset_type:"cash",smart_contract_refs}` | `{"supported_asset_id":"HLaQt","asset_type":"cash"}` |
| Create account | `POST /v1/users/{uid}/accounts` `{token_manager_id,account_name,asset_type:"cash",token_manager_ref}` | `{"account_id":"9burX",...}` |
| Read account | `GET /v1/users/{uid}/accounts/{aid}` | account + `total_assets: {money:{USD,0}}` |

**The data model we learned (important for later phases).** The API enforces a real hierarchy:
`User` → (a `TokenManager` that declares `SupportedAsset`s) → `Account` (bound to a token manager + an
`asset_type`). An account can only be created for an `asset_type` the token manager supports — a small taste
of the paper's "token manager governs issuance" idea. `AssetType` is currently just `Cash` (enum,
serialized lowercase `"cash"`), `Currency` just `USD`.

**Caveats / limits (honest):**
- **In-memory only** — all data is lost on restart. Fine for a demo/learning backend; not persistent.
- **Several routes are stubs** returning `NotImplemented`: `update_user`, `delete_user`, `get/update/delete
  token_manager`, `list_accounts`, `update/delete account`. Create + read paths work; some update/delete/list
  paths don't.
- The bundled `samples/*.sh` are **out of date** (they omit `token_manager_id` / `asset_type`) — the working
  request shapes are the table above (taken from `src/app/**/types.rs`, the real contract).
- It has its **own** `docs/openapi-spec.yaml`, which is *not* the same as `specs-vendor/`. Treat
  `specs-vendor/` as the canonical contract; this server is an early implementation of a subset.

**Decision:** **Use it** as Wayfinder's backend for Phase 3 (accounts/keys) and as far into Phase 5 as its
model allows. Where it lacks a lifecycle piece (credentials, real tokens, transfers, proofs), we extend with
a clearly-labeled stand-in rather than forking their Rust.

---

## 2. `finternet-sandbox / finternet-core` — ✅ builds (reference only)

**What it is.** A small **library crate** (`serde`, `serde_json`, `ssi-caips`) exposing three modules:
`primitives`, `runtime`, `smartcontract_interface`. It defines *traits and types* (e.g. a storage/smart-
contract interface with a `FinternetUID` and `load(...) -> Deserializer`), not a runnable program.

**Build (reproducible, standalone):** builds cleanly in ~31s (`cargo build`, one deprecation warning). It
pulls a large `ssi-*` / `json-ld` dependency tree (W3C VC / JSON-LD tooling), which is consistent with the
paper's credentials model — useful to read when we get to Phase 4.

**Decision:** **Reference reading**, not a service to run. Its trait definitions are the closest thing to a
"what a Unified Ledger provider must implement" contract in Rust; worth revisiting in Phases 5–6.

---

## 3. `finternet-sandbox / solana-ul-provider` — ❌ does not build (stand-in territory)

**What it is.** An **example** Unified Ledger provider built on **Solana + Anchor** (on-chain programs under
`src/solana-program/`, plus Rust handlers). It's the sandbox's demonstration of box 4 (unified ledger) on a
real chain.

**Two hard blockers, hit before any of our code runs:**

1. **A patched dependency's pinned commit is gone.** The workspace `Cargo.toml` has:
   ```toml
   [patch.crates-io]
   curve25519-dalek = { git = "…/block-mesh/curve25519-dalek", branch = "rustls-dep-hell-1-18" }
   aes-gcm-siv     = { git = "…/block-mesh/AEADs",           branch = "rustls-dep-hell-1-18" }
   ```
   `cargo build` fails at **dependency resolution** (exit 101):
   ```
   error: failed to load source for dependency `aes-gcm-siv`
     unable to update https://github.com/block-mesh/AEADs?branch=rustls-dep-hell-1-18#d478a439
     revision d478a43926ad0b8bbfc189ff7238c8238406cd5f not found
   ```
   The third-party fork it pins to has moved/removed that commit — classic **bit-rot** in a Solana
   "dependency-hell" workaround. This blocks the build regardless of toolchain.

2. **Missing git submodule.** The workspace member `solana-ul-provider/ul-api` is a git **submodule**
   (`git@github.com:abishekk92/finternet-ul-api.git`) that our clone didn't fetch, so the workspace won't
   even parse until it's populated. (The repo *is* public over HTTPS — I fetched it into a scratch copy to
   get past this — but blocker #1 remains.)

Beyond these, a genuine build would also need the **Solana CLI + Anchor toolchain** and `cargo build-sbf`
for the on-chain programs — a heavy, chain-specific setup. Given `finternet-api` already covers the surface
Phases 3–5 need, chasing this is high-effort / low-value for the *understanding* goal.

**Decision:** **Do not use.** When we reach Phase 6 (movement / interledger settlement / proof chains), the
unified-ledger + UILP layer will be a **clearly-labeled stand-in** (`standin-service/`, `// STAND-IN:`), as
the plan anticipated (arch-map boxes 4–5; UILP has no wire-level spec either). Reason logged here as required.

*Note:* the `ul-api` submodule (`finternet-ul-api`) is itself a substantial "Ledger API for Finternet"
crate. It might build on its own, but it's not on the critical path for our goal, so it's left un-pursued for
now (revisit if Phase 6 needs a richer ledger than a minimal stand-in).

---

## Stand-ins built (running log)

Per `CLAUDE.md`, every stand-in we build (because the real reference code doesn't cover it or doesn't run)
is logged here with its reason. Its **shape is always the specs'** — validated against the real OpenAPI —
only the implementation behind it is ours.

| Stand-in | Reason it exists | Specs it validates against | Marked |
|---|---|---|---|
| `standin-service/` — identity (Phase 3) | The one runnable reference (`finternet-api`) implements an **older, different** shape than the canonical specs (`/v1/users` + plain JSON vs. `/v1/account/create` + envelope + DIDs; see `docs/02_spec_walkthrough.md`). We chose to build Wayfinder to the **canonical specs**, so we need a spec-shaped identity backend. | `specs-vendor/api/accounts-interfaces.yaml` + `key-management-interfaces.yaml`, enforced at runtime by `express-openapi-validator` | `// STAND-IN:` headers on `config.ts`, `store.ts`, `handlers.ts`, `app.ts`; this table |
| `standin-service/src/credentials.ts` — credentials (Phase 4) | `specs-vendor/api` has **no credential-issuance endpoint** (credentials are modeled as tokens; there's a schema but no issue/verify/revoke API). So the endpoints `/v1/credentials/{issue,verify,revoke,list}` are **our design**. | The **credential data** is validated (ajv) against the real JSON Schema `specs-vendor/schemas/credential/credential.schema.json` on issue and verify. | `// STAND-IN:` header on `credentials.ts`; this table |
| `standin-service/src/tokens.ts` + `tokenclasses.ts` — tokens (Phase 5) | The one runnable reference (`finternet-api`) implements only users→token_managers→accounts (older shape); it has **no canonical UNITS token mint/get/search** (established Phase 1). The compliance **behaviour** (mint gated on a valid credential) is also our logic. | Token **instances** validated (ajv, draft-07) against the real `specs-vendor/schemas/token/token.schema.json`; the endpoints `/v1/registry/tokenclasses/*` + `/v1/token/{mint,get,search}` validated at the edge against the real `token-interfaces.yaml`. | `// STAND-IN:` headers on `tokens.ts`, `tokenclasses.ts`; this table |
| `standin-service/src/ledger.ts` — unified ledger + proof engine (Phase 6) | Finternet's real Unified Ledger provider (`solana-ul-provider`) does **not build** here (bit-rotted pinned dep; Phase 1). So this in-memory ledger + Merkle/proof engine is ours. **The crypto is real**: SHA-256 state-commitment hash chain and Merkle proofs, independently re-verified in the browser. | `/v1/token/transact` + `/v1/transaction/get` + `/v1/token/transactions` validated at the edge against `token-interfaces.yaml`; `/v1/transaction/proof` binds the spec's own `ApiResponse_ProofDetails` component (path injected in-memory — see `spec.ts` shim #4). | `// STAND-IN:` header on `ledger.ts`; this table |

**What's real vs. stand-in inside it:** the cryptography is **real** — genuine Ed25519 keypairs, `did:key`
encoding, and sign/verify (interoperable with any standard implementation; see `src/crypto.ts` + passing
`src/crypto.test.ts`). What's a *stand-in* is the surrounding service: in-memory storage, opaque tokens, and
**custodial private-key storage** (a real KMS never returns/holds your private key). Two in-memory validator
shims are documented in `src/spec.ts` (strip type-less `nullable`; merge the two specs into one document).

**Verified end-to-end (Phase 3):** `checkAvailability → account/create (201) → address/resolve → account/get
→ account/keys/search → keys/sign → verify` — a signature over the real message verifies **true**, and over a
tampered message verifies **false**, using the public key recovered from the account's `did:key`.

## What this means for the plan

- **Boxes 2 & 3** (Users, Token managers / Application API) — **covered by real code** (`finternet-api`).
  Phase 3 builds on it directly.
- **Box 4 (Unified ledger)** — no runnable reference (Solana provider broken). Expect a stand-in in Phase 6.
- **Box 5 (UILP)** — no code *and* no wire-level spec → definitely a stand-in when we get there.
- **Box 6 (Trust/credential providers)** — not exercised yet; `finternet-core` shows the W3C-VC/JSON-LD
  direction. Revisit in Phase 4.

## Environment notes (reproducibility)

- Rust `1.96.1` stable (`rustup default stable`). `. "$HOME/.cargo/env"` to put `cargo` on `PATH`.
- All build *experiments* for the sandbox were done in a scratch copy so `reference/` stays pristine
  (the vendored tree has **no** `target/` committed — it's git-ignored — and the `ul-api` submodule dir there
  remains empty by design; see `reference/REFERENCE.md`).
- `finternet-api` was built in place; its `target/` is git-ignored and its `Cargo.lock` was unchanged.
