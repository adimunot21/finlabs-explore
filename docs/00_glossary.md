# 00 — Glossary (living document)

**The single most important file in this repo.** Every Finternet term Wayfinder touches gets a
plain-English definition here — *what it is, why it exists, what problem it solves* — tagged with the
**paper section** it comes from and, where one exists, the **spec file** in `specs-vendor/` that makes it
concrete. Updated every phase. If a term shows up in code or conversation and isn't here, that's a bug.

**Sources**
- **Paper** = *Finternet: technology vision and architecture* (v1.1, 22 Apr 2024) — `docs/paper/`. Section
  numbers below (e.g. §5.4.6) refer to this paper. It is ground truth for **concepts**.
- **Spec** = the pinned copy of `finternet-io/specs` under `specs-vendor/` (commit `7eb766d`). It is ground
  truth for **shape and naming** (field names, enums, endpoints). Where the 2024 paper and the newer specs
  diverge, both are noted — I never silently reconcile them.

A one-line convention at the end of each entry: `— Paper §X · Spec: path` (or `Spec: —` when none).

---

## A. The big picture

**Finternet.** A proposed way to connect many separate financial systems into one network — the way the
Internet connected many separate computer networks — so that any user can hold, send, and manage *any* kind
of asset with *anyone, anywhere*, while keeping regulators able to enforce the rules. It is a *vision and a
set of open specifications*, not a single company's product or one blockchain. The problem it targets:
today's finance is fragmented, high-friction, high-cost, and prone to vendor lock-in, so value can't move
freely across institutions, borders, or asset types. — Paper §1, Abstract · Spec: —

**The three U's.** The design goals the whole framework is judged against:
- **User-centric** — individuals and organizations sit at the center; the tech and rules serve *their*
  needs, not an intermediary's. (§3.1)
- **Unified** — one coherent experience *across* asset types, sectors, geographies, and time ("any to any,
  anyone, anywhere, anytime"), without forcing everyone onto one standard. (§3.2)
- **Universal** — the underlying technology is open and accessible to everyone (users, businesses, app
  builders), like the open web, while regulated *flows* can still have rules applied. (§3.3)
— Paper §3 · Spec: —

**The three traps.** Three failure modes the paper explicitly warns against when building at population
scale — Wayfinder's design choices should avoid all three:
1. **Standardization** — forcing a single global standard on everyone. Instead, allow *multiple*
   coexisting standards that can evolve.
2. **Centralization** — routing all data/function through one system. Instead, use a decentralized
   network so control and risk are distributed.
3. **Synchronization** — requiring everyone to adopt at the same moment. Instead, allow *asynchronous*
   adoption so participants join when ready.
— Paper §5.1 · Spec: —

**DPI (Digital Public Infrastructure).** Reusable, shared, minimal "building blocks" (like a country's
digital ID, real-time payments, and data-sharing rails) that the public and private sector build services
on top of. Finternet is pitched as DPI *for finance*. Why it matters here: it's the mental model behind
"build small, general, reusable pieces and let others combine them." — Paper §2 · Spec: —

**Open network vs. platform.** A **platform** is a closed, centrally-controlled hub everyone must go
through (think a single marketplace). An **open network** lets any participant interact directly with any
other under shared, open rules (think email or the web). Finternet wants finance to be a "network of
networks," not a platform, so no single operator becomes a bottleneck or gatekeeper. — Paper §2, §2.2 · Spec: —

---

## B. From digitization to tokenization (the core "aha")

These three build on each other; the paper is careful to distinguish them (§2.2), and getting the
difference is the point of the project.

**Digitization.** Turning physical information/processes into digital form *for internal use* — e.g.
scanning paper records into PDFs. The asset itself still fundamentally lives on paper; you've just made a
digital copy. — Paper §2.2 · Spec: —

**Dematerialization.** Going one step further: eliminating the physical form entirely, so the asset exists
*only* as an electronic record with legal standing (e.g. shares held electronically instead of as paper
certificates). The record *is* the asset now, but it's still just a record in some institution's database. — Paper §2.2 · Spec: —

**Tokenization.** The big leap: representing an asset *and the rights and rules attached to it* as a
**self-contained, self-describing, programmable digital object** (a token) that can transact directly,
across systems, without relying on the institution that issued it. This is what makes assets "move like
information on the internet." The problem it solves: dematerialized records are still trapped inside
individual institutions; tokens carry their own logic and proofs so they're portable and interoperable. — Paper §2.2, §5.4.1 · Spec: `schemas/token/**`

**De-tokenization.** The reverse — converting a token back into its conventional off-network form. — Paper §5.4.1 · Spec: —

**On-ramp / off-ramp.** The bridge between the existing financial world and the Finternet. **On-ramp** =
tokenizing an existing asset to bring it in; **off-ramp** = de-tokenizing to take value back out. Usually
run by a service provider. — Paper §5.4.1 · Spec: —

---

## C. Assets and how they're regulated

**The four asset types.** Finternet classifies every asset by *governance model*, because that determines
how much user autonomy vs. oversight applies:
- **A — User-Controlled** — users create/manage them entirely (NFTs, personal digital assets).
- **B — Attested** — user-controlled *plus* third-party attestations (e.g. a painting attested by a
  gallery, or an insured asset).
- **C — Registered** — officially registered with an authority (land, vehicles) to confirm ownership.
- **D — Regulated** — under strict oversight (money, publicly-traded securities).
The vision: unify all four under user control while still enforcing rules where types C and D demand them
(e.g. a user-created type-B painting that can still interoperate with formal systems to get a loan). — Paper §4, §4.1–§4.3 · Spec: token-class variants under `schemas/token-class/v1/**`

**Ownership types.** Ownership isn't just "one person owns it": **sole**, **joint** (rights split among
parties), **multi-stakeholder** (shared rights, collective decisions), and **fractional** (asset broken
into small tradable portions). Tokenization lets each distinct *right* over an asset be its own token. — Paper §4.1 · Spec: —

