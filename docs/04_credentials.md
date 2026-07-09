# 04 — Trust & Credentials (Phase 4)

**What this phase built:** the *trust* layer — a **trust service provider** (an issuer) attests a claim
*about a holder*, signs it, and hands over a **verifiable credential** anyone can check with the issuer's
public key alone; the issuer can later **revoke** it, after which verification fails even though the
signature is still mathematically valid. Teach-first, as always: concepts in plain English tied to the paper
(§5.4.3) and the exact spec/schema fields, then the code that makes each one real. Bold terms are in
[`00_glossary.md`](00_glossary.md). This builds directly on the DID/keys from
[`03_identity_and_keys.md`](03_identity_and_keys.md).

**Run it yourself**
```bash
# terminal 1 — the spec-validated stand-in backend
cd standin-service && npm install && npm start        # http://127.0.0.1:8081

# terminal 2 — the Wayfinder UI (proxies /api -> 8081)
cd app && npm install && npm run dev                  # open http://127.0.0.1:5173

# tests
cd standin-service && npm test    # 8 tests (5 crypto + 3 credentials)
```
In the browser: **Create account** → scroll to **5 · Get a verifiable credential** → **Request KYC
credential** → see all four checks green → **Revoke (as the issuer)** → watch "Not revoked" flip to ✗ and the
verdict turn red — while "Issuer signature" stays green.

---

## Why this layer exists (the problem)

A DID proves *"I control this key."* It says **nothing** about who you are — that you passed KYC, are over
18, hold a licence, are a registered business. In the paper's model those facts come from **trust service
providers** who *attest* to them. The paper's insight (§5.4.3) is that this attestation should be a
**portable, verifiable credential**: a claim, signed by the issuer, that the holder carries around and
presents anywhere — and any verifier can check it **offline** with just the issuer's public key, with **no
call back to the issuer**. That's what makes identity work across a network-of-networks instead of being
locked inside one provider's database.

Three parties, standard **VC triangle**:
- **Issuer** — the trust provider that makes and signs the claim (here: a stand-in KYC provider with its own
  `did:key`).
- **Holder** — the subject the claim is about; it's bound to *their* DID (your Phase-3 account).
- **Verifier** — anyone checking it later, using only the issuer's public key.

## 1. Verifiable credential — a signed claim about you
**Paper:** §5.4.3. A **verifiable credential** is a set of claims about a subject, signed by an issuer, in a
tamper-evident envelope (W3C VC). The signature gives two guarantees at once: **integrity** (nobody edited it
after issuance) and **authenticity / non-repudiation** (it really came from that issuer, who can't later
deny it). Crucially it is **holder-held and verifier-checkable** — the verifier needs the issuer's *public*
key, not a live connection to the issuer.
**Spec:** the real JSON Schema `specs-vendor/schemas/credential/credential.schema.json` — a `CredentialToken`
(a soulbound token, `UNITS-SBT` + `W3C-VC-2.0`) whose `claims[0]` is a W3C Verifiable Credential.
**Our code:** `standin-service/src/credentials.ts` → `issueCredential()`; the result is validated against
that exact schema (ajv) before it's handed out, so our shape can't silently drift.

## 2. Attestation & the issuer signature
**Paper:** §5.4.3 (PKI at the heart of digital signatures — reused here for attestation).
**Attestation** is the issuer *vouching* for a claim by signing it. In the credential that's the `proof`
block: `type: Ed25519Signature2020`, a `verificationMethod` pointing at the issuer's key
(`did:key:…#key-1`), and a `proofValue` — a **real Ed25519 signature** over the credential.
**Our code:** the issuer is a real key pair (`generateKeypair()`); it signs `sha256(canonical(vc − proof))`
with its private key (`signHashHex`). Verification recovers the issuer's public key straight out of the
`verificationMethod` DID (`publicKeyFromMultibase`) and checks the signature — no issuer lookup needed, which
is the whole point of "portable."

