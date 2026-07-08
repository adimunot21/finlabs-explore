# Vendored: finternet-io/specs

This directory is a **pinned copy** of Finternet Labs' open API + schema specifications.
It is **their work, not ours** — vendored here so type generation and validation run against a
fixed, known version of the real contract (per `CLAUDE.md`: specs are ground truth for shape/naming).

| Field | Value |
|---|---|
| Source | https://github.com/finternet-io/specs |
| Pinned commit | `7eb766dadf88476073623722a77cf9b0dc525b64` |
| Commit date | 2026-04-29 |
| Vendored on | 2026-07-08 |
| License | Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0) — see `LICENSE.md` |

## What's here

- `api/*.yaml` — 8 OpenAPI interface files (accounts, key-management, registry, token, token-class-config,
  delegations, adapter, clients).
- `schemas/**` — JSON-LD contexts, JSON Schemas, and attribute YAMLs for core, account, credential, token,
  token-class (base/credential/fungible/non-fungible/loan-pool/nfh-voucher), and transaction.

## Updating

Re-vendor by cloning upstream at a new commit, copying the tree without its `.git`, and updating the
pinned commit + date above. Do not hand-edit vendored files; changes belong upstream.
