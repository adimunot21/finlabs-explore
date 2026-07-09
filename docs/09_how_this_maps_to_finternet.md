# 09 — How Wayfinder Maps to the Finternet Paper (Phase 8)

**Purpose.** This is the capstone document. It walks the paper — *Finternet: technology vision and
architecture*, v1.1, 22 April 2024 (`docs/paper/`) — **section by section**, and for each idea says three
things: what the paper actually claims (quoted, not paraphrased from memory), what part of Wayfinder
demonstrates it, and — the part that matters most — **an honest verdict on whether we really demonstrated it
or merely understood it.**

The point of this project was never the code. It was to be able to explain Finternet. This document is the
test of whether that worked. Where we fell short, it says so plainly.

## Verdict legend

| | Meaning |
|---|---|
| ✅ | **Demonstrated** — you can run it, watch it happen, and it does the real thing (real crypto, real schema). |
| 🟡 | **Partially demonstrated** — the mechanism exists but a meaningful part of the idea is missing. |
| 📖 | **Understood, not built** — I can explain it; there's no code for it. Stated so, not hidden. |
| ⚠ | **Stand-in** — the shape and cryptography are real, but the implementation behind it is ours, not Finternet Labs'. Every one is logged in [`01_reference_code_status.md`](01_reference_code_status.md). |

---

## Scorecard (the whole paper at a glance)

| Paper section | Idea | Where in Wayfinder | Verdict |
|---|---|---|---|
| §2.2 | digitization → dematerialization → **tokenization** | `schemas/token` instance vs. our plain account row | ✅ |
| §3.1 | **User-centric** | `did:key` you control; browser-side verification | 🟡 (custodial keys) |
| §3.2 | **Unified** (any asset, anyone, anywhere) | one asset class, one ledger | 🟡 |
| §3.3 | **Universal** + "rules applied at the flow level" | compliance hook on mint | ✅ |
| §4 | the **four asset types** (A–D by governance model) | `PROP-DEED` ≈ Type C; credential ≈ Type B | 🟡 |
| §4.1 | ownership types (sole/joint/fractional) | sole only | 📖 |
| §4.4 | **"safe by design"** | `tokens.ts` mint refusal | ✅ |
| §5.1 | three traps (standardization/centralization/synchronization) | built to their specs; single process | 🟡 / ⚠ |
| §5.3 | high-level architecture (8 boxes) | [`00_architecture_map.md`](00_architecture_map.md) | ✅ mapped |
| §5.4.1 | **tokens**, UNITS five sections | `token.schema.json`-validated instance | ✅ |
| §5.4.1 | **trusted proof chains** (tokens + credentials + attestations chained) | transaction proof chain only | 🟡 |
| §5.4.2 | token managers | token-class `identities` + policy | 🟡 |
| §5.4.3 | **verifiable & portable credentials** | issue → verify → revoke, real Ed25519 | ✅ ⚠ |
| §5.4.4 | ledger design (3 layers), immutability, finality | append-only ledger, state commitments | 🟡 ⚠ |
| §5.4.5 | contracts (Pipe / Platform / Network) | — | 📖 |
| §5.4.6 | **UILP** + interledger settlement | Merkle proof built; one ledger only | 🟡 ⚠ |
| §5.5 | tackling fraud (impersonation/circumvention/compromise) | signatures, compliance hook | 🟡 |

---

## §1–§2 — The problem, and building at societal scale

The paper opens on **fragmentation**: "high transaction costs, often exacerbated by vendor lock-in and a
dependency on isolated, non-interoperable technologies" (§1). Finternet is pitched as **DPI for finance** —
reusable, minimal building blocks — and as an **open network, not a platform** (§2).

**In Wayfinder:** this is the framing on the app's landing screen ("Why any of this?"), and it's why the
project's rule was *use their real code and their real specs; build a stand-in only when forced, and label
it.* That rule is itself a defense against becoming the thing the paper warns about.

### §2.2 — Going beyond digitization ✅

The paper's key distinction, and the concept this whole project pivots on:

- **Digitization** — a digital *copy* of a paper process.
- **Dematerialization** — the record *is* the asset, but it lives in one institution's database.
- **Tokenization** — the asset becomes a **self-contained, self-describing, programmable object** that can
  transact across systems, carrying its own rules.

