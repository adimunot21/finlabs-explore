// STAND-IN request handlers. Shapes come from specs-vendor/api/{accounts,key-management}
// -interfaces.yaml (enforced by express-openapi-validator in app.ts); the logic is ours.

import type { Request, Response } from 'express';
import { ok, fail, bearerToken, type RequestEnvelope } from './envelope.js';
import * as store from './store.js';
import * as credentials from './credentials.js';
import { signHashHex } from './crypto.js';

const FINTERNET_ADDRESS_RE = /^[a-z0-9_-]+$/; // core.yaml FinternetAddress pattern

// ---- accounts-interfaces.yaml ----

// POST /v1/account/create  (payload: RegistrationRequest {address, name, entityType})
export function accountCreate(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{
    address: string;
    name: string;
    entityType: 'PERSONAL' | 'BUSINESS';
  }>;
  const address = payload.address;
  if (!FINTERNET_ADDRESS_RE.test(address)) {
    return fail(res, context, 400, 'INVALID_ADDRESS', 'Address must match ^[a-z0-9_-]+$');
  }
  if (store.addressTaken(address)) {
    return fail(res, context, 409, 'ADDRESS_TAKEN', `Address '${address}' is already registered`);
  }
  const { accessToken } = store.createAccount({
    address,
    name: payload.name,
    entityType: payload.entityType,
  });
  // RegistrationSuccessResponse — the accounts spec declares 201 (not 200) for create.
  ok(res, context, { accessToken, tokenType: 'Bearer', expiresIn: 3600, isExisting: false }, 201);
}

// POST /v1/address/checkAvailability  (payload: {address})
export function checkAvailability(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ address: string }>;
  ok(res, context, { available: !store.addressTaken(payload.address) }); // AvailabilityResponse
}

// POST /v1/address/resolve  (payload: ResolveRequest {address}) -> ResolveResponse {address, did}
export function resolveAddress(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ address: string }>;
  const account = store.getByAddress(payload.address);
  if (!account) {
    return fail(res, context, 404, 'NOT_FOUND', `No account for address '${payload.address}'`);
  }
  ok(res, context, { address: account.address, did: account.did });
}

// POST /v1/account/get  (empty payload; caller identified by context.authorization) -> AccountProfile
export function accountGet(req: Request, res: Response): void {
  const { context } = req.body as RequestEnvelope;
  const account = tokenAccount(req, res);
  if (!account) return;
  ok(res, context, {
    did: account.did,
    address: account.address,
    name: account.name,
    entityType: account.entityType,
  });
}

// POST /v1/account/keys/search -> AccountKeyList {keys: [AccountKeyInfo]}
export function keysSearch(req: Request, res: Response): void {
  const { context } = req.body as RequestEnvelope;
  const account = tokenAccount(req, res);
  if (!account) return;
  ok(res, context, {
    keys: [
      {
        keyId: account.keyId,
        publicKeyMultibase: account.publicKeyMultibase,
        keyType: 'Ed25519VerificationKey2020',
        purpose: ['authentication', 'assertion'],
        status: 'active',
        isPrimary: true,
        createdAt: account.createdAt,
      },
    ],
  });
}

// ---- key-management-interfaces.yaml ----

// POST /v1/keys/sign  (payload: SignMessageRequest {keyReference, hash}) -> SignatureResponse {signature}
export function keysSign(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ keyReference: string; hash: string }>;
  const account = store.getByKeyId(payload.keyReference);
  if (!account) {
    return fail(res, context, 404, 'KEY_NOT_FOUND', `No key for reference '${payload.keyReference}'`);
  }
  const hashHex = payload.hash.startsWith('0x') ? payload.hash.slice(2) : payload.hash;
  const signature = signHashHex(account.privateKey, hashHex);
  ok(res, context, { signature });
}

// POST /v1/keys/public  (payload: GetPublicKeyRequest {keyReference}) -> PublicKeyResponse {publicKey, address}
export function keysPublic(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ keyReference: string }>;
  const account = store.getByKeyId(payload.keyReference);
  if (!account) {
    return fail(res, context, 404, 'KEY_NOT_FOUND', `No key for reference '${payload.keyReference}'`);
  }
  ok(res, context, { publicKey: account.publicKeyMultibase, address: account.address });
}

// ---- credentials (STAND-IN endpoints; credential data validated against the real schema) ----

// POST /v1/credentials/issuer -> who is issuing (a stand-in trust service provider)
export function credentialIssuer(req: Request, res: Response): void {
  const { context } = req.body as RequestEnvelope;
  ok(res, context, credentials.issuerInfo);
}

// POST /v1/credentials/issue  (payload: {holderDid, subject?, credentialType?, verificationLevel?})
export function credentialIssue(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<credentials.IssueInput>;
  if (!payload?.holderDid || !payload.holderDid.startsWith('did:')) {
    return fail(res, context, 400, 'INVALID_HOLDER', 'payload.holderDid must be a DID');
  }
  try {
    const credential = credentials.issueCredential(payload);
    ok(res, context, { credential }, 201);
  } catch (e) {
    fail(res, context, 500, 'ISSUE_FAILED', (e as Error).message);
  }
}

// POST /v1/credentials/verify  (payload: {credentialId} or {credential})
export function credentialVerify(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{
    credentialId?: string;
    credential?: credentials.CredentialToken;
  }>;
  const credential = payload.credential ?? (payload.credentialId ? credentials.getCredential(payload.credentialId) : undefined);
  if (!credential) {
    return fail(res, context, 404, 'NOT_FOUND', 'no credential given or found by id');
  }
  ok(res, context, credentials.verifyCredential(credential));
}

// POST /v1/credentials/revoke  (payload: {credentialId})
export function credentialRevoke(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ credentialId: string }>;
  const credential = credentials.revokeCredential(payload.credentialId);
  if (!credential) {
    return fail(res, context, 404, 'NOT_FOUND', `no credential '${payload.credentialId}'`);
  }
  ok(res, context, { id: credential.id, status: credential.state.status });
}

// POST /v1/credentials/list  (payload: {holderDid}) -> credentials held by a DID
export function credentialList(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ holderDid: string }>;
  ok(res, context, { credentials: credentials.credentialsForHolder(payload.holderDid) });
}

// Resolve the account behind context.authorization, or send 401 and return undefined.
function tokenAccount(req: Request, res: Response): store.Account | undefined {
  const { context } = req.body as RequestEnvelope;
  const token = bearerToken(context);
  const account = token ? store.getByToken(token) : undefined;
  if (!account) {
    fail(res, context, 401, 'UNAUTHORIZED', 'Missing or invalid context.authorization token');
    return undefined;
  }
  return account;
}
