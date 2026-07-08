# Project Plan: Wayfinder — A Guided, Working Tour of the Finternet Stack

## 0. Read this first — what changed and why

Earlier drafts of this plan had you building a full parallel platform (your own ledgers, your own everything) to *prove* understanding. That's the wrong shape for your actual goal.

**Your actual goal:** understand what Finternet is, term by term and layer by layer, by building one real, working application that *uses* the things Finternet Labs has already built — their specs, their schemas, and (as much as realistically possible) their actual reference code — rather than reinventing it. You are not trying to compete with or duplicate their infrastructure. You're trying to become someone who genuinely gets it, with a working project as the proof and the learning vehicle.

This means: fewer services, much more explanation, and a strong bias toward "plug into their real thing" over "build my own version of their thing." Where their real thing doesn't exist or doesn't run, we build the smallest possible stand-in — and we say so explicitly, every time, so you never confuse "something I had to fake to keep going" with "something Finternet actually provides."

## 1. Goal & Success Criteria

**Goal:** Build one real application — a Finternet "digital wallet"-style app — that walks through the entire lifecycle the paper describes (identity → credentials → tokenized assets → cross-ledger settlement → audit trail), talking to real Finternet specs and, wherever it actually works, their real reference backend code.

**Definition of "done":**
- You can explain, in your own words, every term in the glossary (Phase 0 deliverable) without looking it up.
- You can point to the exact section of the paper and the exact spec file behind every screen/feature in the app.
- The app performs a full lifecycle end-to-end: create an account → get a KYC credential → mint a tokenized asset → move it to another account (ideally cross-ledger) → see the full audit trail with proofs.
- Every place where we had to build a stand-in instead of using their real thing is clearly documented and clearly marked in code (`// STAND-IN: ...` comments, plus a table in the docs).
- Code is clean, tested, and something you could show a Finternet engineer without embarrassment — but the code is in service of your understanding, not the other way around.

## 2. Target User / Use Case

You. This is a personal learning project structured as a professional one, so that the by-product is both (a) real understanding and (b) a portfolio piece that's honest about what it is: "I built a working application on top of Finternet's real specs and reference infrastructure, and here's proof I understand every layer."

## 3. Hardware Constraints

Lenovo Legion Y540, i7-9750H, 32GB RAM, GTX 1650 4GB, Ubuntu 24.04. Nothing in this plan needs the GPU. If Phase 9 (optional fraud detection, tied to paper §5.5) happens, it's a small enough model to run on this machine without RunPod.

## 4. The Core Rule for How Claude Code Should Work With You

Because you're starting with zero background, every single phase must teach before it codes. Concretely (this is also written into `CLAUDE.md`, but stating it here too because it's the most important thing in this document):

1. **Before writing any code for a concept**, Claude Code explains it in plain English: what it is, why it exists, what problem it solves, and where it appears in the paper (section number) and in the specs repo (file name).
2. **No unexplained jargon.** The first time a term appears (token manager, unified ledger, UILP, proof chain, verifiable credential, DID, token class, delegation, attestation, finality...) it gets a one-paragraph plain-language definition before it's used in code or discussion.
3. **A living glossary file** (`docs/00_glossary.md`) is added to at every phase, never left to go stale.
4. **Every phase ends by relating the code back to the architecture diagram** in the paper (§5.3) — which box did we just build or talk to?

## 5. System Architecture (What We're Actually Building)

