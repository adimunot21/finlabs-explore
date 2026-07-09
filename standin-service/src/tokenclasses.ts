// STAND-IN: token-class registry.
//
// A "token class" is the TEMPLATE for tokens (like a class vs. an instance in code, or a
// mint vs. a coin). It declares: the JSON schema every instance must satisfy, who is
// allowed to mint, and — the part that matters most for Phase 5 — the COMPLIANCE POLICY.
//
// The endpoints (/v1/registry/tokenclasses/*) and this in-memory store are ours, but the
// TokenClass SHAPE is the real spec's (specs-vendor/api/token-interfaces.yaml #/components/
// schemas/TokenClass), enforced at the HTTP edge by express-openapi-validator. We seed one
// KYC-gated class at startup so the app has something to mint against.

import { issuerInfo } from './credentials.js';

// The subset of TokenClass we build/read. `schema` and `metadata` are open objects in the
// spec; we type only what we use. The compliance flag lives in metadata.requiresKYC, exactly
// as the spec's own RWA-NFT example does (token-interfaces.yaml, "RWA-NFT" register example).
export interface TokenClass {
  tokenClass: string;
  tokenStandard: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'deprecated' | 'test';
  schema: Record<string, unknown>;
  identities: { id: string; type: string; roles?: string[] }[];
  metadata: {
    fungible: boolean;
    symbol?: string;
    decimals?: number;
    category?: string;
    requiresKYC?: boolean; // ← the compliance hook: mint is gated on a valid credential
    createdAt?: string;
    updatedAt?: string;
    [k: string]: unknown;
  };
}

const store = new Map<string, TokenClass>();

function seed(): void {
  const now = new Date().toISOString();
  // A tokenized real-world property deed. Non-fungible, and KYC-gated: only a holder who
  // carries a valid KYC credential (Phase 4) may mint one — "regulation at the flow level".
  const propDeed: TokenClass = {
    tokenClass: 'PROP-DEED',
    tokenStandard: 'UNITS-NFT',
    name: 'Property Deed',
    description:
      'A tokenized real-world property deed. KYC-gated: minting requires the owner to hold a valid KYC credential.',
    status: 'active',
    // Minimal JSON Schema for instance `data`. Kept small on purpose; the real value here is
    // the compliance policy in metadata, not an elaborate data schema.
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            propertyAddress: { type: 'string' },
          },
        },
      },
    },
    // The land registry that governs this class is, for the demo, our own trust provider DID.
    identities: [{ id: issuerInfo.did, type: 'issuer', roles: ['admin', 'minter', 'compliance'] }],
    metadata: {
      fungible: false,
      symbol: 'DEED',
      decimals: 0,
      category: 'real_world_asset',
      requiresKYC: true,
      createdAt: now,
      updatedAt: now,
    },
  };
  store.set(propDeed.tokenClass, propDeed);
}
seed();

export function getTokenClass(tokenClass: string): TokenClass | undefined {
  return store.get(tokenClass);
}

export function listTokenClasses(): TokenClass[] {
  return [...store.values()];
}

export interface RegisterTokenClassInput {
  tokenClass: string;
  tokenStandard: string;
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  identities?: { id: string; type: string; roles?: string[] }[];
  metadata?: Record<string, unknown>;
}

export function registerTokenClass(input: RegisterTokenClassInput): TokenClass {
  const now = new Date().toISOString();
  const tc: TokenClass = {
    tokenClass: input.tokenClass,
    tokenStandard: input.tokenStandard,
    name: input.name,
    description: input.description,
    status: 'active',
    schema: input.schema ?? { type: 'object' },
    identities: input.identities ?? [{ id: issuerInfo.did, type: 'issuer', roles: ['admin', 'minter'] }],
    metadata: {
      fungible: true,
      ...(input.metadata ?? {}),
      createdAt: now,
      updatedAt: now,
    },
  };
  store.set(tc.tokenClass, tc);
  return tc;
}

export function tokenClassExists(tokenClass: string): boolean {
  return store.has(tokenClass);
}
