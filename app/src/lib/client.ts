// Typed client for the stand-in identity service, speaking the Finternet envelope
// pattern ({ context, payload, signature? } in; { context, response } out). All calls
// go through the Vite dev proxy at /api -> http://127.0.0.1:8081 (see vite.config.ts).

import type {
  AvailabilityResponse,
  RegistrationSuccessResponse,
  AccountProfile,
  AccountKeyList,
  SignatureResponse,
  EntityType,
  IssuerInfo,
  CredentialToken,
  VerificationResult,
  TokenClass,
  MintAccepted,
  TokenInstance,
  TransactAccepted,
  ProofDetails,
  TransactionLog,
} from './types.js';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function context(id: string, token?: string) {
  return {
    id: `api.${id}`,
    version: '1.0',
    ts: new Date().toISOString(),
    msgId: crypto.randomUUID(),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function post<T>(path: string, id: string, payload: unknown, token?: string): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context: context(id, token), payload }),
  });
  let body: { context?: { status?: string; error?: { code?: string; message?: string } }; response?: T };
  try {
    body = await res.json();
  } catch {
    throw new ApiError('BAD_RESPONSE', `Non-JSON response (HTTP ${res.status})`, res.status);
  }
  // "successful" for sync calls; "accepted" for async ones (e.g. token/mint returns 202).
  if (body?.context?.status !== 'successful' && body?.context?.status !== 'accepted') {
    throw new ApiError(
      body?.context?.error?.code ?? `HTTP_${res.status}`,
      body?.context?.error?.message ?? 'Request failed',
      res.status,
    );
  }
  return body.response as T;
}

export const api = {
  checkAvailability: (address: string) =>
    post<AvailabilityResponse>('/v1/address/checkAvailability', 'account.checkAvailability', { address }),

  createAccount: (payload: { address: string; name: string; entityType: EntityType }) =>
    post<RegistrationSuccessResponse>('/v1/account/create', 'account.create', payload),

  getAccount: (token: string) => post<AccountProfile>('/v1/account/get', 'account.get', {}, token),

  searchKeys: (token: string) =>
    post<AccountKeyList>('/v1/account/keys/search', 'account.keys.search', {}, token),

  sign: (keyReference: string, hash: string) =>
    post<SignatureResponse>('/v1/keys/sign', 'keys.sign', { keyReference, hash }),

  // ---- credentials (STAND-IN endpoints) ----
  getIssuer: () => post<IssuerInfo>('/v1/credentials/issuer', 'credentials.issuer', {}),

  issueCredential: (payload: { holderDid: string; subject?: Record<string, unknown> }) =>
    post<{ credential: CredentialToken }>('/v1/credentials/issue', 'credentials.issue', payload),

  verifyCredential: (credential: CredentialToken) =>
    post<VerificationResult>('/v1/credentials/verify', 'credentials.verify', { credential }),

  revokeCredential: (credentialId: string) =>
    post<{ id: string; status: string }>('/v1/credentials/revoke', 'credentials.revoke', { credentialId }),

  // ---- tokens (STAND-IN endpoints) ----
  getTokenClass: (tokenClass: string) =>
    post<TokenClass>('/v1/registry/tokenclasses/get', 'registry.tokenclasses.get', { tokenClass }),

  // Async: returns 202 "accepted" with the minted tokenId (resolved synchronously by the stand-in).
  mintToken: (
    token: string,
    payload: { tokenClass: string; initialSupply: string; metadata?: Record<string, unknown>; data?: Record<string, unknown> },
  ) => post<MintAccepted>('/v1/token/mint', 'token.mint', payload, token),

  getToken: (token: string, tokenId: string) =>
    post<TokenInstance>('/v1/token/get', 'token.get', { tokenId }, token),

  searchTokens: (token: string) =>
    post<{ tokens: TokenInstance[]; pagination: { total: number } }>('/v1/token/search', 'token.search', {}, token),

  // ---- movement (Phase 6) ----
  transfer: (token: string, tokenId: string, to: string) =>
    post<TransactAccepted>('/v1/token/transact', 'token.transact', { operation: 'transfer', tokenId, to }, token),

  getTransaction: (token: string, txId: string) =>
    post<TransactionLog>('/v1/transaction/get', 'transaction.get', { txId }, token),

  getProof: (token: string, txId: string) =>
    post<ProofDetails>('/v1/transaction/proof', 'transaction.proof', { txId }, token),
};
