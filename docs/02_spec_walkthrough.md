# 02 — Spec Walkthrough (Phase 2)

**Purpose (from `PROJECT_PLAN.md` §7, Phase 2):** read every file in `specs-vendor/` and, *before any code*,
say in plain English what each one is for, the real-world concept it maps to, and one concrete example —
quoting the actual field names (per `CLAUDE.md`: read the file, don't guess). This is pure comprehension;
it's what Phase 3 onward builds against. Terms in **bold** are defined in [`00_glossary.md`](00_glossary.md).

**What's in `specs-vendor/` (pinned `7eb766d`):** 8 OpenAPI **interface** files under `api/`, and JSON-LD
**schema** definitions under `schemas/` for 6 domains (core, account, token, token-class, credential,
transaction). The API files say *what you can call*; the schema files say *what the things are*.

---

## 0. Conventions that apply to every file (read this first)

**The envelope pattern.** Every API request wraps its data in a fixed structure, so the protocol is
transport-agnostic (`api/README.md`):
```json
{ "context": { "id":"api.token.transact", "version":"1.0", "ts":"…", "msgId":"…",
               "developerToken":"dev_pk_…", "authorization":"Bearer user_jwt…" },
  "payload": { /* the actual request */ },
  "signature": { "type":"JsonWebSignature2020", "jws":"…" } }
```
Responses mirror it: `{ "context": { "status":"successful" }, "response": { … } }`. In the spec files these
show up as the `ApiRequest_*` / `ApiResponse_*` wrapper schemas around a domain payload. **Everything is
`POST`** (even reads like `/get` and `/search`) because the real content is in the envelope body, not the URL.

**Two-level auth.** `context.developerToken` / `developerSignature` (RFC 9421) identify the **app**
(see `clients-interfaces.yaml`); `context.authorization` (a user JWT) + a top-level `signature` (JWS)
identify the **end user** for critical operations.

**Async operations.** Token operations don't finish inline: **submit** → `202` with a `txId`, then **poll**
`/v1/transaction/status`, then **fetch** `/v1/transaction/get`. Status runs
`submitted → pending → executing → completed | failed | rolled_back`.

**The JSON-LD file trio (why each schema domain has 4+ files).** For a domain like `token/`:
- **`v1/attributes.yaml`** — the real schema: an OpenAPI 3.1 definition of every type/field, with `x-jsonld`
  annotations. *This is the file to read; the others are derived from it.*
- **`v1/context.jsonld`** — maps each short field name (`balance`) to a globally-unique URI, so the JSON is
  self-describing (**JSON-LD**).
- **`v1/vocab.jsonld`** — the RDF vocabulary: defines the classes/enums as formal terms.
- **`*.schema.json`** — a plain JSON-Schema validator (`ajv`-runnable).
- **`*.jsonld`** — a worked example instance.

Because these are mechanical companions of `attributes.yaml`, this walkthrough describes each domain once
(from its `attributes.yaml` + example), not one paragraph per boilerplate file.

**⚠ Big caveat — specs vs. the running reference API.** The `finternet-api` we got working in Phase 1 uses an
*older, different* surface (`POST /v1/users`, `/v1/token_managers`, plain JSON, no envelope, no DIDs) than
these specs (`/v1/account/create`, envelope pattern, DIDs, `value@domain` addresses). **The specs are the
canonical contract we design Wayfinder's UI against;** the reference API is an earlier, partial
implementation of a subset. Phase 3 reconciles the two (use the reference where it aligns, stand-in where it
doesn't). Divergences are logged at the bottom.

---

## Part 1 — API interface files (`specs-vendor/api/`)

### 1. `clients-interfaces.yaml` — "who is the app?" (developer identity + RBAC)
**Purpose:** register the *application/developer* that calls the platform, mint its API keys, and scope what
it may do. This is the platform-level half of auth.
**Endpoints:** `clients/{register,get,list,update,deactivate}`, `clients/keys/{create,list,revoke}`.
**Key types:** `ClientProfile` (`id`, `name` e.g. `"Acme Wallet"`, `scopes[]`, `allowedOperations`,
`status`); `Scope` — an RBAC string `"<resource>:<action>"` from a 13-resource × 3-action vocabulary
(`accounts:view`, `tokens:transact`, `tokenClasses:manage`, wildcards `tokens:*`, `*`); `KeyInfo` /
`CreateKeyResponse` for developer API keys.
**Concept:** the app's passport + permission set — the paper's "application builders" plugging into open,
universal infra, but with per-resource authorization so a wallet can't do more than it's scoped for.
**Example:** register `"Acme Wallet"` with `scopes: ["accounts:create","tokens:transact"]` → get a
`developerToken` used in every later `context`.
**Feeds:** Phase 7 (Wayfinder registers itself).

### 2. `accounts-interfaces.yaml` — user identity, addresses, and per-account keys
**Purpose:** create/manage a **user's Finternet account**, check/resolve **addresses**, and manage the
**keys** attached to an account. This is box 2 (Users) of the §5.3 diagram.
**Endpoints:** `account/{create,update,get,login,logout}`; `address/{checkAvailability,resolve}`;
`account/keys/{register,remove,get,search}`.
**Key types:** `RegistrationRequest`/`AccountProfile` (built on the account schema — `did`, `address`,
`name`, `email`, `entityType`); `ResolveRequest`/`ResolveResponse` (turn an address into an account);
`AccountKeyInfo` with `AccountKeyPurpose` + `AccountKeyStatus` (an account can hold several keys with
different roles).
**Concept:** **DID** + **Finternet address** + keys = a user you can look up by a human handle and verify
cryptographically, without a central identity DB. Address resolution is the paper's "discovery and routing…
like email/website addresses."
**Example:** `address/checkAvailability {"alice"}` → free? → `account/create` with a `did:key:…` → later
`address/resolve {"alice@finternet"}` returns Alice's account.
**Feeds:** **Phase 3** (identity/keys) — the primary spec for that phase.

### 3. `key-management-interfaces.yaml` — the cryptographic key lifecycle (custodial signer)
**Purpose:** generate keys, sign with them, and fetch public keys. Notably this is a **custodial** KMS — you
get back a `keyReference`, not the private key.
**Endpoints:** `keys/{generate,sign,public}`.
**Key types:** `GenerateKeyRequest.keyType` ∈ `[ethereum, solana, base]`; `SignMessageRequest`
(`keyReference` + a pre-hashed `hash`, hex); `SignatureResponse.signature` (hex); `KeyReference`
(`keyReference`, `publicKey`, `keyType`).
**Concept:** **PKI** as a service — the "digital signatures" layer of the §5.3 substrate. Keys are
chain-typed (ethereum/solana/base) because signatures must be valid on the target chain via the adapter.
**Example:** `keys/generate {"ethereum"}` → `keyReference`; `keys/sign {keyReference, hash:"0x…"}` →
`signature:"0x30450221…"`.
**Feeds:** **Phase 3** (signing) and Phase 6 (signing transfers).

### 4. `registry-interfaces.yaml` — discovery ("DNS for finance")
**Purpose:** a registry of **chains** and **wallet providers** so participants can find and route to each
other. (Note: token-*class* registration lives in `token-interfaces.yaml`, not here — see divergences.)
**Endpoints:** `registry/chains/{register,update,get,search}`, `registry/wallets/{…}`.
**Key types:** `Chain` (`networkId` = CAIP-2 e.g. `"eip155:1"`, `name` `"Ethereum Mainnet"`, `chainFamily` ∈
`[evm,solana,cosmos,substrate]`, `isTestnet`, `adapters[]` = `AdapterConfig`, ordered by priority);
`WalletProvider` (`name` `"MetaMask"`, `rdns` = EIP-6963 id `"io.metamask"`, `supportedChains` CAIP-2 list,
`status` incl. `BLOCKED` = "regulatory action").
**Concept:** the **registry** box — how ledgers/chains and wallets become discoverable; the plumbing behind
address resolution and interledger routing.
**Example:** register Ethereum Mainnet (`eip155:1`, `chainFamily:evm`) with an Alchemy adapter; register
MetaMask (`io.metamask`) supporting `["eip155:1","eip155:137"]`.
**Feeds:** Phase 6 (routing) and Phase 4 (trust providers live conceptually alongside this registry).

### 5. `delegations-interfaces.yaml` — acting on someone's behalf, under caps
**Purpose:** list and check **delegations** — grants letting one principal act for another within limits.
**Endpoints:** `delegations/{list,check}` (read/evaluate only here; creation is elsewhere).
**Key types:** `Delegation` (`delegatorId` → `delegateeId`, `tokenClasses[]` (empty = any), `constraints[]`,
`scopes[]`, `status`, `expiresAt`, `revokedAt`); `OperationConstraint` (per-operation quota: `operation`
e.g. `transfer`, `maxAmount`, `maxCount`, and running `usedAmount`/`usedCount`); `DelegationDecision`
(the `check` result).
**Concept:** the paper's **delegation** + "transactional controls (how much)" — e.g. "Bob may `transfer`
up to 1000 USDC on Alice's behalf until Friday," with usage tracked and revocable.
**Example:** `delegations/check {delegator:alice, delegatee:bob, operation:transfer, amount:500}` → allowed
if within `maxAmount - usedAmount`.
**Feeds:** Phase 5–6 (rule-based/authorized transactions).

### 6. `token-class-config-interfaces.yaml` — "safe by design," made real (compliance hooks)
**Purpose:** bind a **token class** to a **token program** and attach **pre/post hooks** and per-operation
overrides. This is the single most important file for the paper's *regulation-at-the-flow-level* idea.
**Endpoints:** `tokenclassconfig/{register,update,get,search}`.
**Key types:** `HookConfig` (`hookId` e.g. `"min-balance"`, `priority`, `enabled`, `operations[]` filter) —
**pre-hook failure aborts the operation; post-hook failure is only logged**; `TokenClassConfig`
(`tokenClass` `"USDC"`, `tokenClassId`, `programId` `"reference-ft"`, `preHooks[]`, `postHooks[]`,
`operationOverrides`, `config` with `stateCommitmentFields`/`stateCommitmentAlgorithm` ∈ `[sha256,blake3]`,
`status` ∈ `[active,inactive,suspended]` — ops only route when `active`).
**Concept:** **compliance hook** — the architecture *itself* prevents non-compliant actions. A "mint
requires a valid KYC credential" rule is literally a pre-hook on the `mint` operation. `stateCommitmentFields`
is also where the per-token state-commitment chain (feeding **proof chains**) is configured.
**Example:** config for `USDC` → `programId:"reference-ft"`, `preHooks:[{hookId:"kyc-check",operations:["mint","transfer"]}]`.
**Feeds:** **Phase 5** (the mint-fails-without-credential demo).

### 7. `token-interfaces.yaml` — the big one: token classes, token lifecycle, transactions, and proofs
**Purpose:** the whole asset + movement surface. Four clusters:
- **Token classes:** `registry/tokenclasses/{register,update,get,search}` — CRUD the **token-class**
  templates (schema = `schemas/token-class`).
- **Token lifecycle:** `token/{get,mint,search,transact,add}`. `MintTokenRequest` needs `tokenClass` +
  `initialSupply` (plus optional `metadata`/`data`/`identities`/`claims`). `TransactRequest.operation` ∈
  `[burn,freeze,unfreeze,lock,unlock,redeem,transfer,update,sign]` with `tokenId`, `amount`, `to`, `reason`;
  `add` attaches a credential (`AddCredentialRequest`).
- **Transactions:** `transaction/{status,get,search}`, `token/transactions` — the two-tier
  `TransactionLog`/`TokenTransaction` (schema = `schemas/transaction`), with `ExecutionStatus`.
- **Proofs (the payoff):** `GetProofRequest`, `GetProofLeafRequest`, `VerifyProofRequest`. Proofs are
  **Merkle** — `ProofDetails` has `leafHash` (SHA-256 of the tx leaf), `merkleRoot`, `proofPath[]` of
  `ProofPathNode` (sibling `hash` + `direction` ∈ `[left,right]`), `leafIndex`, `batchId` (txns grouped into
  one tree), and a `BlockchainAnchor`.
**Concept:** this is **tokenization → mint → transfer → proof chain** end-to-end. The Merkle proof + anchor
is the concrete, verifiable form of the paper's "non-repudiable proof chain / audit trail."
**Example:** register `USDC` class → `token/mint {tokenClass:"USDC", initialSupply:"1000000000"}` →
`token/transact {operation:"transfer", tokenId, amount:"100000000", to:"bob"}` → poll status → `GetProof`
returns a Merkle path you can `VerifyProof`.
**Feeds:** **Phase 5** (tokens/mint) and **Phase 6** (transfer/proofs) — the core of both.

### 8. `adapter-interface.yaml` — the bridge to external chains (on/off-ramp for proxy tokens)
**Purpose:** a *standard* interface every **chain adapter** implements so Finternet can read/write real
blockchains uniformly (the vendored copy is an "Alchemy Adapter (Reference Implementation)").
**Endpoints:** `chain/{info,capabilities,head}`, `accounts/{resolve,holdings}`, `balance/get`,
`assets/resolve`, `fees/estimate`, `transactions/{build,sign,submit,status,receipt}`, `info`, `health`.
**Key types:** `ChainInfo`, `TokenHolding`, `BuildTransactionRequest`/`Response`,
`SignTransactionRequest`/`Response`, `SubmitTransactionResponse`, `TransactionReceipt` + `EventLog`,
`FeeTier`. Its own `AdapterContext`/`AdapterResponseContext` envelope.
**Concept:** the **on-ramp/off-ramp** and the "**proxy token**" machinery from the token schema (a Finternet
token that shadows an asset living on Ethereum/Solana). Build → sign → submit is how a Finternet transfer of
a proxy token becomes a real on-chain transaction.
**Example:** `accounts/holdings {chain:eip155:1, address:0x…}` → list of `TokenHolding`; `transactions/build`
→ unsigned tx → sign (via KMS) → `transactions/submit` → `receipt`.
**Feeds:** later/optional — only if Wayfinder touches real chains. Not required for the core lifecycle.

---

## Part 2 — Schema definitions (`specs-vendor/schemas/`)

### A. `core/v1` — shared primitives
`core.yaml` defines just two things: **`FinternetAddress`** (a bare username string, pattern
`^[a-z0-9_-]+$`, e.g. `alice` — *"no domain suffix needed"*) and **`Entity`** (the base object every domain
type extends: `@context`, `@id`, `@type`, `name`, `description`, `created`, `modified`, `version`, `status`,
`labels[]`). **⚠** The `schemas/README.md` and other files also reference a core `Identifier` (`value@domain`)
type that is **not present** in this `core.yaml` — a real inconsistency (see divergences).
**Concept:** the reusable base + the addressing primitive. **Feeds:** everything.

### B. `account/v1` — a user/organization account
**`Account`** extends `Entity`. Required: `did` (`^did:`, e.g. `did:key:z6Mk…`), `address`, `name`, `email`,
`entityType` ∈ `[PERSONAL,BUSINESS]`. Optional: `mobile` (E.164), `status` ∈ `[ACTIVE,SUSPENDED]`,
`controllers[]` (DIDs for multi-sig/delegated control), `contactMethods[]` (`ContactMethod`:
`type` EMAIL/MOBILE, `verified`), `aliases[]`, `flags` (notification/PII), `preferences` (theme/lang/tz).
**Concept:** **DID** + address + recovery + delegated control — a self-sovereign-ish identity record.
**Example (`account.jsonld`):** Alice — `did:key:z6MkpTHR…`, `entityType:"PERSONAL"`, an EMAIL contact
method, an alias. **⚠** the example encodes `address` as an object `{identifierValue:"alice",
identifierDomain:"finternet"}`, but `attributes.yaml` types `address` as a plain string `alice@example.com`
— they disagree. **Feeds:** **Phase 3**.

### C. `token/v1` — a token *instance* (UNITS)
**`Token`** is deliberately lightweight (~10 fields): `tokenId`, `tokenClassId` (→ its template), a
denormalized `owner`, `identities[]` (instance roles: `owner`/`operator`/`custodian`), and `state`
(`TokenState`: `status` ∈ `[active,frozen,redeemed,burned,expired]`, `balance` as a string of smallest
units — `"1"` for NFT/credential), `relationships[]` (token-to-token, e.g. LEASE `dependsOn` PROPERTY),
optional `data`. Proxy-token fields (`chainId`, `contractId`, `walletAddress`, `syncStatus`) appear here too.
**Concept:** the actual **token** on the ledger; instance-specific state that references a shared class.
**Example (`token.jsonld`):** `alice-usdc-001` of class `usdc`, `owner:"alice"`, `state:{status:"active",
balance:"100500000"}` (= 100.5 USDC at 6 decimals). **Feeds:** **Phase 5–6**.

### D. `token-class/v1` — the token *template* (+ asset-type variants)
**`TokenClass`** (base, ~15 fields) holds static config all instances inherit: `tokenStandard[]`
(first = primary, e.g. `["UNITS-FT","ERC-20"]`), `name`, `symbol`, `decimals` (0–18), `fungibility` ∈
`[fungible,nonFungible,semiFungible]`, `flags` (`TokenFlags`: `transactable`/`transferable`/`divisible`/
`locked`/`revocable`/`burnable`), class `identities[]` (`issuer`/`creator`/`manager`), `supply`
(`total`/`max`/`circulating`), `stateModel` ∈ `[native,proxy]` + `stateProvider`, `valuationModel`
(`fixed`/`pegged`/`market`), `programId`, `chainDeployments[]`.
**Variants** (each `allOf` base + constraints): `fungible` (UNITS-FT, `fungibility:const fungible`,
divisible); `non-fungible` (UNITS-NFT, `decimals:const 0`, `divisible:const false`); `credential`
(UNITS-SBT, soulbound — see credential domain); plus asset-specific examples `loan-pool` and `nfh-voucher`.
**Concept:** **token class** + **behavioral flags** = the "kind of asset" and what it's allowed to do; the
paper's four asset types show up as different classes/flags.
**Example (`token-class.jsonld`):** USDC — `["UNITS-FT","ERC-20"]`, `decimals:6`, `issuer:did:web:circle.com`,
`stateModel:"proxy"` on Ethereum (`0xa0b8…eb48`), `valuationModel:{pegged→USD}`. **Feeds:** **Phase 5**.

### E. `credential/v1` — a KYC/identity credential *as a token*
**`CredentialToken`** extends `Token` and embeds **W3C Verifiable Credentials** in its `claims[]`. Metadata
adds `credentialType` (`identityVerification`/`kycVerification`/`documentVerification`/`biometricVerification`/
`addressVerification`/`ageVerification`), `verificationLevel` (eIDAS-style `basic`/`standard`/`enhanced`/
`premium`), and a `provider` (Signzy/Onfido/Jumio/Hyperverge, with `journeyId`). Credentials are **soulbound**
(`transferable:false`) and `revocable:true`.
**Concept:** **verifiable credential** + **attestation** — trust that travels with the holder; issued by a
trust provider, verified without calling their DB, revocable.
**Example (`credential.jsonld`):** a `kycVerification` (`enhanced`) issued by `did:web:finternet.io` to
`did:web:user.example`, with an `IdentityEvidence` (`documentVerification: {documentType:"pan"}`,
`biometricVerification: {livenessVerified:true}`). **Feeds:** **Phase 4**.

### F. `transaction/v1` — the record of movement (+ proofs + audit)
Two-tier: **`TransactionLog`** (system envelope: `txId`, `initiator`, `identities[]`, `tokenTransactions[]`,
`status` (`ExecutionStatus`), `timestamps` (submitted/started/completed/**finalized**), `proofId` +
`proofProfile` ∈ `[zk-snark,zk-stark,merkle,tee-attestation,signature-bundle,none]`, `ledgerAnchors[]`) and
**`TokenTransaction`** (per-token: `operation` (`OperationType` = mint/burn/transfer/freeze/…/addClaim/
revokeClaim), `fromAccount`/`toAccount`, `amount`, and **`stateBefore`/`stateAfter`** as `StateReference`
with a `stateCommitment` hash — the cryptographic before/after that proofs are built on; `participants[]`
with roles sender/receiver/operator/approver; a `signature`). **`AuditEvent`** (admin-only) records
metadata/claim/state changes with `ChangeDetails` and multi-party `Approval[]`.
**Concept:** **transaction** + **finality** + the raw material of the **proof chain** and the
**non-repudiable audit trail**. `stateCommitment` + Merkle batching (`token-interfaces` proofs) is the
concrete mechanism.
**Example (`transaction-log.jsonld` + `token-transaction.jsonld`):** Alice→Bob transfer of 100 USDC —
`status:"completed"`, `proofProfile:"zk-snark"`, anchored on Ethereum Sepolia; the token-tx shows
`stateBefore.stateCommitment:0xabc… (v42, owner alice)` → `stateAfter (v43, owner bob)`, signed by
`did:web:alice.example#key-1`. **Feeds:** **Phase 6**.

---

## Part 3 — Divergences & open questions (log honestly, don't silently reconcile)

1. **Core `Identifier` vs `FinternetAddress`.** `core.yaml` defines `FinternetAddress` (bare username) +
   `Entity`, but `account/v1/attributes.yaml` `$ref`s `core.yaml#/…/Identifier` (absent) and `README.md`
   documents an `Identifier` = `value@domain`. The address model is described three slightly different ways.
2. **`account.address`: string or object?** `attributes.yaml` says string (`alice@example.com`, required);
   `account.jsonld` says object (`{identifierValue,identifierDomain}`). Pick one when we code Phase 3 (I'll
   treat the *example instance's* `value@domain` object as the intended model and note the mismatch).
3. **"Registry" is overloaded.** `registry-interfaces.yaml` = chains + wallet providers; but **token-class**
   registration is under `token-interfaces.yaml` at `/v1/registry/tokenclasses/*`. Two different "registry"
   surfaces in two files.
4. **Specs vs. the Phase-1 reference API.** `finternet-api` (`/v1/users`, `/v1/token_managers`, plain JSON)
   is an *older, partial* implementation; these specs (envelope, DIDs, `/v1/account/create`) are the target.
   Phase 3 builds Wayfinder to the **specs**, backed by the reference where shapes align and a stand-in where
   they don't (`docs/01_reference_code_status.md`).
5. **Specs vs. paper naming.** The paper's "verifiable credential" is realized as a **soulbound credential
   token** (UNITS-SBT); the paper's loose "token" splits into **TokenClass** (template) + **Token** (instance).

## Which file feeds which phase (quick index)

| Phase | Primary specs |
|---|---|
| 3 — Identity/keys | `accounts-interfaces`, `key-management-interfaces`, `schemas/{core,account}` |
| 4 — Credentials | `registry-interfaces`, `schemas/credential`, token-class `credential` variant |
| 5 — Tokens | `token-interfaces` (classes+mint), `token-class-config-interfaces` (hooks), `schemas/{token,token-class}` |
| 6 — Movement/proofs | `token-interfaces` (transact+proofs), `delegations-interfaces`, `schemas/transaction` |
| 7 — App | `clients-interfaces` (register Wayfinder) |
| (opt) external chains | `adapter-interface` |

*Next: Phase 3 — build a real account-creation + key/signature flow against these shapes (and the Phase-1
reference API where it aligns).*
