// STAND-IN: credential issuance / verification / revocation.
//
// specs-vendor/api has NO dedicated credential-issuance endpoint, so the *endpoints*
// (/v1/credentials/{issue,verify,revoke}) are our own design — marked stand-in. But the
// credential DATA is shaped and validated against Finternet's REAL JSON Schema
// (specs-vendor/schemas/credential/credential.schema.json), and the issuer's signature is
// REAL Ed25519. The one simplification: we sign a canonical-JSON form of the credential
// rather than the full W3C Data Integrity RDF canonicalization suite — the cryptography is
// genuine (integrity + non-repudiation), only the canonicalization is simplified.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  generateKeypair,
  didKeyFromPublicKey,
  publicKeyFromMultibase,
  sha256Hex,
  signHashHex,
  verifyHashHex,
} from './crypto.js';

// ---- the issuer: a stand-in trust service provider with its own real key ----
const issuerKeys = generateKeypair();
const issuer = {
  ...didKeyFromPublicKey(issuerKeys.publicKey),
  name: 'Wayfinder KYC (stand-in issuer)',
  privateKey: issuerKeys.privateKey,
};
export const issuerInfo = { did: issuer.did, name: issuer.name };
const issuerVerificationMethod = `${issuer.did}#key-1`;

// ---- validator built from the REAL vendored JSON Schema ----
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../../specs-vendor/schemas/credential/credential.schema.json');
const credentialSchema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validateCredential: ValidateFunction = ajv.compile(credentialSchema);

// ---- types (only the parts we build/read; the schema is the real contract) ----
interface VcProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}
export interface Vc {
  id: string;
  '@context': string[];
  type: string[];
  // A string DID, NOT an object. credential.schema.json allows `oneOf[string(uri), object{id,name}]`,
  // and the string form is exactly what token.schema.json's `Claim.issuer` requires. Choosing it lets
  // the SAME signed credential be embedded verbatim into a token's `claims[]` — one signature, valid
  // in both places. (See docs/05 "the token carries its own trust".)
  issuer: string;
  issuanceDate: string;
  validFrom: string;
  validUntil: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus: Record<string, unknown>;
  credentialSchema: Record<string, unknown>;
  proof?: VcProof;
}
export interface CredentialToken {
  '@context': string;
  '@type': 'CredentialToken';
  id: string;
  metadata: Record<string, unknown>;
  claims: Vc[];
  identities: { id: string; type: string }[];
  state: Record<string, unknown> & { status: string };
}

export interface IssueInput {
  holderDid: string;
  credentialType?: string;
  verificationLevel?: string;
  subject?: Record<string, unknown>;
}

const store = new Map<string, CredentialToken>(); // id -> credential (state.status carries revocation)

// Deterministic JSON for signing (stable key order) — our stand-in canonicalization.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// The bytes the issuer signs: the VC without its own `proof`.
function vcSigningHash(vc: Vc): string {
  const { proof: _proof, ...withoutProof } = vc;
  void _proof;
  return sha256Hex(canonical(withoutProof));
}

function issuerPublicKeyFor(verificationMethod: string): Uint8Array {
  const did = verificationMethod.split('#')[0] ?? '';
  const multibase = did.replace('did:key:', '');
  return publicKeyFromMultibase(multibase);
}

