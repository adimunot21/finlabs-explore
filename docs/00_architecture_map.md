# 00 — Architecture Map: the paper's §5.3 diagram → real specs & code

The paper's **§5.3 "High-Level Architecture for the Finternet"** (p.28) is the one picture the whole
project hangs off. This doc redraws it, then maps **every box** to (a) the spec file(s) in `specs-vendor/`
that define its shape and (b) the reference repo in `reference/` that implements it — or flags where there's
no reference code, which is where a Phase-6-style stand-in may later be needed. At the end of each phase we
come back here and check off which box we just built or talked to (per `CLAUDE.md` rule #9).

## The diagram (redrawn from §5.3)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  FINTERNET                                     │
│                                                                                │
│  APPLICATIONS   [ e-banking ] [ digital wallet ] [ financial apps ] [ … ]      │
│                                                                                │
│                              ▲  on/off ramps  ▲                                │
│                              │    USERS        │                               │
│                              ▼ (individuals &  ▼                               │
│                                 businesses)                                    │
│                                                                                │
│  TOKEN MANAGERS            ┌──────────────────────┐        TRUST & VALUE-      │
│  (issuance, mgmt,          │   UNIFIED LEDGER      │        ADDED PROVIDERS     │
│   synchronization)         │  ┌────────┬────────┐ │        ┌───────────────┐   │
│  ┌──────────────────┐      │  │tok'ised│tok'ised│ │        │ Attestors     │   │
│  │ Central/commercial│     │  │equities│deposits│ │◄──────►│ Verifiers     │   │
│  │ banks             │─┐   │  ├────────┼────────┤ │  UILP  │ Lockers       │   │
│  │ Asset managers    │ │   │  │tok'ised│tok'ised│ │(unified│ Guarantors    │   │
│  │ Private/public co │ │   │  │  r.e.  │ m.funds│ │ inter- │ …             │   │
│  │ Real-estate       │ │   │  └────────┴────────┘ │ ledger │               │   │
│  │  registrars       │ │   └──────────────────────┘ proto) └───────────────┘   │
│  └──────────────────┘ └── shared/private ledgers ──┘                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  DIGITAL INFRASTRUCTURE  (identity, digital signatures, electronic registries) │
├──────────────────────────────────────────────────────────────────────────────┤
│  LAWS, REGULATIONS, RULES AND OTHER GOVERNANCE NORMS                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Box → spec → code

| # | Box (§5.3) | What it is (see glossary) | Spec in `specs-vendor/` | Reference code in `reference/` | Wayfinder phase |
|---|---|---|---|---|---|
| 1 | **Applications** (e-banking, digital wallet, financial apps) | The user-facing layer — this is what **we** build (Wayfinder wallet). | `api/clients-interfaces.yaml` (app registration) | `finternet-api/samples`, `postman-collection` (examples of app→API calls) | **Ours** — Phase 7 (`app/`) |
| 2 | **Users** (+ on/off ramps) | Individuals & businesses at the center; ramps bridge to the outside world. | `api/accounts-interfaces.yaml`, `schemas/account/v1/**` | `finternet-sandbox` core **User Manager** trait | Phase 3 |
| 3 | **Token managers** (issuance, management, synchronization) | Banks, asset managers, registrars that issue/maintain tokens; may run their own private/shared ledger synced to the unified ledger. | `api/token-interfaces.yaml`, `api/token-class-config-interfaces.yaml`, `schemas/token{,-class}/**` | **`finternet-api`** ("Finternet Application API"); `finternet-sandbox` core **Token Manager** trait | Phase 5 |
| 4 | **Unified ledger** (tokenised equities/deposits/real-estate/mutual-funds; the ledger stack) | The programmable ledger: immutable ledger → accounts → tokens → smart contracts → programmability. | `schemas/token/**`, `schemas/transaction/**` (state/audit); `schemas/core/v1/**` | **`finternet-sandbox`** = `finternet-core` (primitives, runtime, smart-contract interface) + `solana-ul-provider` (example UL provider) | Phase 6 |
| 5 | **Unified Interledger Protocol (UILP)** (arrow between ledgers) | Open protocol to move value **between** unified ledgers with finality, built on proof chains. | *No wire-level spec* (proof types appear in `schemas/transaction` `ProofProfile`); `api/registry-interfaces.yaml` covers discovery | Sandbox core hints at provider integration; **no runnable UILP** | Phase 6 — **highest stand-in risk** ⚠ |
| 6 | **Trust & value-added providers** (attestors, verifiers, lockers, guarantors) | Parties that add/verify trust around assets and issue credentials. | `api/registry-interfaces.yaml`, `schemas/credential/v1/**` | none obvious | Phase 4 — **likely stand-in** ⚠ |
| 7 | **Digital infrastructure** (identity, digital signatures, electronic registries) | The shared substrate: DIDs, PKI/keys, registries. | `api/key-management-interfaces.yaml`, `api/registry-interfaces.yaml`, `schemas/account` (`did`) | `finternet-sandbox` core primitives (crypto) | Phase 3–4 |
| 8 | **Laws, regulations, governance** (bottom band) | The governance layer; "safe by design" pushes *some* of it into code (compliance hooks). | `api/delegations-interfaces.yaml`, `api/token-class-config-interfaces.yaml` (hooks/overrides) | — (conceptual) | Phase 5 (compliance hook demo) |

## What this tells us going in

- **We own box 1** (the app) and, per the plan, use *their* boxes 3–4–7 wherever their code runs — that's
  exactly what **Phase 1** will test by trying to build/run `finternet-api` and `finternet-sandbox`.
- **Boxes 5 (UILP) and 6 (trust providers) are the danger zones** — no runnable reference code, and UILP has
  no wire-level spec. These are the most likely places we'll build a clearly-labeled `standin-service/`.
- Everything above is grounded in files that now exist locally: `specs-vendor/` (pinned `7eb766d`) and
  `reference/finternet-api` (`e07b8aa`), `reference/finternet-sandbox` (`da50b2b`).

*Update this table's "reference code" column after Phase 1, once we know what actually builds and runs.*
