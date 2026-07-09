// STAND-IN: configuration for the Wayfinder identity stand-in service.
// This service is NOT Finternet Labs' code. It exists only because the real
// reference API (reference/finternet-api) implements an older, different shape
// than the canonical specs (see docs/01_reference_code_status.md). Its *shape*
// is theirs — every request/response is validated against specs-vendor/api/*.yaml —
// only the implementation behind it is ours.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // .../standin-service/src
const specsApiDir = resolve(here, '../../specs-vendor/api'); // repo/specs-vendor/api

export const CONFIG = {
  // Port 8081 so it never collides with the reference finternet-api (8080).
  port: Number(process.env.STANDIN_PORT ?? 8081),
  host: process.env.STANDIN_HOST ?? '127.0.0.1',
  // The REAL OpenAPI contracts we validate against (ground truth for shape).
  specs: {
    accounts: resolve(specsApiDir, 'accounts-interfaces.yaml'),
    keyManagement: resolve(specsApiDir, 'key-management-interfaces.yaml'),
  },
  // Stand-in token lifetime advertised in RegistrationSuccessResponse.expiresIn.
  tokenExpiresInSeconds: 3600,
} as const;
