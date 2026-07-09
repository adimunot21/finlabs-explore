// STAND-IN request handlers. Shapes come from specs-vendor/api/{accounts,key-management}
// -interfaces.yaml (enforced by express-openapi-validator in app.ts); the logic is ours.

import type { Request, Response } from 'express';
import { ok, fail, accepted, bearerToken, type RequestEnvelope } from './envelope.js';
import * as store from './store.js';
import * as credentials from './credentials.js';
import * as tokenclasses from './tokenclasses.js';
import * as tokens from './tokens.js';
import * as ledger from './ledger.js';
import { randomUUID } from 'node:crypto';
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

// ---- tokens & token classes (token-interfaces.yaml; compliance hook is ours) ----

// POST /v1/registry/tokenclasses/register (payload: RegisterTokenClassRequest) -> TokenClass (201)
export function tokenClassRegister(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<tokenclasses.RegisterTokenClassInput>;
  if (!payload?.tokenClass || !payload.tokenStandard || !payload.name) {
    return fail(res, context, 400, 'INVALID_REQUEST', 'tokenClass, tokenStandard and name are required');
  }
  if (tokenclasses.tokenClassExists(payload.tokenClass)) {
    return fail(res, context, 409, 'RESOURCE_CONFLICT', `Token class '${payload.tokenClass}' already exists`);
  }
  ok(res, context, tokenclasses.registerTokenClass(payload), 201);
}

// POST /v1/registry/tokenclasses/get (payload: {tokenClass}) -> TokenClass
export function tokenClassGet(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ tokenClass: string }>;
  const tc = tokenclasses.getTokenClass(payload.tokenClass);
  if (!tc) return fail(res, context, 404, 'RESOURCE_NOT_FOUND', `No token class '${payload.tokenClass}'`);
  ok(res, context, tc);
}

// POST /v1/token/mint (payload: MintTokenRequest {tokenClass, initialSupply, metadata?, data?})
// The caller (identified by context.authorization) is the owner. Compliance is enforced here.
export function tokenMint(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{
    tokenClass: string;
    initialSupply: string;
    metadata?: { name?: string };
    data?: Record<string, unknown>;
  }>;
  const account = tokenAccount(req, res);
  if (!account) return;

  const result = tokens.mintToken({
    tokenClass: payload.tokenClass,
    ownerDid: account.did,
    initialSupply: payload.initialSupply,
    name: payload.metadata?.name,
    data: payload.data,
  });

  if (!result.ok) {
    // Compliance failure is a 403 — the token is refused at creation ("safe by design").
    const http = result.code === 'CLASS_NOT_FOUND' ? 404 : 403;
    return fail(res, context, http, result.code, result.message);
  }

  // Async envelope, exactly like the real spec: 202 accepted + a transaction id. We resolve
  // synchronously in memory, so the token is immediately fetchable via /v1/token/get.
  // NB: context.transactionId is validated as `format: uuid` (the shared accounts ResponseContext),
  // so we use a bare UUID — which also satisfies the async envelope's `uri-reference` override.
  const txId = randomUUID();
  accepted(
    res,
    context,
    { txId, tokenId: result.token.id, status: 'submitted', message: `Minted ${payload.tokenClass}` },
    txId,
  );
}

// POST /v1/token/get (payload: {tokenId}) -> Token
export function tokenGet(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ tokenId: string }>;
  const token = tokens.getToken(payload.tokenId);
  if (!token) return fail(res, context, 404, 'RESOURCE_NOT_FOUND', `No token '${payload.tokenId}'`);
  ok(res, context, token);
}

// POST /v1/token/search (owner inferred from context.authorization) -> TokenList
export function tokenSearch(req: Request, res: Response): void {
  const { context } = req.body as RequestEnvelope;
  const account = tokenAccount(req, res);
  if (!account) return;
  const owned = tokens.tokensForOwner(account.did);
  ok(res, context, { tokens: owned, pagination: { total: owned.length, limit: 50, offset: 0 } });
}

// ---- movement: transfer, transaction log, proof (Phase 6) ----

// POST /v1/token/transact (payload: TransactRequest {operation, tokenId, to, amount?})
// Phase 6 implements `transfer` (movement); other operations are future phases.
export function tokenTransact(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{
    operation: string;
    tokenId: string;
    to?: string;
    amount?: string;
  }>;
  const account = tokenAccount(req, res);
  if (!account) return;

  if (payload.operation !== 'transfer') {
    return fail(res, context, 400, 'UNSUPPORTED_OPERATION', `Only 'transfer' is implemented; got '${payload.operation}'`);
  }
  if (!payload.to) {
    return fail(res, context, 400, 'INVALID_REQUEST', "transfer requires payload.to (recipient address)");
  }
  const recipient = store.getByAddress(payload.to);
  if (!recipient) {
    return fail(res, context, 404, 'RECIPIENT_NOT_FOUND', `No account for address '${payload.to}'`);
  }

  const result = tokens.transferToken({ tokenId: payload.tokenId, fromDid: account.did, toDid: recipient.did });
  if (!result.ok) {
    const http = result.code === 'TOKEN_NOT_FOUND' ? 404 : 403;
    return fail(res, context, http, result.code, result.message);
  }

  accepted(
    res,
    context,
    { txId: result.txId, status: 'submitted', message: `Transferred token to ${payload.to}` },
    randomUUID(), // context.transactionId is validated as format:uuid — use a bare uuid
  );
}

// POST /v1/transaction/get (payload: {txId}) -> TransactionLog
export function transactionGet(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ txId: string }>;
  const log = ledger.getTransaction(payload.txId);
  if (!log) return fail(res, context, 404, 'RESOURCE_NOT_FOUND', `No transaction '${payload.txId}'`);
  ok(res, context, log);
}

// POST /v1/token/transactions (payload: {filters:{tokenId}}) -> TokenTransactionList
export function tokenTransactionsList(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ filters?: { tokenId?: string }; tokenId?: string }>;
  const tokenId = payload.filters?.tokenId ?? payload.tokenId;
  if (!tokenId) return fail(res, context, 400, 'INVALID_REQUEST', 'filters.tokenId is required');
  const list = ledger.tokenTransactions(tokenId);
  ok(res, context, { tokenTransactions: list, pagination: { total: list.length, limit: 100, offset: 0 } });
}

// POST /v1/transaction/proof (payload: {txId}) -> ProofDetails  (path injected in spec.ts)
export function transactionProof(req: Request, res: Response): void {
  const { context, payload } = req.body as RequestEnvelope<{ txId: string }>;
  const proof = ledger.getProof(payload.txId);
  if (!proof) return fail(res, context, 404, 'RESOURCE_NOT_FOUND', `No proof for '${payload.txId}'`);
  ok(res, context, proof);
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
