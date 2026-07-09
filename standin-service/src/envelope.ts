// Helpers for the Finternet "protocol-agnostic envelope" (specs-vendor/api/README.md).
// Every request is { context, payload, signature? }; every response is
// { context: ResponseContext, response }. These helpers build spec-valid responses.

import { randomUUID } from 'node:crypto';
import type { Response } from 'express';

export interface RequestContext {
  id: string;
  version: string;
  ts: string;
  msgId: string;
  transactionId?: string | null;
  developerToken?: string | null;
  developerSignature?: string | null;
  authorization?: string | null;
}

export interface RequestEnvelope<P = unknown> {
  context: RequestContext;
  payload: P;
  signature?: { type: string; jws: string } | null;
}

type Status = 'successful' | 'failed' | 'pending' | 'accepted';

function responseContext(reqCtx: RequestContext | undefined, status: Status) {
  return {
    id: reqCtx?.id ?? 'api.unknown',
    version: reqCtx?.version ?? '1.0',
    ts: new Date().toISOString(),
    msgId: randomUUID(),
    ...(reqCtx?.transactionId ? { transactionId: reqCtx.transactionId } : {}),
    status,
  };
}

/** Send a spec-shaped success envelope. */
export function ok(res: Response, reqCtx: RequestContext | undefined, response: unknown, http = 200): void {
  res.status(http).json({ context: responseContext(reqCtx, 'successful'), response });
}

/**
 * Send a spec-shaped async "accepted" envelope (202). Used by /v1/token/mint: the
 * ApiResponse_TransactAccepted schema requires context.status == "accepted" and a
 * context.transactionId, with the txId echoed in the response body.
 */
export function accepted(
  res: Response,
  reqCtx: RequestContext | undefined,
  response: unknown,
  transactionId: string,
): void {
  res.status(202).json({ context: { ...responseContext(reqCtx, 'accepted'), transactionId }, response });
}

/** Send a spec-shaped error envelope (ApiError: ResponseContext.error + empty response). */
export function fail(
  res: Response,
  reqCtx: RequestContext | undefined,
  http: number,
  code: string,
  message: string,
): void {
  res.status(http).json({
    context: { ...responseContext(reqCtx, 'failed'), error: { code, message } },
    response: {},
  });
}

/** Pull a bearer token out of context.authorization ("Bearer <token>"). */
export function bearerToken(reqCtx: RequestContext | undefined): string | undefined {
  const raw = reqCtx?.authorization;
  if (!raw) return undefined;
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw;
}