export function issueCredential(input: IssueInput): CredentialToken {
  const now = new Date().toISOString();
  const oneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  const id = `urn:uuid:cred-${randomUUID()}`;
  const credentialType = input.credentialType ?? 'kycVerification';
  const verificationLevel = input.verificationLevel ?? 'enhanced';

  const vc: Vc = {
    id: `urn:uuid:vc-${randomUUID()}`,
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://finternet-io.github.io/specs/schemas/credential/v1/context.jsonld',
    ],
    type: ['VerifiableCredential', 'KYCCredential', 'IdentityCredential'],
    issuer: issuer.did,
    issuanceDate: now,
    validFrom: now,
    validUntil: oneYear,
    credentialSubject: { id: input.holderDid, ...(input.subject ?? {}) },
    credentialStatus: {
      id: `urn:finternet:standin:status:${id}`,
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: '0',
      statusListCredential: 'urn:finternet:standin:status-list',
    },
    credentialSchema: {
      id: 'https://finternet-io.github.io/specs/schemas/credential/v1/credential.schema.json',
      type: 'JsonSchema',
    },
  };
  // Real Ed25519 signature by the issuer over the VC (minus proof).
  vc.proof = {
    type: 'Ed25519Signature2020',
    created: now,
    verificationMethod: issuerVerificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: signHashHex(issuer.privateKey, vcSigningHash(vc)),
  };

  const credential: CredentialToken = {
    '@context': 'https://finternet-io.github.io/specs/schemas/credential/v1/context.jsonld',
    '@type': 'CredentialToken',
    id,
    metadata: {
      tokenStandard: ['UNITS-SBT', 'W3C-VC-2.0'],
      name: `KYC Verification (${verificationLevel})`,
      symbol: 'KYC',
      fungibility: 'nonFungible',
      decimals: 0,
      credentialType,
      verificationLevel,
      status: 'active',
      flags: { transferable: false, divisible: false, revocable: true, burnable: false },
      createdAt: now,
      updatedAt: now,
    },
    claims: [vc],
    identities: [
      { id: issuer.did, type: 'issuer' },
      { id: input.holderDid, type: 'subject' },
      { id: input.holderDid, type: 'holder' },
    ],
    state: { status: 'active', balance: '1', effectiveFrom: now, effectiveUntil: oneYear },
  };

  // Validate against the REAL schema before we hand it out (fail loudly if we drift).
  if (!validateCredential(credential)) {
    throw new Error(`issued credential failed schema validation: ${ajv.errorsText(validateCredential.errors)}`);
  }

  store.set(id, credential);
  return credential;
}

export interface VerificationResult {
  valid: boolean;
  checks: { schemaValid: boolean; signatureValid: boolean; notRevoked: boolean; notExpired: boolean };
  issuer: string;
  reason?: string;
}

export function verifyCredential(credential: CredentialToken): VerificationResult {
  const vc = credential.claims[0];
  const checks = { schemaValid: false, signatureValid: false, notRevoked: false, notExpired: false };

  checks.schemaValid = Boolean(validateCredential(credential));

  if (vc) checks.signatureValid = verifyVcSignature(vc);

  // Revocation is authoritative from our store (a real system uses a status list).
  const stored = store.get(credential.id);
  const status = (stored ?? credential).state.status;
  checks.notRevoked = status !== 'revoked';

  const until = vc?.validUntil ? Date.parse(vc.validUntil) : Number.POSITIVE_INFINITY;
  checks.notExpired = Date.now() < until;

  const valid = checks.schemaValid && checks.signatureValid && checks.notRevoked && checks.notExpired;
  const reason = valid
    ? undefined
    : !checks.signatureValid
      ? 'issuer signature does not verify (credential tampered or wrong issuer)'
      : !checks.notRevoked
        ? 'credential has been revoked by the issuer'
        : !checks.notExpired
          ? 'credential has expired'
          : 'credential failed schema validation';

  return { valid, checks, issuer: vc?.issuer ?? issuer.did, reason };
}

/**
 * Verify ONLY the issuer's signature over a verifiable credential — no store lookup, no revocation
 * check. This is what a third party can do offline with nothing but the credential itself: recover the
 * issuer's public key from the DID inside `proof.verificationMethod`, and check the signature over the
 * credential minus its proof. Used both by verifyCredential() and by anyone verifying a credential
 * embedded in a token's claims[].
 */
export function verifyVcSignature(vc: Vc): boolean {
  if (!vc.proof) return false;
  try {
    const pub = issuerPublicKeyFor(vc.proof.verificationMethod);
    return verifyHashHex(pub, vcSigningHash(vc), vc.proof.proofValue);
  } catch {
    return false;
  }
}

/** The first currently-valid credential held by this DID — i.e. what the compliance hook accepts. */
export function validCredentialFor(holderDid: string): CredentialToken | undefined {
  return credentialsForHolder(holderDid).find((c) => verifyCredential(c).valid);
}

export function getCredential(id: string): CredentialToken | undefined {
  return store.get(id);
}

export function revokeCredential(id: string): CredentialToken | undefined {
  const credential = store.get(id);
  if (!credential) return undefined;
  credential.state.status = 'revoked';
  (credential.metadata as Record<string, unknown>).status = 'deprecated';
  return credential;
}

export function credentialsForHolder(holderDid: string): CredentialToken[] {
  return [...store.values()].filter((c) => c.identities.some((i) => i.type === 'holder' && i.id === holderDid));
}
