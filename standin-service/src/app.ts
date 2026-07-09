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

  // One validator over the merged accounts + key-management contract (see spec.ts).
  const apiSpec = loadMergedSpec([CONFIG.specs.accounts, CONFIG.specs.keyManagement]);
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