```
                 ┌────────────────────────────┐
                 │   Wayfinder Wallet App       │   <- THIS is what we build (the "Applications" layer)
                 │   (React, talks to specs)    │
                 └──────────────┬───────────────┘
                                │  calls APIs shaped exactly like
                                │  specs/api/*.yaml
                 ┌──────────────▼───────────────┐
                 │   Finternet Backend            │
                 │   (real, where possible)       │
                 │                                 │
                 │  Option A (preferred):          │
                 │   Their actual reference code:  │
                 │   - NishantJoshi00/finternet-api│
                 │     (Unified Ledger, Rust)      │
                 │   - abishekk92/finternet-sandbox│
                 │     (Ledger Infra, Rust)        │
                 │                                 │
                 │  Option B (fallback, labeled):  │
                 │   A minimal stand-in service we │
                 │   build ONLY for pieces their   │
                 │   reference code doesn't cover  │
                 │   or won't run                  │
                 └─────────────────────────────────┘
```

We are the top box. The bottom box is theirs whenever it can be; ours only when it has to be, and clearly marked when it is.

## 6. Technology Choices & Justification

| Choice | Why |
|---|---|
| React + Vite (Wayfinder app) | Simplest way to build a real, demoable UI without heavy framework overhead — the app itself is not the hard part, understanding what it calls is. |
| TypeScript, typed API client generated from `specs/api/*.yaml` | Generating types straight from their OpenAPI specs means you're reading their actual contract, not a paraphrase of it. |
| Rust toolchain (to attempt running `finternet-api` and the Ledger Infra repo) | Their reference code is Rust — running it as-is, even if you never write Rust yourself, is how you see the real thing work instead of a guess at how it works. |
| A small Node/Express stand-in service (only if needed) | Kept intentionally minimal — its only job is to unblock the parts of the lifecycle their reference code doesn't implement, e.g. credential issuance or a second ledger for cross-ledger settlement. |
| `express-openapi-validator` (on the stand-in, if built) | Even the stand-in validates against their real OpenAPI spec, so it's shaped correctly even when it's not their code. |
| Vitest + Playwright | Basic tests for the app and an end-to-end test that runs the full lifecycle script. |
| Docker Compose | One-command bring-up of whatever combination of real reference services + stand-ins ends up running. |

## 7. Phase Breakdown

**Phase 0 — Glossary & Orientation (no code)**
Read the paper again section by section and the specs repo top-level READMEs. Produce `docs/00_glossary.md`: plain-English definitions of every core term (Finternet, tokenization vs. dematerialization vs. digitization, unified ledger, token manager, UILP, proof chain, verifiable credential/attestation, DID, addressing, token class, delegation, finality, the three U's, the three traps). This file is the single most important deliverable of the whole project and gets revisited every phase.
*Deliverable:* a glossary you could teach from, plus a one-page "how the architecture diagram maps to real repos" doc.

**Phase 1 — Try to Actually Run Their Reference Code**
Clone `NishantJoshi00/finternet-api` and `abishekk92/finternet-sandbox`. Read their READMEs, install Rust/Cargo, attempt to build and run both. Document exactly what worked, what didn't, and why (missing docs, unbuilt dependencies, incomplete features — whatever's actually true).
*Deliverable:* `docs/01_reference_code_status.md` — an honest account of what their real code can currently do for you, which becomes the basis for every later decision about "use theirs" vs. "build a stand-in."

**Phase 2 — Read the Specs, File by File**
Go through every file in `specs/api/` and `specs/schemas/` and write, before any code, a plain-English paragraph per file: what it's for, what real-world concept it maps to, and one concrete example. No code changes yet — this phase is entirely about comprehension, captured in writing so it sticks.
*Deliverable:* `docs/02_spec_walkthrough.md`.

**Phase 3 — Identity: Accounts & Keys**
Explain DIDs, key pairs, digital signatures, and Finternet addressing (§5.4 of the paper). Then create a real account — against their reference Unified Ledger if Phase 1 got it running, otherwise against a minimal stand-in — generate a keypair, sign something, verify it.
*Deliverable:* a working account creation flow in the Wayfinder app, plus an explanation you can repeat back of what a DID and a digital signature actually are and why Finternet needs both.

