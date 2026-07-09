// STAND-IN: in-memory account store. A real Finternet deployment persists accounts
// and — crucially — would NEVER hold your private key like this; a real KMS keeps
// keys in an HSM/enclave and only ever returns signatures. We hold the private key
// server-side purely so the demo's custodial `keys/sign` endpoint can work. All
// state is lost on restart. Marked STAND-IN for exactly these reasons.

import { randomUUID } from 'node:crypto';
import { generateKeypair, didKeyFromPublicKey } from './crypto.js';

export interface Account {
  address: string; // Finternet address (bare username), e.g. "alice"
  name: string;
  entityType: 'PERSONAL' | 'BUSINESS';
  did: string; // did:key:z6Mk...
  keyId: string; // uuid; doubles as the key-management keyReference
  publicKeyMultibase: string; // z6Mk...
  publicKey: Uint8Array;
  privateKey: Uint8Array; // STAND-IN: custodial; never do this in production
  createdAt: string;
}

const byAddress = new Map<string, Account>();
const byToken = new Map<string, string>(); // opaque token -> address
const byKeyId = new Map<string, string>(); // keyId (keyReference) -> address

export function addressTaken(address: string): boolean {
  return byAddress.has(address);
}

export function getByAddress(address: string): Account | undefined {
  return byAddress.get(address);
}

export function getByKeyId(keyId: string): Account | undefined {
  const address = byKeyId.get(keyId);
  return address ? byAddress.get(address) : undefined;
}

export function getByToken(token: string): Account | undefined {
  const address = byToken.get(token);
  return address ? byAddress.get(address) : undefined;
}

export interface CreatedAccount {
  account: Account;
  accessToken: string;
}

export function createAccount(input: {
  address: string;
  name: string;
  entityType: 'PERSONAL' | 'BUSINESS';
}): CreatedAccount {
  const { privateKey, publicKey } = generateKeypair();
  const { did, publicKeyMultibase } = didKeyFromPublicKey(publicKey);
  const keyId = randomUUID();
  const account: Account = {
    address: input.address,
    name: input.name,
    entityType: input.entityType,
    did,
    keyId,
    publicKeyMultibase,
    publicKey,
    privateKey,
    createdAt: new Date().toISOString(),
  };
  byAddress.set(account.address, account);
  byKeyId.set(keyId, account.address);

  // STAND-IN: a real access token would be a signed, expiring JWT. Ours is an
  // opaque random string mapped to the account in memory — enough to identify the
  // caller on /v1/account/get and /v1/account/keys/search.
  const accessToken = `standin_${randomUUID()}`;
  byToken.set(accessToken, account.address);
  return { account, accessToken };
}
