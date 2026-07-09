# 03 — Identity & Keys (Phase 3)

**What this phase built:** a real, working account-and-signature flow — create a Finternet account, get a
DID + key pair, sign a message, and verify it — running against the canonical spec shapes with genuine
cryptography. Teach-first, as always: concepts here in plain English, tied to the paper (§5.4.3–5.4.4) and
the exact spec fields, then the code that makes each one real. Bold terms are in [`00_glossary.md`](00_glossary.md).

**Run it yourself**
```bash
# terminal 1 — the spec-validated identity backend
cd standin-service && npm install && npm start        # http://127.0.0.1:8081

# terminal 2 — the Wayfinder UI (proxies /api -> 8081)
cd app && npm install && npm run dev                  # open http://127.0.0.1:5173

# tests
cd standin-service && npm test    # 5 crypto tests
cd app && npm test                # 2 crypto tests
```
In the browser: pick an address → **Create account** → see your **DID** → type a message → **Sign** → edit
the "message to verify" and watch the signature go from ✓ to ✗.

---

## 1. Key pair / PKI — the foundation
**Paper:** §5.4.3 ("Public Key Infrastructure (PKI) is at the heart of digital signatures").
A **key pair** is a secret **private key** and a shareable **public key**, mathematically linked so that what
one does only the other can undo/check — and you can't derive the private key from the public one. Analogy:
the public key is a transparent padlock anyone can snap shut; the private key is the only thing that opens it.
**Spec:** `key-management-interfaces.yaml` — `keys/generate` returns a `publicKey`; `keyType` ∈
`[ethereum, solana, base]` (Solana = Ed25519, which we use).
**Our code:** `standin-service/src/crypto.ts` → `generateKeypair()` makes a real 32-byte Ed25519 pair.

## 2. DID — a public key you control
**Paper:** §5.4.3. A **DID** is a globally-unique identity string *you* control, with no issuer. The
`did:key` method is the simplest: the DID **is** the public key, multicodec-tagged (`0xed 0x01` for Ed25519)
and base58btc-encoded, e.g. `did:key:z6MkuMFEQmcLgoVq7q98wM3Stcofog95jgHmuam13CVpaCbu`. So the DID and the
key pair are one fact in two views — the DID is the public identity, the private key is control over it.
**Why:** the paper's *user-centric* goal — prove "this is me" across any ledger without a central identity DB.
**Spec:** `schemas/account` requires `did: "^did:"`; account keys carry `publicKeyMultibase` +
`keyType: Ed25519VerificationKey2020`.
**Our code:** `didKeyFromPublicKey()`; in the app the DID suffix and the public key are shown to be identical.

## 3. Digital signature — integrity + non-repudiation
**Paper:** §5.4.3 (Signing/Verification) and §5.4.4 (*"without explicit authorization proof, the ledger is
prohibited from executing any transaction"*). A **signature** proves the data wasn't altered (**integrity**)
and that a specific private-key holder authorized it and can't deny it (**non-repudiation**). Steps: hash the
message → sign the hash with the private key → anyone verifies with the public key. One changed byte → the
hash changes → verification fails.
**Spec:** the envelope's top-level `signature` (`JsonWebSignature2020`/JWS); `key-management`'s
`keys/sign` takes a pre-hashed `hash` and returns a `signature`.
**Our code:** the app SHA-256-hashes the message and calls `keys/sign` (the private key stays server-side);
verification runs **in the browser** with only the public key (`app/src/lib/crypto.ts` → `verifyHashHex`).
The tamper demo is this property made visible.

## 4. Finternet address + resolution — the human handle
**Paper:** §5.4.4 (addressing: human-readable, QR-codeable, discovery/routing "like email/website addresses").
A DID is unusable by humans; a **Finternet address** (`alice`) is the friendly handle that **resolves** to the
account and its DID.
**Spec:** `core.yaml` `FinternetAddress` (`^[a-z0-9_-]+$`); `accounts-interfaces.yaml`
`address/checkAvailability` and `address/resolve` → `{address, did}`.
**Our code:** `POST /v1/address/resolve` returns the DID for an address; the app checks availability before
creating.

## How they compose
An **account** = a **DID** (cryptographic identity) + an **address** (human handle) + one or more **keys**
(control); **signatures** authorize everything it does. That's the whole of Phase 3.

---

## The lifecycle we built (verified end-to-end)

| Step | Endpoint (spec) | What happens |
|---|---|---|
| Check handle | `POST /v1/address/checkAvailability` | is `alice` free? |
| Create | `POST /v1/account/create` → `201` | generate Ed25519 + `did:key`, store, return an access token |
| Resolve | `POST /v1/address/resolve` | address → DID |
| Profile | `POST /v1/account/get` (Bearer token) | DID, address, name, entityType |
| Keys | `POST /v1/account/keys/search` | the primary `Ed25519VerificationKey2020` (`publicKeyMultibase`) |
| Sign | `POST /v1/keys/sign` (key-management) | Ed25519-sign the SHA-256 hash → `signature` |
| Verify | in the browser | `verify(signature, hash, publicKey)` → ✓ ; tamper → ✗ |

Every request/response above is validated at runtime against the real OpenAPI files by
`express-openapi-validator` (see `standin-service/src/app.ts`). When our handler returned `200` where the spec
declared `201`, the validator rejected it — the contract polices us.

## What's real vs. stand-in (honest)
- **Real:** all cryptography — Ed25519 keypairs, `did:key` encoding, SHA-256, sign/verify — interoperable
  with any standard implementation. Proven by `crypto.test.ts` (both projects) and the tamper demo.
- **Stand-in** (`// STAND-IN:` markers; logged in [`01_reference_code_status.md`](01_reference_code_status.md)):
  the service *around* the crypto — in-memory storage, opaque access tokens, and **custodial private-key
  storage** (a real KMS never returns or holds your private key). Two in-memory validator shims live in
  `src/spec.ts` (strip type-less `nullable`; merge the two specs) — the vendored files stay pristine.

## Where this sits in the architecture (paper §5.3)
This is **box 2 (Users)** on top of **box 7 (digital infrastructure: identity, digital signatures)** — the
substrate the whole diagram rests on. Everything later authorizes against exactly these keys: credentials
(Phase 4) are signed by issuers and held by these DIDs; token ownership (Phase 5) is a DID; transfers
(Phase 6) are signed by the holder's key and carried in proof chains.

*Next: Phase 4 — Trust: registry & verifiable credentials. We issue a KYC credential to this account, verify
it, then revoke it and watch verification fail.*