**Safe by design (regulation at the flow level).** The paper's flagship regulatory idea: instead of
policing behavior after the fact, the *architecture itself* prevents non-compliant actions from executing —
compliance is a programmatic gate on the flow. Rules attach to the asset/flow, not to a central chokepoint.
This is the concept Phase 5 makes real (a token mint that *cannot* succeed without a valid credential).
Verbatim (§4.4): *"a programmatic enforcement of rules where the system architecture itself prevents
non-compliant actions from being executed."* **⚠ Two sections, one idea:** the phrase *"rules and regulations
applied at the **flow level**"* is from the **end of §3** (p.19); *"safe by design"* is **§4.4** (p.21). Don't
cite both to §4.4. — Paper §3 (flow-level) + §4.4 (safe by design) · Spec: `api/token-class-config-interfaces.yaml` (hooks/overrides)

**Customizable regulatory enforcement (who / what / how much).** How authorities tailor rules per asset
type and jurisdiction: **Access restrictions (who)** via whitelists/blacklists; **sector/asset-specific
requirements (what)**; and **transactional controls (how much)** — limits on size/frequency. — Paper §4.3 · Spec: `api/delegations-interfaces.yaml` (policies)

---

## D. Identity & keys (Phase 3 territory)

**Account.** A user's or organization's entry point to a ledger. In the spec it's an `Account` that
extends a base `Entity`, carries a `did`, a `primaryAddress`, an `entityType` (`PERSONAL`/`BUSINESS`), a
`status` (`ACTIVE`/`SUSPENDED`), contact methods, and `controllers` (for delegated/multi-sig control). A
user can create an account on *any* ledger of their choice and define their own auth and addressing. — Paper §5.4.4 · Spec: `api/accounts-interfaces.yaml`, `schemas/account/v1/**`

**DID (Decentralized Identifier).** A globally-unique ID that a user controls directly, without a central
issuer — it resolves to their public keys/metadata. In the spec, accounts carry a `did` like `did:key:...`
or `did:web:...`. Why it exists: it lets you prove "this is me / my thing" across systems without everyone
having to trust one identity database. — Paper §5.4.3 · Spec: `schemas/account` (`did`), namespace `didCore` = W3C DID