> **Honest simplification (marked in code).** A production W3C *Data Integrity* proof canonicalizes the
> credential with a full RDF Dataset Canonicalization suite before signing. We sign a **stable-key-order JSON**
> form instead (`canonical()` in `credentials.ts`). The **cryptography is genuine** (real Ed25519, real
> integrity + non-repudiation); only the *canonicalization step* is simplified. Flagged with a `// STAND-IN:`
> header and logged in [`01_reference_code_status.md`](01_reference_code_status.md).

## 3. Binding to the holder's DID
The claim is *about someone* — `credentialSubject.id` is set to the **holder's DID** from Phase 3. That's the
link between the two phases: the same `did:key` that is "a public key you control" is now also "the thing a
KYC credential was issued to." A verifier who trusts the issuer, and sees the holder prove control of that
DID (a signature — Phase 3), can trust the claim applies to *this* person.

## 4. Verification — four independent checks
`verifyCredential()` returns a verdict plus four booleans, each answering a different question. A credential
is valid only if **all four** hold:

| Check | Question it answers | How |
|---|---|---|
| `schemaValid` | Is this even a well-formed credential? | ajv against the vendored `credential.schema.json` |
| `signatureValid` | Did the issuer really sign *exactly this*? | Ed25519 verify with the issuer's public key |
| `notRevoked` | Has the issuer since withdrawn it? | issuer's status (a real system: a status list) |
| `notExpired` | Is it still within `validUntil`? | compare `validUntil` to now |

Separating them is the teaching point: **why** a credential fails matters. A tampered credential fails
`signatureValid`; a revoked one fails `notRevoked` while `signatureValid` stays **true**. The UI shows all
four as chips so you can see exactly which guarantee broke.

## 5. Revocation — trust can be withdrawn
**Paper:** §5.4.3 (credentials are issued *and can be revoked* by trust providers). A signature is forever —
maths can't "un-sign" — so revocation lives **outside** the signature: the issuer publishes that a credential
is no longer valid (W3C `StatusList2021`). We model that with the issuer's authoritative store; `revokeCredential()`
flips the credential's `state.status` to `revoked`, and the next verify returns `notRevoked: false` with
reason *"credential has been revoked by the issuer."* This is the single most important idea in the phase:
**a valid signature is necessary but not sufficient** — freshness (revocation/expiry) is a separate axis.

---

## The stand-in, stated plainly

`specs-vendor/api` has **no credential-issuance endpoint** — credentials are modeled as tokens (there's a
schema, but no issue/verify/revoke API). So the **endpoints** `/v1/credentials/{issuer,issue,verify,revoke,list}`
are **our design** (marked `// STAND-IN:` in `credentials.ts`, logged in `01_reference_code_status.md`). What
is **real**: the issuer's Ed25519 keys and signatures, and the credential **data**, which is validated against
Finternet's own `credential.schema.json` on both issue and verify. What is **stand-in**: those endpoint
shapes, in-memory storage, and a revocation "status list" that is just a map. The envelope, the schema, and
the crypto are the parts you could hand to a real Finternet verifier; the plumbing around them is ours.

## Verified end-to-end (Phase 4)

Over HTTP **and through the Vite proxy** (the exact path the browser uses):

- **Issue** → a `CredentialToken` with an `Ed25519Signature2020` proof, `credentialSubject.id` = the holder's
  DID, schema-valid.
- **Verify** → `{ valid: true, checks: { schemaValid, signatureValid, notRevoked, notExpired } all true }`.
- **Revoke** → `{ status: "revoked" }`.
- **Verify again** → `{ valid: false, checks.notRevoked: false, reason: "credential has been revoked by the
  issuer" }` — with `signatureValid` still **true**.
- **Tamper** (unit test): editing the subject after issuance → `signatureValid: false`.

Tests: `standin-service/src/credentials.test.ts` (3) — issue+verify true; tamper → signature false; revoke →
notRevoked false. All 8 service tests pass; app typecheck clean.

## What this sets up

Phase 5 (**Tokens**) reuses this exact machinery: a credential *is* a token (`CredentialToken`, a soulbound
one). The token-manager / token-class model generalises "an issuer mints a signed, revocable thing bound to a
holder" from identity claims to *assets* — same envelope, same signatures, richer state and transferability.
