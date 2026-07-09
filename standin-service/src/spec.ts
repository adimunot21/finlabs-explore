// Load & prepare the vendored OpenAPI files for express-openapi-validator.
//
// Two shims, both in-memory (the vendored files on disk stay pristine):
//
// 1. `nullable` strip. The specs use `nullable: true` on a few *type-less* composed
//    schemas (e.g. `{ $ref: ErrorPayload, nullable: true }`). Strict ajv rejects
//    `nullable` without a sibling `type`, so we drop it from those nodes only. The
//    field is optional regardless, so nothing meaningful is lost.
//
// 2. Single-document merge. We validate two specs (accounts + key-management). Running
//    two express-openapi-validator instances on one app collides because both specs
//    declare the same envelope components (Context, ErrorPayload, …) and the validator
//    shares ajv state across instances. Their *paths* are disjoint, so we merge them
//    into one OpenAPI document and run a single validator. For the shared component
//    names, the first spec listed wins (they're structurally compatible supersets).

import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

type Doc = Record<string, any>;

function stripTypelessNullable(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(stripTypelessNullable);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.nullable === true && obj.type === undefined) delete obj.nullable;
    for (const value of Object.values(obj)) stripTypelessNullable(value);
  }
}

/**
 * Merge several vendored OpenAPI files into one document. Paths must be disjoint;
 * shared component names resolve to the FIRST spec that defines them.
 */
export function loadMergedSpec(paths: string[]): Doc {
  const docs = paths.map((p) => yaml.load(readFileSync(p, 'utf8')) as Doc);
  const [base, ...rest] = docs;
  if (!base) throw new Error('loadMergedSpec: no specs provided');

  const merged: Doc = {
    openapi: base.openapi,
    info: base.info,
    paths: {},
    components: { schemas: {}, responses: {}, parameters: {}, securitySchemes: {} },
  };

  for (const doc of docs) {
    Object.assign(merged.paths, doc.paths ?? {});
    const c = doc.components ?? {};
    // First-wins for shared component names: only add keys not already present.
    for (const section of ['schemas', 'responses', 'parameters', 'securitySchemes'] as const) {
      for (const [name, def] of Object.entries(c[section] ?? {})) {
        if (!(name in merged.components[section])) merged.components[section][name] = def;
      }
    }
  }
  void rest;

  stripTypelessNullable(merged);
  return merged;
}
