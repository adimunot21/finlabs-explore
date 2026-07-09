// STAND-IN: token minting, retrieval, and owner search.
//
// The endpoints are ours, but the TOKEN SHAPE is the real spec's: every token we build is
// validated against Finternet's own JSON Schema (specs-vendor/schemas/token/token.schema.json)
// before we store it, and again at the HTTP edge against the OpenAPI `Token` schema.
//
// THE POINT OF PHASE 5 lives in `mintToken`: the COMPLIANCE HOOK. If the token class is
// KYC-gated (metadata.requiresKYC), we refuse to mint unless the owner holds a valid Phase-4
// credential. This is the paper's "regulation at the flow level / safe by design" (§4.4): a
// non-compliant token cannot be created in the first place — the rule is *in* the mint flow,
// not a check bolted on beside it.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { getTokenClass } from './tokenclasses.js';
import { credentialsForHolder, verifyCredential, issuerInfo } from './credentials.js';

// ---- validator built from the REAL vendored JSON Schema (draft-07) ----
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../../specs-vendor/schemas/token/token.schema.json');
const tokenSchema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
const ajv = new Ajv({ strict: false, allErrors: true }); // default import = JSON Schema draft-07
addFormats(ajv);
const validateToken: ValidateFunction = ajv.compile(tokenSchema);

const TOKEN_CONTEXT = 'https://finternet-io.github.io/specs/schemas/token/v1/context.jsonld';

// The UNITS token instance (only the sections we populate; the schema is the real contract).
export interface TokenInstance {
  '@context': string;
  '@type': string;
  id: string;
  metadata: {
    tokenStandard: string;
    name: string;
    symbol: string;
    decimals: number;
    fungibility: 'fungible' | 'nonFungible' | 'semiFungible';
    tokenClass: string;
    status: 'active' | 'inactive' | 'deprecated' | 'test';
    flags: { transferable: boolean; transactable: boolean; locked: boolean; revocable: boolean };
    createdAt: string;
    updatedAt: string;
  };
  data: Record<string, unknown>;
  identities: { id: string; type: string }[];
  state: {
    status: 'active' | 'frozen' | 'redeemed' | 'burned' | 'expired';
    effectiveFrom: string;
    supply: { totalSupply: string; circulatingSupply: string };
  };
}

const byId = new Map<string, TokenInstance>();
const ownerToIds = new Map<string, Set<string>>(); // ownerDid -> token ids

export interface MintInput {
  tokenClass: string;
  ownerDid: string;
  initialSupply: string;
  name?: string;
  data?: Record<string, unknown>;
}

export type MintResult =
  | { ok: true; token: TokenInstance }
  | { ok: false; code: 'CLASS_NOT_FOUND' | 'COMPLIANCE_CHECK_FAILED'; message: string };

export function mintToken(input: MintInput): MintResult {
  const tc = getTokenClass(input.tokenClass);
  if (!tc) {
    return { ok: false, code: 'CLASS_NOT_FOUND', message: `Unknown token class '${input.tokenClass}'` };
  }

  // ---- THE COMPLIANCE HOOK (regulation at the flow level, paper §4.4) ----
  // If the class is KYC-gated, the owner must currently hold at least one VALID credential.
  // "Valid" reuses Phase 4 exactly: schema-valid, issuer-signed, not revoked, not expired.
  if (tc.metadata.requiresKYC) {
    const held = credentialsForHolder(input.ownerDid);
    const hasValidCredential = held.some((c) => verifyCredential(c).valid);
    if (!hasValidCredential) {
      return {
        ok: false,
        code: 'COMPLIANCE_CHECK_FAILED',
        message:
          `Minting a '${tc.tokenClass}' token requires a valid KYC credential; ` +
          `holder ${input.ownerDid} holds none. Issue (and don't revoke) a credential first.`,
      };
    }
  }

  const now = new Date().toISOString();
  const token: TokenInstance = {
    '@context': TOKEN_CONTEXT,
    '@type': 'Token',
    id: `urn:uuid:token-${randomUUID()}`,
    metadata: {
      tokenStandard: tc.tokenStandard,
      name: input.name ?? tc.name,
      symbol: tc.metadata.symbol ?? 'TKN',
      decimals: tc.metadata.decimals ?? 0,
      fungibility: tc.metadata.fungible ? 'fungible' : 'nonFungible',
      tokenClass: tc.tokenClass,
      status: 'active',
      // flags come from the class; a deed is non-transferable-by-default is a Phase-6 concern,
      // so we leave it transferable here and revisit movement next phase.
      flags: { transferable: true, transactable: true, locked: false, revocable: false },
      createdAt: now,
      updatedAt: now,
    },
    data: input.data ?? {},
    identities: [
      { id: tc.identities[0]?.id ?? issuerInfo.did, type: 'issuer' },
      { id: input.ownerDid, type: 'owner' },
    ],
    state: {
      status: 'active',
      effectiveFrom: now,
      supply: { totalSupply: input.initialSupply, circulatingSupply: input.initialSupply },
    },
  };

  // Validate against the REAL token schema before storing (fail loudly if we ever drift).
  if (!validateToken(token)) {
    throw new Error(`minted token failed schema validation: ${ajv.errorsText(validateToken.errors)}`);
  }

  byId.set(token.id, token);
  const ids = ownerToIds.get(input.ownerDid) ?? new Set<string>();
  ids.add(token.id);
  ownerToIds.set(input.ownerDid, ids);
  return { ok: true, token };
}

export function getToken(id: string): TokenInstance | undefined {
  return byId.get(id);
}

export function tokensForOwner(ownerDid: string): TokenInstance[] {
  const ids = ownerToIds.get(ownerDid);
  if (!ids) return [];
  return [...ids].map((id) => byId.get(id)).filter((t): t is TokenInstance => Boolean(t));
}