**Where you can see it:** compare two things in our own backend. An **account** (`store.ts`) is a row in a
map — dematerialized; it means nothing outside our process. A **token** (`tokens.ts`, validated against
Finternet's real `token.schema.json`) carries its own `metadata` (rules/flags), `identities` (who relates to
it), `claims` (trust attached to it), and `state` (including a `stateCommitment` of its own history). Hand
that JSON object to any system that understands UNITS and it still means the same thing. **That difference is
the paper's whole argument, and it's the one thing I'd want to be able to explain unprompted.**

---

## §3 — The three U's

### §3.1 User-centric 🟡
The paper puts users at the center. **Demonstrated:** your identity is a `did:key` — literally your own
public key, issued by no one (`crypto.ts`, `docs/03`). Verification of signatures, credentials, and Merkle
proofs all happen **in your browser**, needing only public data.

**Honest failure:** our stand-in **holds your private key server-side** so the custodial `keys/sign` endpoint
can work. A real KMS never does this. That is a direct violation of user-centricity, and it is marked
`// STAND-IN:` in `store.ts` precisely so it can't quietly pass as the real design.

### §3.2 Unified 🟡
"Any to any, anyone, anywhere, anytime" — across asset types, sectors, geographies, time. **We have one asset
class (a non-fungible property deed) on one ledger.** The *shape* is general (the UNITS model handles
fungible, non-fungible, semi-fungible, soulbound), and we do use two token standards in practice —
`UNITS-NFT` for the deed and `UNITS-SBT` for the soulbound credential. But cross-asset, cross-geography,
cross-ledger movement is **not** demonstrated. 📖 for the rest.

### §3.3 Universal ✅ (for the part that matters here)
Open technology plus — and this is the sentence the whole compliance design comes from:

> "financial flows, especially of the regulated asset types, can have rules and regulations applied at the
> **flow level**." (§3, p.19)

**Demonstrated:** the mint compliance hook (below). Note for accuracy: the phrase *"regulation at the flow
level"* comes from **here** (end of §3), while *"safe by design"* is **§4.4**. Earlier drafts of our docs
attributed both to §4.4; they're two sentences from two sections that together make one idea.

---

## §4 — Asset types within the Finternet

> "Each of these varies based on their governance model, we've defined the 4 categories below" (§4, p.19)

- **A. User-Controlled** — users create and manage them entirely.
- **B. Attested** — user-controlled *plus* third-party attestations.
- **C. Registered** — officially registered with a public authority (land, vehicles).
- **D. Regulated** — money, publicly traded securities; strict oversight.

**In Wayfinder 🟡:** our `PROP-DEED` token class is a **Type C** asset (a property deed, registered with an
authority — our stand-in registry is the class `issuer` identity). Our **KYC credential** is a `CredentialToken`
(soulbound), which is the machinery a **Type B** attestation runs on. Types **A** and **D** are not built.

The paper's ambition here is combinatorial — "a type B asset such as [a] painting" interoperating with formal
systems to get a loan. We built one type and gated it; we did not demonstrate assets of different governance
models composing.

- **§4.1 ownership types** (sole / joint / multi-stakeholder / fractional): we model **sole** ownership only —
  a single `identities[type=owner]`. The schema would carry the others. 📖
- **§4.2 management beyond ownership**: the `identities` array supports `issuer`, `operator`, `custodian`,
  `manager`, `controller`. We populate `issuer` and `owner`. 🟡
- **§4.3 across jurisdictions** (customizable enforcement: *who* / *what* / *how much*): `token.schema.json`
  has `state.restrictions.jurisdiction` and `allowedUseCases`. We never exercise them. 📖

### §4.4 — "Safe by design" ✅ — the phase-5 payoff

The paper, verbatim (§4.4, p.21):

> "implementing the concept of **'safe by design'** embodies a foundational principle that prioritizes inherent
> safety and compliance within the financial ecosystem. This entails a **programmatic enforcement of rules
> where the system architecture itself prevents non-compliant actions from being executed**, effectively
> ensuring that only permissible activities take place."

The section's banner image reads **"Open Infrastructure, Regulatable Flows."**

**This is the single idea Wayfinder demonstrates most faithfully.** In `standin-service/src/tokens.ts`:

```
if (tokenClass.metadata.requiresKYC) {
  const hasValidCredential = credentialsForHolder(ownerDid).some((c) => verifyCredential(c).valid);
  if (!hasValidCredential) return { ok: false, code: 'COMPLIANCE_CHECK_FAILED', ... };
}
```

