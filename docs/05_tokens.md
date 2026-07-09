# 05 — Assets: Tokens & Token Classes (Phase 5)

**What this phase built:** the *asset* layer — a **token** that represents something of value as a
self-describing object, minted from a **token class** whose **compliance policy is enforced at mint time**.
The headline demonstration: **minting a KYC-gated token fails when you hold no valid credential and succeeds
once you do** — the paper's "regulation at the flow level / safe by design" made literal. Teach-first, as
always: concepts in plain English tied to the paper (§5.4.1–5.4.2, §4.4) and the exact schema/spec fields,
then the code. Bold terms are in [`00_glossary.md`](00_glossary.md). This builds on Phase 4 — the compliance
check reuses `verifyCredential` directly.

**Run it yourself**
```bash
# terminal 1 — the spec-validated stand-in backend
cd standin-service && npm install && npm start        # http://127.0.0.1:8081

# terminal 2 — the Wayfinder UI (proxies /api -> 8081)
cd app && npm install && npm run dev                  # open http://127.0.0.1:5173

# tests
cd standin-service && npm test    # 12 tests (5 crypto + 3 credentials + 4 tokens)
```
In the browser: **Create account** → step **5** issue a KYC credential → step **6 · Mint a token** → **Mint
property deed** succeeds (green). Now go back to step 5, **Revoke** the credential, return to step 6 and mint
again → it's **refused** (red: "Mint refused at creation"). That refusal *is* the phase.

---

## Why tokens exist (the problem)

Today "your money" is a *row in your bank's private database*. It cannot move to another institution's ledger
without the two reconciling through intermediaries, because the asset has no existence independent of that one
database. The paper's fix (§5.4.1) is to make an asset a **self-describing object** carrying its own rules,
ownership, and history — so any ledger that understands the format can hold it. That object is a **token**.

## 1. Token — the UNITS 5-section model
**Paper:** §5.4.1. **Spec:** `specs-vendor/schemas/token/token.schema.json` (title *"Finternet Token
(UNITS)"*). A **token** is one JSON object with up to five sections; the split is deliberate:

| Section | What it holds | Why it's separate |
|---|---|---|
| `metadata` | immutable identity + behaviour: `tokenStandard`, `name`, `symbol`, `decimals`, `fungibility`, `flags` | what the thing *is* — never changes |
| `data` | type-specific facts (a deed's address, an NFT's image URL) | domain payload, varies by class |
| `claims` | signed statements about it — **verifiable credentials/attestations** | *trust attached to the asset* (Phase-4 objects!) |
| `identities` | who relates to it — `issuer`, `owner`, `custodian`, `operator`… | the parties, as a list of DIDs |
| `state` | runtime status — `active`/`frozen`/`burned`, `supply`, locks, `stateCommitment` | what *changes* over the token's life |

Required minimum (from the schema): `id`, `metadata`, `state`. **Our code:** `standin-service/src/tokens.ts`
builds exactly this shape and validates it against `token.schema.json` (ajv, draft-07) before storing — if we
ever drift from their shape, mint throws.

## 2. Token class vs token instance
**Paper:** §5.4.2. **Spec:** `token-interfaces.yaml` → `TokenClass`. A **token class** is the *template/type*
("Property Deed"); a **token** is one *instance* minted from it ("the deed to 123 Main St"). The class declares
the JSON schema every instance must satisfy, who may mint (`identities` with `minter` role), and its
**compliance policy**. Analogy: class is the *mint/die*, token is the *coin*; or in code, a class is a class
and a token is an object. **Our code:** `standin-service/src/tokenclasses.ts` seeds one class, `PROP-DEED`,
with `metadata.requiresKYC: true` — mirroring the spec's own `RWA-NFT` example (`token-interfaces.yaml`, which
carries `requiresKYC: true`).

