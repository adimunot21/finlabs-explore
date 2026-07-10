// Client-side cryptography — the same real Ed25519 / did:key primitives the stand-in
// uses, so the browser can VERIFY signatures itself. The point: verification needs only
// the PUBLIC key (recovered from the DID), never the private key. Signing stays on the
// server (the custodial KMS in standin-service); verifying happens right here.

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { base58 } from '@scure/base';

ed.etc.sha512Sync = (...m: Uint8Array[]): Uint8Array => sha512(ed.etc.concatBytes(...m));

/** SHA-256 of a UTF-8 message, hex — the pre-hash the sign API expects. */
export function sha256Hex(message: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(message)));
}

/** Recover the raw 32-byte Ed25519 public key from a publicKeyMultibase (z6Mk...). */
export function publicKeyFromMultibase(publicKeyMultibase: string): Uint8Array {
  if (!publicKeyMultibase.startsWith('z')) {
    throw new Error('expected base58btc multibase starting with "z"');
  }
  const decoded = base58.decode(publicKeyMultibase.slice(1));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('not an Ed25519 multicodec public key');
  }
  return decoded.slice(2); // strip the 0xed 0x01 multicodec prefix
}

/** Verify a hex signature over a hex hash against an Ed25519 public key. */
export function verifyHashHex(publicKey: Uint8Array, hashHex: string, signatureHex: string): boolean {
  try {
    return ed.verify(hexToBytes(signatureHex), hexToBytes(hashHex), publicKey);
  } catch {
    return false;
  }
}

/** The did:key suffix IS the publicKeyMultibase, e.g. did:key:z6Mk... -> z6Mk... */
export function multibaseFromDid(did: string): string {
  return did.startsWith('did:key:') ? did.slice('did:key:'.length) : did;
}

/**
 * Deterministic JSON (stable key order) — must match the ledger's `canonical()` byte for byte,
 * because it's the form the issuer signed. Any difference here and every signature "fails".
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

interface SignedClaim {
  proof?: { verificationMethod: string; proofValue: string };
  [k: string]: unknown;
}

/**
 * Verify a verifiable credential embedded in a token's `claims[]`, using ONLY the credential itself.
 * The issuer's public key is recovered from the DID inside `proof.verificationMethod` — so this needs
 * no network call to the issuer and no trust in the server that handed us the token. It checks the
 * issuer's signature over the credential minus its own proof.
 *
 * Caveat worth knowing: this proves the issuer *did* attest this, unaltered. It cannot prove the
 * credential hasn't since been *revoked* — freshness still requires the issuer's status list.
 */
export function verifyEmbeddedCredential(claim: SignedClaim): boolean {
  const { proof, ...withoutProof } = claim;
  if (!proof?.verificationMethod || !proof.proofValue) return false;
  try {
    const did = proof.verificationMethod.split('#')[0] ?? '';
    const publicKey = publicKeyFromMultibase(multibaseFromDid(did));
    return verifyHashHex(publicKey, sha256Hex(canonicalJson(withoutProof)), proof.proofValue);
  } catch {
    return false;
  }
}

export interface ProofPathNode {
  hash: string;
  direction: 'left' | 'right';
}

/**
 * Re-fold a Merkle inclusion proof: combine the leaf hash with each sibling on the path up to
 * the root. Uses the exact same SHA-256(left+right) the ledger used, so a valid proof folds back
 * to the published merkleRoot — and changing one bit of the leaf makes it diverge. This is the
 * browser independently verifying the ledger's proof, needing only hashes (no trust in the server).
 */
export function foldMerkleProof(leafHash: string, path: ProofPathNode[]): string {
  let h = leafHash;
  for (const node of path) h = node.direction === 'left' ? sha256Hex(node.hash + h) : sha256Hex(h + node.hash);
  return h;
}