**Phase 4 — Trust: Registry & Verifiable Credentials**
Explain the registry (how ledgers/providers become discoverable) and W3C Verifiable Credentials (how KYC works without a central database). Issue a mock KYC credential to your account, verify it, then revoke it and watch verification fail.
*Deliverable:* a credential issuance/verification flow in the app; you can explain what a "trust service provider" and an "attestation" are.

**Phase 5 — Assets: Tokens & Token Classes (UNITS)**
Explain the UNITS token model (metadata/data/claims/identities/state) and the idea of a compliance hook ("safe by design," §4.4). Mint a token that requires your Phase 4 credential to exist first.
*Deliverable:* mint fails without a credential, succeeds with one — and you can explain why that's the paper's "regulation at the flow level" idea made real.

**Phase 6 — Movement: Transactions, Proof Chains, and (if feasible) Interledger Settlement**
Explain the transaction/audit model and the concept of a "proof chain" (§5.4.6, UILP). Move the token from one account to another. If a second real Unified Ledger implementation genuinely isn't runnable, build the smallest possible second ledger purely so cross-ledger settlement is demonstrable — labeled clearly as a stand-in, not a contribution.
*Deliverable:* a transfer happens, with a real proof attached, queryable afterward; you can explain what UILP is trying to solve even if our implementation of it is a simplified stand-in.

**Phase 7 — Put It Together: The Wayfinder App**
Wire Phases 3–6 into one coherent, demoable UI: create account → get credential → mint token → transfer → view audit trail with proofs.
*Deliverable:* a two-minute demo you can give someone with zero context and have them understand what Finternet is trying to do.

**Phase 8 — Tie It Back to the Paper**
Write `docs/09_how_this_maps_to_finternet.md`: a section-by-section walk through the paper, pointing to exactly what part of your app demonstrates each idea (the three U's, the three traps, tokenization vs. digitization, the four asset types, the fraud-tackling model).
*Deliverable:* the document that proves — to you and to anyone reading it — that you understand the whole thing, not just the code you wrote.

**Phase 9 — Optional: Fraud/Anomaly Detection**
Ties to §5.5. A small anomaly detector watches the transaction stream. Skip entirely if time is short; this is not part of the core understanding goal.

## 8. Directory Structure

```
wayfinder/
├── app/                          # The Wayfinder wallet app (React)
├── reference/
│   ├── finternet-api/            # Cloned, real reference Unified Ledger (Rust) — read-only, not ours
│   └── finternet-sandbox/        # Cloned, real Ledger Infra (Rust) — read-only, not ours
├── standin-service/               # ONLY what's needed to unblock the lifecycle; heavily commented as such
├── specs-vendor/                  # Vendored finternet-io/specs, used for type generation + validation
├── docs/
│   ├── 00_glossary.md
│   ├── 01_reference_code_status.md
│   ├── 02_spec_walkthrough.md
│   ├── 03_identity_and_keys.md
│   ├── 04_credentials.md
│   ├── 05_tokens.md
│   ├── 06_settlement.md
│   ├── 07_app_walkthrough.md
│   └── 09_how_this_maps_to_finternet.md
├── docker-compose.yml
├── .github/workflows/ci.yml
├── CLAUDE.md
├── PROJECT_PLAN.md
└── README.md
```

## 9. Known Risks & Open Questions

- **Their Rust reference repos may not build cleanly** — they're early-stage community code (small commit counts, no releases). Phase 1 exists specifically to find this out early and honestly, before any app code depends on assumptions about what they can do.
- **UILP has no public wire-level spec.** Any cross-ledger settlement we build is our own reasonable interpretation, not their protocol — say so every time it comes up.
- **The temptation will be to quietly build more of our own infrastructure** because it's easier than fighting with someone else's undocumented Rust service. Resist this — every time a stand-in gets built, it must be logged in `docs/01_reference_code_status.md` and justified.
- **Scope discipline:** Phase 9 is the only optional phase. Everything else is the minimum needed for genuine end-to-end understanding.
