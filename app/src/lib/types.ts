// Response payload shapes, mirrored from specs-vendor/api/{accounts,key-management}.

export type EntityType = 'PERSONAL' | 'BUSINESS';

export interface AvailabilityResponse {
  available: boolean;
}

export interface RegistrationSuccessResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  isExisting: boolean;
}

export interface AccountProfile {
  did: string;
  address: string;
  name: string;
  entityType: EntityType;
  email?: string | null;
  mobile?: string | null;
}

export interface AccountKeyInfo {
  keyId: string;
  publicKeyMultibase: string;
  keyType: string;
  purpose?: string[];
  status: 'active' | 'revoked';
  isPrimary?: boolean;
  createdAt: string;
}

export interface AccountKeyList {
  keys: AccountKeyInfo[];
}

export interface SignatureResponse {
  signature: string;
}

// ---- credentials (STAND-IN endpoints; data shaped by the real credential.schema.json) ----

export interface IssuerInfo {
  did: string;
  name: string;
}

// We treat the credential as opaque on the client except for a few fields we display.
// The full shape is the vendored credential.schema.json; the server is authoritative.
export interface CredentialToken {
  id: string;
  '@type': string;
  metadata: {
    name?: string;
    credentialType?: string;
    verificationLevel?: string;
    [k: string]: unknown;
  };
  claims: Array<{
    issuer: { id: string; name?: string };
    issuanceDate: string;
    validUntil: string;
    credentialSubject: Record<string, unknown>;
    proof?: { type: string; verificationMethod: string };
    [k: string]: unknown;
  }>;
  state: { status: string; [k: string]: unknown };
  [k: string]: unknown;
}

export interface VerificationResult {
  valid: boolean;
  checks: { schemaValid: boolean; signatureValid: boolean; notRevoked: boolean; notExpired: boolean };
  issuer: string;
  reason?: string;
}

// ---- tokens (STAND-IN endpoints; instance shape is the real token.schema.json) ----

export interface TokenClass {
  tokenClass: string;
  tokenStandard: string;
  name: string;
  description?: string;
  status: string;
  metadata: { fungible: boolean; requiresKYC?: boolean; symbol?: string; [k: string]: unknown };
}

export interface MintAccepted {
  txId: string;
  tokenId: string;
  status: string;
  message: string;
}

// The UNITS 5-section token — we read a handful of fields for display; the server is authoritative.
export interface TokenInstance {
  id: string;
  '@type'?: string;
  metadata: {
    tokenStandard: string;
    name: string;
    symbol: string;
    decimals: number;
    fungibility: string;
    tokenClass: string;
    status: string;
    [k: string]: unknown;
  };
  data?: Record<string, unknown>;
  identities: { id: string; type: string }[];
  state: { status: string; supply?: { totalSupply?: string; circulatingSupply?: string }; [k: string]: unknown };
}
