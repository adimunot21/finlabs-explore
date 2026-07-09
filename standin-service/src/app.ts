// STAND-IN service wiring. The key point: every request/response is validated against
// the REAL OpenAPI files in specs-vendor/ (accounts + key-management). We run two
// validator instances, each with `ignoreUndocumented: true`, so each validates only the
// paths it owns and passes the rest through. If our handlers ever drift from the specs'
// shapes, response validation fails loudly here.

import express, { type NextFunction, type Request, type Response } from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import { CONFIG } from './config.js';
import { fail, type RequestEnvelope } from './envelope.js';
import { loadMergedSpec } from './spec.js';
import * as h from './handlers.js';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const validatorOptions = {
    validateRequests: true,
    validateResponses: true,
    validateSecurity: false, // stand-in: we don't enforce developer/user auth schemes
    ignoreUndocumented: true, // let each validator ignore paths it doesn't define
  } as const;

  // One validator over the merged accounts + key-management + token contract (see spec.ts).
  const apiSpec = loadMergedSpec([CONFIG.specs.accounts, CONFIG.specs.keyManagement, CONFIG.specs.token]);
  app.use(OpenApiValidator.middleware({ apiSpec: apiSpec as never, ...validatorOptions }));

  // A tiny non-spec health check for ops (ignored by both validators).
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'wayfinder-standin' }));

  // accounts-interfaces.yaml
  app.post('/v1/account/create', h.accountCreate);
  app.post('/v1/address/checkAvailability', h.checkAvailability);
  app.post('/v1/address/resolve', h.resolveAddress);
  app.post('/v1/account/get', h.accountGet);
  app.post('/v1/account/keys/search', h.keysSearch);

  // key-management-interfaces.yaml
  app.post('/v1/keys/sign', h.keysSign);
  app.post('/v1/keys/public', h.keysPublic);

  // credentials (STAND-IN endpoints — no dedicated spec; credential data is validated
  // against specs-vendor/schemas/credential/credential.schema.json inside credentials.ts).
  app.post('/v1/credentials/issuer', h.credentialIssuer);
  app.post('/v1/credentials/issue', h.credentialIssue);
  app.post('/v1/credentials/verify', h.credentialVerify);
  app.post('/v1/credentials/revoke', h.credentialRevoke);
  app.post('/v1/credentials/list', h.credentialList);

  // token-interfaces.yaml — token classes + tokens. Mint enforces the compliance hook.
  app.post('/v1/registry/tokenclasses/register', h.tokenClassRegister);
  app.post('/v1/registry/tokenclasses/get', h.tokenClassGet);
  app.post('/v1/token/mint', h.tokenMint);
  app.post('/v1/token/get', h.tokenGet);
  app.post('/v1/token/search', h.tokenSearch);

  // movement (Phase 6): transfer + transaction log + Merkle proof
  app.post('/v1/token/transact', h.tokenTransact);
  app.post('/v1/transaction/get', h.transactionGet);
  app.post('/v1/token/transactions', h.tokenTransactionsList);
  app.post('/v1/transaction/proof', h.transactionProof);

  // Turn express-openapi-validator errors (and anything else) into a spec-shaped
  // error envelope instead of the library's default HTML/JSON.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
    const message = (err as { message?: string }).message ?? 'Internal error';
    const context = (req.body as RequestEnvelope | undefined)?.context;
    // eslint-disable-next-line no-console
    if (status >= 500) console.error('[standin] error:', err);
    fail(res, context, status, `HTTP_${status}`, message);
  });

  return app;
}