**Key pair / PKI (private key + public key).** Public-Key Infrastructure uses two mathematically-linked
keys: a **private key** kept secret by the owner, and a **public key** shared openly. Anything signed by
the private key can be verified by the public key (and vice-versa for encryption). This is the cryptographic
bedrock under DIDs, signatures, and credentials. — Paper §5.4.3 · Spec: `api/key-management-interfaces.yaml`

**Digital signature.** Proof that a specific holder authorized specific data and that the data wasn't
altered: you hash the data and encrypt the hash with your private key; anyone can verify with your public
key. Gives **non-repudiation** (you can't later deny you signed) and **integrity** (tamper shows up). In
the API, critical operations carry a top-level `signature` (a `JsonWebSignature2020` / JWS). — Paper §5.4.3 · Spec: `api/README.md` (envelope `signature.jws`)

**Finternet address / addressing.** A human-friendly, shareable handle for an account — designed to be
readable, QR-codeable, aliasable, and *abstracted from any specific token manager*. The spec models it as a
core `Identifier` with the pattern `value@domain` (`identifierValue` + `identifierDomain`, e.g.
`alice@finternet`). Problem solved: you shouldn't need to know someone's ledger or provider to pay them,
just like email hides the mail server. — Paper §5.4.4 · Spec: `schemas/core/v1/**` (`Identifier`)

**Authentication vs. authorization (and their chains).** **Authentication** = proving *who you are*;
**authorization** = proving you're *allowed to do this action*. For joint/multi-party cases the system
builds **authentication chains** (e.g. two-factor) and **authorization chains** (multiple approvers). The
rule the ledger enforces: no transaction executes without an explicit authorization proof, and *"what you
see in the proof is what gets executed."* — Paper §5.4.4 · Spec: `api/README.md` (two-level security: `developerToken` + user `authorization`)

---

## E. Trust: credentials & attestations (Phase 4 — done, see [`04_credentials.md`](04_credentials.md))

**Verifiable Credential (VC).** A tamper-evident, cryptographically-signed digital claim about someone or
something (e.g. "this account passed KYC"), following the W3C VC standard. It has an **issuer**, a
**holder/subject**, the claim data, and the issuer's **proof** (signature). It's shareable (even by QR) and
independently verifiable *without calling back to the issuer's database*. Problem solved: trust that travels
with the user instead of living in one institution. In the spec, a credential is itself a token
(`CredentialToken` extends `Token` + W3C VC). — Paper §5.4.3 · Spec: `schemas/credential/v1/**`, `api/registry-interfaces.yaml`

**Attestation.** A statement by a *third party* vouching for a claim — the extra layer of trust on top of a
credential (e.g. an employer confirming employment history, an auditor confirming a token's reserves).
Attestations can be **transient** (e.g. a one-off balance proof for a transfer) or **permanent**. — Paper §5.4.3, §5.4.4 · Spec: `schemas/credential/**`, token `claims` section

**Issuer / holder / verifier.** The three roles in the credential lifecycle: the **issuer** creates and
signs the credential; the **holder** stores it and chooses when/with whom to share it (they're in control);
the **verifier** checks the signature and accepts it into their workflow. — Paper §5.4.3 · Spec: `schemas/credential` (`identities`: `issuer`/`subject`)

**Trust and value-added service providers.** The ecosystem of parties that add trust around assets, shown
as their own column in the §5.3 diagram: **attestors**, **verifiers**, **lockers** (secure credential
storage, à la DigiLocker), **guarantors**, custodians, etc. — Paper §5.3, §3.2 · Spec: `api/registry-interfaces.yaml`

**Revocation.** Cancelling a previously-issued credential so verification of it now fails (e.g. a KYC
credential withdrawn). Credentials can be dynamic (updatable/revocable) or static. Phase 4 demonstrates
issue → verify → revoke → verification fails. — Paper §5.4.3 · Spec: `schemas/credential` (status list), token-class `revocable` flag

---

## F. Assets as tokens — the UNITS model (Phase 5 — done, see [`05_tokens.md`](05_tokens.md))

**Token.** A programmable digital representation of a claim on an asset, with a unique identifier for
traceability. In the spec, a `Token` is a *lightweight instance* (~10 fields): `tokenId`, a `tokenClassId`
pointing at its class, a denormalized `owner`, `identities` (owner/operator/custodian), and `state`
(status, balance, locks). — Paper §5.4.1 · Spec: `schemas/token/v1/**`, `api/token-interfaces.yaml`

**UNITS (Universal Token Specification) — the five sections.** The paper says a token bundles metadata,
data, claims, identities, and state; the spec implements exactly that as UNITS' five-section structure:
- **Metadata** — immutable identity (name, symbol, standard, behavioral flags).
- **Data** — mutable business data (reserves, jurisdiction, audit info).
- **Claims** — verifiable credentials/attestations attached to the token.
- **Identities** — who relates to it (issuer, creator, owner, operator, custodian).
- **State** — current lifecycle state (supply, status, locks, balance).
Why it matters: this is what makes a token *self-contained and self-describing* — it carries its own rules,
proofs, and roles so downstream actors don't have to re-verify from scratch. — Paper §5.4.1 · Spec: `schemas/README.md` ("UNITS"), `schemas/token/**`

**Token class.** The *template/definition* a token is an instance of (the spec's cleaner formalization of
"kinds of tokens"). A `TokenClass` (~15 fields) holds the static config all its instances inherit:
`tokenStandard`, `symbol`, `decimals`, `fungibility`, `flags`, class-level `identities`
(issuer/creator/manager), and `supply`. **⚠ Note:** the 2024 paper talks loosely about "tokens"; the specs
split **TokenClass (template) vs Token (instance)** — a distinction Wayfinder should honor. — Paper §5.4 · Spec: `schemas/token-class/v1/base/**`, `api/token-class-config-interfaces.yaml`

**Token manager.** The entity responsible for **issuance, management, and synchronization** of tokens —
e.g. a central/commercial bank, asset manager, or registrar. They may run their own private or shared
ledger that synchronizes with the unified ledger, and they guard against unauthorized creation of tokens in
someone else's name (**producibility**). In the spec this surfaces as the class-level `manager`/`issuer`
identities and the `programId` (token program) that executes operations. — Paper §5.4.2, §5.3 · Spec: token-class `identities` + `programId`; `api/registry-interfaces.yaml`

**Holder.** The entity that currently possesses/controls a token; every token has one, and it anchors the
authentication/authorization chains — transactions execute only with the holder's explicit proof. — Paper §5.4.1 · Spec: token `owner` / `identities`

**Behavioral flags.** Class-level booleans that say what operations a token permits: `transactable`,
`transferable` (false = **soulbound**, can't be moved — e.g. a KYC credential), `divisible`, `locked`,
`revocable`, `burnable`. This is "safe by design" at the object level. — Paper §5.4 (characteristics) · Spec: `schemas/token-class/v1/base` (`TokenFlags`)

**Fungibility: fungible / non-fungible / semi-fungible (and soulbound).** **Fungible** (`UNITS-FT`) =
interchangeable units (currencies, securities); **non-fungible** (`UNITS-NFT`) = unique items (a property
deed); **semi-fungible** = hybrid; **soulbound** (`UNITS-SBT`/credential) = non-transferable, bound to one
holder (identity credentials). — Paper §4, §5.4.1 · Spec: `schemas/token-class/**`, `fungibility` enum

**Compliance hook / token program / transactional triggers.** The mechanism that makes "safe by design"
real: operations on a token can trigger checks at different stages — **pre-insert** (e.g. KYC check before
allowing the action), **real-time** (fraud checks), and **post-transaction**. The token-class config maps a
class to the **token program** (via `programId`) plus hooks/overrides that enforce these. Phase 5 uses this
so a mint *fails without a credential and succeeds with one.* — Paper §5.4.1 · Spec: `api/token-class-config-interfaces.yaml`

**Token operations: mint / burn / transfer / freeze / lock / redeem / addClaim / revokeClaim.** The
lifecycle actions recorded per token. In the spec these are the `OperationType` enum on a `TokenTransaction`.
`mint` creates supply, `burn` destroys it, `transfer` moves ownership, `freeze`/`lock` restrict it,
`addClaim`/`revokeClaim` attach or cancel credentials. — Paper §5.4.1 · Spec: `schemas/transaction/v1/**` (`OperationType`)

---

## G. The ledger (Phase 6 — done, see [`06_movement.md`](06_movement.md))

**Unified ledger.** A programmable ledger that unifies accounts, tokens, smart contracts, and
interoperability in one place — designed to be universal and open (vs. today's *private* ledgers inside one
institution or *shared* ledgers among a few). Its stack (from the §5.4.4 diagram): Immutable ledger →
Accounts → Tokens → Smart contracts → Programmability, with **UILP** connecting one unified ledger to
another. — Paper §5.4.4 · Spec: `reference/finternet-api` (Rust reference implementation)

**The three ledger layers.** The paper's internal structure of the core ledger tech:
1. **Ledger Layer** — generic core: user/account management, authentication, UILP adherence, immutability,
   security.
2. **Descriptor Layer** — represents assets/tokens and their data, metadata, and credentials; sets trust
   levels via four primitives → **Actions** (read/create/update/transfer), **Holders** (who controls),
   **Consensus** (voting rules: any/at-least/all/veto), **Conditions** (criteria that must hold for a
   transaction to finalize).
3. **Programmability Layer** — composability, programmable workflows, and automation for app builders.
— Paper §5.4.4 · Spec: `reference/finternet-api`, `reference/finternet-sandbox`

**Immutability & finality.** **Immutability** = once recorded, a transaction can't be altered or deleted
(tamper-proof record-keeping). **Finality** = the moment a transfer *legally* makes the asset the receiving
party's property — the point of no return. Both are listed among the paper's required technical
characteristics. — Paper §5.4 (technical characteristics) · Spec: `schemas/transaction/**` (execution status → `completed`)

**Private vs. shared vs. unified ledger.** **Private** = inside one institution; **shared** = across a
consortium; **unified** = open, universal, user-centric, interoperable across asset types — the target
Finternet needs and today's systems don't yet provide. — Paper §5.4.4 · Spec: —

**Smart contracts / contracts, and the Pipe/Platform/Network models.** Finternet reframes "smart contract"
as a *spectrum of programmable workflows* (not a rigid rulebook that must codify every law). It contrasts
three contracting models: **Pipe** (linear, rigid pipeline), **Platform** (centralized marketplace
mediator), and **Network (NxM)** — any participant transacts directly with any other in a regulated,
trustworthy framework (the goal, mirroring the internet). — Paper §5.4.5 · Spec: `schemas/token-class/v1/**` (programs), `api/token-class-config-interfaces.yaml`

---

## H. Movement, proofs, and interledger settlement

**Transaction.** A recorded token operation. The spec uses a **two-tier** model: a `TransactionLog`
(system-wide envelope, with `txId`, `initiator`, `status`, and one or more `tokenTransactions`) and, under
it, per-token `TokenTransaction` records each carrying `stateBefore`/`stateAfter` commitments. There's also
an admin-only `AuditEvent` for compliance changes. — Paper §5.4.4 · Spec: `schemas/transaction/v1/**`

**Proof chain (trusted proof chain).** The heart of Finternet's trust model and of UILP: as a token moves,
its **tokens + credentials + attestations + the metadata of every event get chained together** into a
non-repudiable, *portable* bundle of proofs. Any subsequent actor can verify the whole history *without
re-collecting and re-verifying everything*, and without trusting an intermediary. It's how trust and
compliance travel with the asset (the paper links it to the Travel Rule / IVMS101 for cross-border AML).
**In Wayfinder:** the credential that authorized a mint is embedded **verbatim** in `token.claims[0]`, its
digest is folded into every `stateCommitment`, and the browser verifies the issuer's signature on it with no
call to the issuer. Offline verification proves *the issuer attested this, unaltered* — **not** that it's
still unrevoked. See [`05_tokens.md`](05_tokens.md) §5.
**⚠ Note:** the paper describes proof chains conceptually; there is *no public wire-level UILP spec*, so any
proof-chain wire format Wayfinder builds is our own reasonable interpretation, clearly labeled. — Paper §5.4.1, §5.4.6 · Spec: `schemas/transaction/**` (`ProofProfile`: zk-snark/merkle/tee/signature-bundle)

**UILP (Unified Interledger Protocol).** A set of *open protocols* defining how ecosystem participants
(token managers, trust providers, apps, and unified ledgers) message each other to move value **between
different ledgers** with interoperability and finality. Built around proof chains. A UILP transaction runs:
pre-initialization (discovery/verification APIs) → initialization → execution (both ledgers update, mirrored)
→ finalization, where the *receiving* party verifies integrity itself. This is the "TCP/IP of finance" idea.
**⚠ Note:** UILP has no public wire-level spec — this is Phase 6's biggest stand-in risk. — Paper §5.4.6 · Spec: — (no standalone UILP file; `api/registry-interfaces.yaml` covers discovery)

**Non-repudiable credentialed audit trail.** Every transaction/event between verified actors automatically
produces an incontrovertible, tamper-proof trail — the basis for accountability, transparency, and even
automated dispute resolution. This is what Phase 6/7 surface to the user as "view the full audit trail with
proofs." — Paper §4.4 · Spec: `schemas/transaction/audit-event.*`, `transaction-log.*`

**Delegation.** Letting one account authorize another to act on its behalf under defined limits (a rule-based
permission, e.g. pre-set caps on amount/volume, or an approval chain). Part of building "personalized
integrated financial workflows." — Paper §3.1 (Table 1, #4), §4.3 · Spec: `api/delegations-interfaces.yaml`

**Registry.** The discovery mechanism that makes ledgers, chains, and wallet providers findable so
participants can route to each other (the paper's "discovery and routing," akin to DNS for finance). — Paper §5.4.4 (addressing: discovery/routing) · Spec: `api/registry-interfaces.yaml`

---

## I. Fraud (§5.5 — relevant to optional Phase 9)

**Categories of fraud.** The paper groups financial crime into **impersonation** (exploiting identities),
**circumvention** (bypassing standards/protocols), and **compromise** (breaching account/system security),
and argues Finternet's identifiability, embedded rules, and immutability make each harder. — Paper §5.5 · Spec: —

**Observability & auditability.** The system properties that let regulators/participants monitor flows in
real time, get alerts on unusual activity, and examine any action after the fact — the foundation of
fraud detection (and of optional Phase 9's anomaly detector). — Paper §5.4 (characteristics), §5.5 · Spec: `schemas/transaction/audit-event.*`

---

## J. Spec & tooling terms (so the specs read cleanly)

**Envelope pattern.** Every Finternet API call wraps its data in a consistent structure: a `context` (id,
version, timestamp, `developerToken`, user `authorization`), a `payload`, and an optional `signature`.
Responses mirror it with a `context.status` + `response`. Keeps the protocol transport-agnostic. — Spec: `api/README.md`

**Two-level security (developer token + user authorization).** Platform-level auth identifies the
*developer/app* (`context.developerToken` / `developerSignature`, RFC 9421); user-level auth identifies the
*end user* (`context.authorization` JWT, plus a top-level JWS for critical ops). — Spec: `api/README.md`

**Async transaction pattern.** Token operations don't complete inline: **submit** (`POST /v1/token/transact`
→ `202 Accepted` with a `txId`) → **poll** (`/v1/transaction/status`) → **fetch** (`/v1/transaction/get`).
Status progresses `submitted → pending → executing → completed/failed/rolled_back`. — Spec: `api/README.md`, `schemas/transaction` (`ExecutionStatus`)

**JSON-LD, `@context`, `x-jsonld`.** The schemas are **JSON-LD**: ordinary-looking JSON whose `@context`
maps each field to a globally-unique meaning (via vocabularies like schema.org, W3C DID, W3C VC). The
`x-jsonld` annotations in the `attributes.yaml` files carry those mappings. Why it matters: it makes data
*self-describing* and interoperable across systems — the data-layer expression of the "self-describing"
principle. — Spec: `schemas/README.md`, all `schemas/**/context.jsonld`

---

### Divergences noted so far (paper 2024 vs. specs 2026)
- **Token vs. TokenClass:** paper says "token"; specs formally split **instance vs. template**. Follow the specs.
- **Credentials as tokens:** specs implement VCs as **`CredentialToken`** (Token + W3C VC, soulbound); the
  paper treats credentials/attestations as their own thing. Same concept, tighter shape.
- **Credential `issuer` shape (spec vs. spec):** `credential.schema.json` allows `oneOf[string(uri),
  object{id,name}]`, but `token.schema.json`'s `Claim.issuer` accepts **only a string**. Issue credentials
  with the **string** form and the same signed object is valid as both a credential and a token claim —
  **one signature, valid in both places**. Use the object form and embedding requires flattening, which
  changes the canonical form the issuer signed and **breaks the signature**.
- **UILP / proof-chain wire format:** described in the paper, **not** specified as a wire protocol in the
  specs → the known stand-in risk for Phase 6.

*Phase 1 done — `reference/finternet-api` builds and runs (Users/Token-managers/Accounts); the Solana
Unified Ledger provider does not build. Details in [`01_reference_code_status.md`](01_reference_code_status.md).
Phase 2 done — every spec file walked through in [`02_spec_walkthrough.md`](02_spec_walkthrough.md), with the
real field names behind each term and the spec-vs-reference-vs-paper divergences logged.
Phase 3 done — DID, key pair, digital signature, and addressing are now backed by working code
([`03_identity_and_keys.md`](03_identity_and_keys.md)): real Ed25519/`did:key`, create→sign→verify, all
against the real spec shapes.
Phase 4 done — a stand-in trust provider issues a real Ed25519-signed **verifiable credential** bound to the
holder's DID, verification runs four independent checks (schema/signature/revocation/expiry), and revocation
makes it fail while the signature stays valid ([`04_credentials.md`](04_credentials.md)).
Phase 5 done — a **token** (UNITS 5-section model) is minted from a KYC-gated **token class**, with the
**compliance hook** enforced at mint time: minting is refused unless the owner holds a valid credential, so a
non-compliant asset can't be created ([`05_tokens.md`](05_tokens.md)).
Phase 6 done — a token is **transferred** on a stand-in unified ledger, recorded as a tamper-evident
**state-commitment chain**, with a real **Merkle proof** of inclusion that the browser re-folds leaf→root
(and tampering breaks). This is the artifact **UILP** carries between ledgers ([`06_movement.md`](06_movement.md)).
Phase 7 done — Phases 3–6 are wired into one guided, zero-context demo (intro framing, a live progress rail,
closing summary): the full **account → credential → token → transfer → proof** lifecycle in the browser
([`07_app_walkthrough.md`](07_app_walkthrough.md)).
Phase 8 done — the paper is walked section by section in
[`09_how_this_maps_to_finternet.md`](09_how_this_maps_to_finternet.md), with an honest verdict per idea
(demonstrated / partial / understood-but-not-built / stand-in) and a list of what we did **not** build.
Corrections made there: UILP = **Unified Interledger Protocol**, and "flow-level regulation" (§3) is a
different sentence from "safe by design" (§4.4).
**Trusted proof chain closed (post-Phase-8)** — the credential that authorizes a mint is now embedded verbatim
in `token.claims[0]`, folded into the `stateCommitment`, and verified in the browser without contacting the
issuer. The token carries its own compliance ([`05_tokens.md`](05_tokens.md) §5). Only optional Phase 9
(fraud/anomaly detection) remains.*
