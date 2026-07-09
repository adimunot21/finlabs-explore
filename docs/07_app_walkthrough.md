# 07 — The Wayfinder App: a two-minute walkthrough (Phase 7)

**What this phase did:** wired Phases 3–6 into **one coherent, demoable UI** — a guided, top-to-bottom
journey a person with zero background can follow and come away understanding what Finternet is trying to do.
No new backend; this is about narrative, progress, and framing on top of the working pieces.

**Run it**
```bash
cd standin-service && npm install && npm start   # http://127.0.0.1:8081
cd app && npm install && npm run dev             # open http://127.0.0.1:5173
```

**What's new in the UI (Phase 7)**
- A plain-English **hero + "Why any of this?"** intro that frames the problem before you touch anything.
- A sticky **progress rail** (Identity → Credential → Token → Transfer → Proof) that lights up as you go —
  and, crucially, the **Proof** light is driven by the browser's *live* verification, so toggling “tamper”
  actually un-lights it.
- A **session bar** (who you are) and a closing **“that's the whole lifecycle”** summary that ties each step
  back to the Finternet vision.

---

## The two-minute demo script

Give this to someone cold. Each step: what to click, what they'll see, and the one idea it proves.

**0. Frame it (10s).** Read the top: *today your money is a row in a bank's private database; Finternet makes
each asset a self-describing object so any ledger can hold it, compliance is built in, and anyone can verify
what happened.* That's the whole point — the rest makes it real.

**1. Identity (20s).** Pick a username → **Create account**. You get a **DID** (`did:key:z6Mk…`).
> **The idea:** your identity *is* a public key you control — no registrar issued it. (Step 2 “Sign a
> message,” then edit the text to watch the signature break, proves you hold the matching private key and that
> signatures are tamper-evident.)

**2. Credential (25s).** Step 5 → **Request KYC credential**. Four checks go green
(schema · issuer signature · not revoked · not expired). Then **Revoke** and watch verification turn red while
the signature stays valid.
> **The idea:** trust is a *signed claim about you* that anyone can verify with only the issuer's public key —
> and a valid signature isn't enough; freshness (revocation) is a separate axis.

**3. Token (25s).** Step 6 → **Mint property deed**. If you revoked in step 2, minting is **refused at
creation** (red). Re-issue the credential, mint again → a real UNITS token appears, owned by your DID.
> **The idea:** “regulation at the flow level” — the ledger won't *create* a non-compliant asset. Compliance
> is inside the act, not a check bolted on beside it.

**4. Transfer (20s).** Step 7 → enter a recipient (e.g. `bob`) → **Transfer token**. The owner changes and the
token's **state commitment** advances.
> **The idea:** movement is recorded on a unified ledger as a tamper-evident hash chain of state.

**5. Proof (20s).** Step 8 shows the transfer's **Merkle proof**. It reads ✓ — the browser re-folded
`leaf → root` and matched the ledger's published root. Tick **Tamper with the leaf hash** → ✗.
> **The idea:** anyone can verify a transfer happened with *only hashes*, trusting no one. That compact proof
> is what **UILP** carries between ledgers — the foundation for value crossing networks.

**Close (10s).** The green summary card recaps the five milestones as one sentence: *assets that carry their
own rules and history, so value moves across ledgers with compliance built in and trust replaced by proof.*

---

## What each screen actually exercises (for the technical viewer)

| Screen | Real thing happening | Where it's verified |
|---|---|---|
| Create account | Ed25519 keypair → `did:key` (multicodec + base58btc) | `standin-service/src/crypto.ts`; request/response against `accounts-interfaces.yaml` |
| Sign & verify | custodial sign of SHA-256(message); browser verifies with the public key | `app/src/lib/crypto.ts` `verifyHashHex` |
| Credential | real Ed25519 issuer signature; four-check verification; revocation | data validated vs `credential.schema.json`; `05`/`04` docs |
| Mint | UNITS token built + compliance hook (reuses `verifyCredential`) | instance validated vs `token.schema.json`; `token-interfaces.yaml` |
| Transfer | ownership change + SHA-256 state-commitment chain | `token-interfaces.yaml`; `ledger.ts` |
| Proof | Merkle inclusion proof, re-folded leaf→root in the browser | `app/src/lib/crypto.ts` `foldMerkleProof`; `ProofDetails` schema |

**Honesty note (unchanged from earlier phases):** the backend is a **stand-in** where Finternet Labs'
reference code doesn't run or doesn't cover the surface — every stand-in is logged in
[`01_reference_code_status.md`](01_reference_code_status.md) and marked `// STAND-IN:` in code. What's *real*
is the cryptography (keys, signatures, hash chains, Merkle proofs) and the message *shapes*, which are
validated against Finternet's own published schemas. The progress rail's “Proof” step being driven by the
browser's own check — not a server flag — is the small proof that we mean it.

## Definition-of-done status

Per `PROJECT_PLAN.md` §1: the full lifecycle (**account → credential → token → transfer → proof/audit**) now
works end-to-end in the app as one guided demo. The remaining piece is Phase 8 —
[`docs/09_how_this_maps_to_finternet.md`](09_how_this_maps_to_finternet.md) — the section-by-section tie-back
to the paper that closes out “I can explain the whole thing, not just the code.”
