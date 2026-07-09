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