Mint **returns 403 and no token is created**. Not "a token is created and flagged" — the non-compliant asset
never comes into existence. And because the check calls `verifyCredential` (Phase 4) rather than reading a
cached boolean, **revoking the credential immediately makes minting fail again**. You can watch this in the
app: step 5 revoke → step 6 mint → red "Mint refused at creation."

The paper also names **"calibrated adoption"** here — asynchronous uptake at each participant's comfort level.
That's the §5.1 synchronization trap restated, and we don't demonstrate it. 📖

---

## §5.1 — Three traps to avoid

1. **Standardization** — "Instead of imposing a single international standard…" 🟡 **We built to Finternet's
   published specs and validated every request/response against them** rather than inventing our own shapes.
   Where the spec defined `ProofDetails` components but shipped no path, we *injected the binding to their
   schema* instead of designing a new format (`spec.ts` shim #4). **But honestly:** our credential endpoints
   (`/v1/credentials/*`) are our own design — the spec has no credential-issuance API. That's us adding a
   standard, and it's logged as such.
2. **Centralization** — "Rather than centralizing data and functionalities within a [single system]…"
   ⚠ **Our stand-in is one in-memory process.** It is centralized. This is inherent to a laptop demo, not a
   defense of the design, and it's why `ledger.ts` carries a `// STAND-IN:` header.
3. **Synchronization** — "Allow for asynchronous (at their own pace and point in time) [adoption]" 📖 Not
   demonstrated; there is only one participant.

Being able to name the trap you're falling into is the point. We fall into #2 squarely.

## §5.2 — Design principles & technical characteristics 🟡

The paper lists immutability, finality, observability, auditability among required characteristics.

- **Immutability** 🟡 — our ledger is append-only in practice (transactions are never mutated), and each
  token's history is a **hash chain**, so altering a past state breaks every later commitment. But nothing
  prevents the process from rewriting its own memory; immutability here is a property of the data structure,
  not of a consensus system.
- **Finality** 🟡 — we mark `status: completed` synchronously. There is no consensus, no settlement window,
  no legal finality. The spec's async pattern (`202 accepted` → poll → completed) is honored in *shape*
  (`/v1/token/mint` and `/v1/token/transact` really do return `202 accepted` with a `transactionId`), but the
  work completes instantly.
- **Observability / auditability** ✅ — `POST /v1/token/transactions` returns the full per-token history
  (`mint`, then `transfer`, each with `stateBefore` / `stateAfter` commitments), and `/v1/transaction/proof`
  returns a Merkle inclusion proof for any transaction.

## §5.3 — High-level technology architecture ✅ (mapped)

The eight boxes, and which phase touched each — the full table is in
[`00_architecture_map.md`](00_architecture_map.md):

| Box | Phase | Status |
|---|---|---|
| 1 Applications | 7 | ✅ ours — the Wayfinder wallet |
| 2 Users (+ ramps) | 3 | ✅ accounts/DIDs ⚠ (ramps 📖) |
| 3 Token managers | 5 | 🟡 token classes + policy, no separate manager service |
| 4 Unified ledger | 6 | ⚠ stand-in (`solana-ul-provider` doesn't build) |
| 5 **UILP** | 6 | 🟡 proof artifact built; no interledger messaging |
| 6 Trust & value-added providers | 4 | ✅ ⚠ stand-in issuer, real signatures |
| 7 Digital infrastructure (identity, signatures, registries) | 3–4 | ✅ ⚠ |
| 8 Laws, regulations, governance | 5 | ✅ the compliance hook is this band pushed into code |

## §5.4.1 — Tokens ✅, and trusted proof chains 🟡

**UNITS' five sections** — `metadata`, `data`, `claims`, `identities`, `state` — are real in our tokens and
validated against `specs-vendor/schemas/token/token.schema.json` (draft-07) on every mint. ✅

But the paper's **"Trusted Proof Chains"** is more than what we built. Verbatim (§5.4.1):

> "The chaining together of **tokens, their credentials and attestations, and metadata of every event** results
> in the creation of proof chains that can be made **portable** so that subsequent actors have all the
> information to decide **without having to capture and verify all over again**."

**What we built:** a proof chain over **transaction metadata** — per-token `stateCommitment` hash chain plus a
Merkle inclusion proof per transaction. **What we did not build:** the credential/attestation half. Our token's
`claims[]` is **empty** — the KYC credential *gated* the mint but was never **embedded into the token** as a
claim. So our token is not yet the portable, self-sufficient trust bundle the paper describes; a recipient
would still have to go ask the issuer. 🟡

**This is the most interesting gap in the project**, and the most obvious next step: attach the verified
credential to `token.claims` at mint time, and the token starts carrying its own trust with it.

## §5.4.2 — Token managers 🟡

The entity responsible for issuance, management, and synchronization, guarding against unauthorized creation
of tokens in someone else's name. **In Wayfinder:** the token **class** declares `identities` with roles
`admin`/`minter`/`compliance` and carries the compliance policy (`requiresKYC`). We enforce the policy but do
not run token managers as separate parties, and we don't enforce the minter ACL (any authenticated account may
mint if compliant).

## §5.4.3 — Verifiable and portable credentials ✅ ⚠

Fully demonstrated, with real cryptography: a stand-in trust provider with its own `did:key` issues a
**W3C-VC-shaped `CredentialToken`** (soulbound, `UNITS-SBT`), signed `Ed25519Signature2020`, validated against
the real `credential.schema.json`. Verification runs **four independent checks** — schema, issuer signature,
not revoked, not expired — and needs **only the issuer's public key**, recovered from the DID in the proof's
`verificationMethod`. No call back to the issuer.

The teaching payoff (`docs/04`): **a valid signature is necessary but not sufficient.** Revoke the credential
and `signatureValid` stays `true` while `notRevoked` flips `false`. Freshness is a separate axis of trust.

⚠ Stand-in: the endpoints are our design (the spec has no credential-issuance API), and we sign a
stable-key-order JSON canonicalization rather than the full W3C RDF Dataset Canonicalization suite. The
cryptography is genuine; the canonicalization is simplified. Both facts are in `credentials.ts`'s header.

## §5.4.4 — Ledger design considerations 🟡 ⚠

The paper's three layers:
1. **Ledger layer** (accounts, auth, immutability, UILP adherence) — 🟡 we have accounts, auth, and an
   append-only tamper-evident log. No UILP adherence.
2. **Descriptor layer** (assets/tokens + trust primitives: Actions, Holders, Consensus, Conditions) — 🟡 the
   UNITS token *is* the descriptor; **Consensus** (any/at-least/all/veto) and **Conditions** are 📖.
3. **Programmability layer** (composable workflows) — 📖 not built.

**State commitments** are real: `sha256(previousCommitment + txId + tokenId + owner + timestamp)`, chained, so
each token's history is tamper-evident. This is the paper's `StateReference` recipe.

## §5.4.5 — Contracts within the Finternet 📖

The **Pipe / Platform / Network (NxM)** models, and the reframing of "smart contract" as a spectrum of
programmable workflows rather than a rigid rulebook. **Not built.** The one place it touches our code is the
token-class `schema` field, which is where instance-level constraints would live.

## §5.4.6 — Unified Interledger Protocol (UILP) 🟡 ⚠

Verbatim (§5.4.6):

> "The **Unified Interledger Protocol (UILP)** is a set of open protocols that define the messaging
> specifications between different ecosystem participants: token managers, trust service providers,
> applications, and unified ledgers to ensure **interoperability and the finality** of transactions between
> them… UILP's core is built around the concept of **'proof chains'**, which ensure the integrity and
> verifiability of transactions across these ledgers."

*(Note: UILP = **Unified Interledger Protocol**. An earlier draft of `docs/06` expanded this wrongly; fixed.)*

**What we built:** the **artifact UILP carries.** Every transaction is a Merkle leaf; `/v1/transaction/proof`
returns `leafHash + proofPath + merkleRoot`, and the **browser re-folds leaf → root** (`foldMerkleProof`) to
verify inclusion using only SHA-256. Tick "tamper" and it breaks. That is genuinely the mechanism by which one
party accepts another's transaction **without trusting them**.

**What we did not build:** UILP is a *messaging protocol between two ledgers*. We have **one** ledger. There is
no pre-initialization/discovery, no initialization, no mirrored execution, no finalization handshake, and no
cross-ledger settlement. The browser stands in for "the other party verifying."

This was flagged from **Phase 0** as the highest stand-in risk (arch-map box 5), for a concrete reason recorded
then and still true: **UILP has no public wire-level specification.** Anything we invented here would be our
protocol wearing their name. We chose to build the proof and explain the protocol rather than fake it.

## §5.4.7 — Application use-cases 🟡

The wallet is the use-case: `app/` walks account → credential → token → transfer → proof as one guided demo
(`docs/07`).

## §5.5 — Tackling fraud 🟡

The paper (§5.5, p.42) groups financial crime into three practices:

> "practices like **impersonation**, **circumvention**, and **compromise**… Impersonation frauds exploit
> personal identities, circumvention tactics bypass established standards and protocols, and compromises
> breach the security of accounts and systems."

How the architecture answers each, and where we land:

- **Impersonation** → identifiability. 🟡 A DID *is* a public key; a signature proves the holder authorized
  exactly this data (step 2 in the app: edit the message, watch it break). But our custodial key storage means
  the *server* could impersonate you. Honest weakness.
- **Circumvention** → embedded rules. ✅ This is exactly the compliance hook: you cannot bypass the KYC gate,
  because the gate *is* the mint. The paper makes the same point — "smart contracts prevents circumvention of
  entry controls."
- **Compromise** → immutability + auditability. 🟡 The hash chain and Merkle proofs make undetected tampering
  with *history* hard; nothing here hardens the *system* itself.

Detection (an anomaly detector over the transaction stream) is the optional **Phase 9** and is **not built**. 📖

## §6 — A unique opportunity

The paper closes on empowerment. Wayfinder's closing card says the same thing in miniature: *assets that carry
their own rules and history, so value can move across ledgers with compliance built in and trust replaced by
proof.*

---

## What we did **not** build (the honest list)

So this document can't be mistaken for a claim of completeness:

1. **A second ledger and real UILP messaging** — the biggest gap (§5.4.6). No cross-ledger settlement.
2. **Credentials embedded in `token.claims`** — so our proof chain is transaction-only, not the portable
   token+credential+attestation bundle of §5.4.1.
3. **Contracts / programmability layer** (§5.4.5, §5.4.4 layer 3).
4. **Consensus and Conditions** primitives of the descriptor layer (§5.4.4).
5. **Asset types A and D**; joint / fractional ownership; jurisdiction restrictions (§4, §4.1, §4.3).
6. **Non-custodial keys** — the single sharpest violation of §3.1.
7. **Real finality, real immutability, decentralization** — one in-memory process (§5.1 trap #2, §5.2).
8. **Fraud/anomaly detection** (§5.5 → optional Phase 9).
9. **Token-manager ACL enforcement** — we check compliance, not who is allowed to mint (§5.4.2).

## Every stand-in, in one place

The full table with reasons lives in [`01_reference_code_status.md`](01_reference_code_status.md). Summary of
*why* each exists:

| Stand-in | Why it had to exist |
|---|---|
| `standin-service/` identity | The runnable reference (`finternet-api`) implements an **older, different shape** than the canonical specs. |
| `credentials.ts` | `specs-vendor/api` has **no credential-issuance endpoint** at all. |
| `tokens.ts` / `tokenclasses.ts` | `finternet-api` has **no canonical UNITS mint/get/search**. |
| `ledger.ts` | `solana-ul-provider` **does not build** — a patched git dependency's pinned commit is gone. |

And what is **real** inside them, in every case: the **cryptography** (Ed25519 keypairs, `did:key`,
signatures, SHA-256 hash chains, Merkle proofs — all independently verifiable, and verified *in the browser*)
and the **message shapes**, validated at runtime against Finternet's own OpenAPI and JSON Schema files. The
implementations are ours; the contracts never are.

Three in-memory spec repairs are documented in `standin-service/src/spec.ts` (strip type-less `nullable`;
merge three specs into one document; union `"accepted"` into `ResponseContext.status` because the spec's own
async envelopes are otherwise unsatisfiable) plus one binding injection (the `ProofDetails` path). Each is a
place where the published spec is internally inconsistent — worth knowing, and worth not silently patching.

## Definition of done (`PROJECT_PLAN.md` §1)

- **"I can explain every glossary term unprompted"** — [`00_glossary.md`](00_glossary.md) is complete and
  current; every term is tagged with its paper section and spec file.
- **"The full lifecycle works end-to-end in the app"** — account → credential → token → transfer → proof, as
  one guided demo ([`07_app_walkthrough.md`](07_app_walkthrough.md)). ✅
- **"Every stand-in is clearly logged and justified"** — [`01_reference_code_status.md`](01_reference_code_status.md),
  plus a `// STAND-IN:` header on every such file. ✅
- **"`09_how_this_maps_to_finternet.md` ties the project back to the paper section by section"** — this
  document. ✅

The one thing I'd want to be asked, to prove it landed: *why does minting fail after you revoke a credential,
even though the credential's signature is still perfectly valid?* Because the signature proves **who said it**,
never **whether it's still true** — and because the rule lives inside the mint, not beside it. That's
Finternet's two central ideas in one sentence.