## 3. Minting
**Spec:** `POST /v1/token/mint` → `MintTokenRequest {tokenClass, initialSupply, metadata?, data?}`, returns
**`202` with `context.status: "accepted"`** and a transaction id (mint is modelled as async). **Minting** is
creating a new instance of a class and assigning ownership. **Our code:** `handlers.tokenMint` — the caller
(identified by `context.authorization`) is the owner; on success it returns the accepted envelope with the
new `tokenId`, and the token is immediately fetchable via `POST /v1/token/get`.

## 4. The compliance hook — "regulation at the flow level" (the point of the phase)
**Paper:** two sentences, two sections — *"rules and regulations applied at the **flow level**"* (end of §3,
p.19) and *"**safe by design** … a programmatic enforcement of rules where the system architecture itself
prevents non-compliant actions from being executed"* (§4.4, p.21). In the old world, compliance is a check some app runs *before* it writes a
row; skip the check and a non-compliant asset still exists. The paper moves the rule *into the act of
creating the asset*: the token manager **refuses to mint** unless policy holds, so a non-compliant token never
comes into existence. **Our code (the heart of `tokens.ts`):**

```
if (tokenClass.metadata.requiresKYC) {
  const held = credentialsForHolder(ownerDid);
  const hasValidCredential = held.some((c) => verifyCredential(c).valid);
  if (!hasValidCredential) return { ok: false, code: 'COMPLIANCE_CHECK_FAILED', ... };
}
```

Notice it **reuses Phase 4 verbatim** — `verifyCredential` runs the same four checks (schema, issuer
signature, not-revoked, not-expired). So revoking your credential (Phase 4) instantly makes minting fail
(Phase 5): the two layers are wired together exactly as the paper intends. The refusal surfaces as HTTP
`403 COMPLIANCE_CHECK_FAILED`, and the UI shows it in red as "Mint refused at creation."

---

## The stand-in, stated plainly

The one runnable reference (`finternet-api`) implements only users→token_managers→accounts (older shape); it
has **no canonical UNITS token mint/get/search** (established in Phase 1). So the token **endpoints** and the
in-memory store are ours (`// STAND-IN:` in `tokens.ts`, `tokenclasses.ts`; logged in
[`01_reference_code_status.md`](01_reference_code_status.md)). What is **real**: the token **instance shape**,
validated against Finternet's own `token.schema.json`; the **envelope/endpoint shapes**, validated at the HTTP
edge against the real `token-interfaces.yaml`; and the compliance decision, which runs genuine Ed25519
credential verification. Two documented in-memory spec shims live in `spec.ts`: we already stripped type-less
`nullable`, and this phase adds one more — we union `"accepted"` into `ResponseContext.status.enum`, because
the spec's async envelopes override status to `"accepted"` via `allOf` while the base enum omits it (an
unsatisfiable intersection otherwise — a real quirk in their spec, and their own examples prove `"accepted"`
was intended).

## Verified end-to-end (Phase 5)

Over HTTP **and through the Vite proxy** (the browser's path):

- **Token class** `PROP-DEED` advertises `requiresKYC: true`.
- **Mint without a credential** → `403 COMPLIANCE_CHECK_FAILED` (refused at creation).
- **Issue a KYC credential**, then **mint** → `202 accepted` with a `tokenId`.
- **`token/get`** → a full UNITS token: `nonFungible`, owner = your DID, `state.status: active`, supply `1` —
  validated against the OpenAPI `Token` schema on the way out.
- **Revoke the credential**, mint again → back to `403`.

Tests: `standin-service/src/tokens.test.ts` (4) — blocked without credential; allowed with (token
schema-valid, owner bound); blocked again after revoke; unknown class → `CLASS_NOT_FOUND`. All 12 service
tests pass; app typecheck clean.

## What this sets up

Phase 6 (**Movement**) makes tokens *move*: `POST /v1/token/transact` (transfer/burn/freeze/lock) and the
**proof chain** — every state change hashes into a `stateCommitment` and a Merkle proof, so the full history
(account → credential → token → transfer) is independently auditable. The `state` section and
`stateCommitment` field we populated here are exactly what that phase builds on.
