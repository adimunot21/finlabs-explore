// Real cryptography — this part is NOT a stand-in. Ed25519 keypairs, did:key
// encoding, and signing/verification here are genuine and interoperable with any
// standard Ed25519 / did:key implementation. (What IS a stand-in is holding the
// private key server-side; see store.ts.)
//
// Concepts (see docs/03_identity_and_keys.md, paper §5.4.3):
//   - Ed25519 key pair: a 32-byte private key (secret) and 32-byte public key.
//   - did:key: a DID whose identifier IS the public key, multicodec-tagged and
//     base58btc-encoded. For Ed25519 the multicodec prefix is 0xed 0x01, and the
//     result is prefixed with 'z' (base58btc multibase), yielding "z6Mk...".
//   - Signature: sign 32 bytes (a SHA-256 hash of the message) with the private
//     key; verify with the public key. Tampering with the message changes the
//     hash and makes verification fail.

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { base58 } from '@scure/base';

// @noble/ed25519 v2 needs SHA-512 wired in for its synchronous API.
ed.etc.sha512Sync = (...m: Uint8Array[]): Uint8Array => sha512(ed.etc.concatBytes(...m));

// Multicodec code for an Ed25519 public key, as an unsigned varint: 0xed 0x01.
const ED25519_PUB_MULTICODEC = new Uint8Array([0xed, 0x01]);

export interface Keypair {
  privateKey: Uint8Array; // 32 bytes, secret
  publicKey: Uint8Array; // 32 bytes, shareable
}

export function generateKeypair(): Keypair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** Encode an Ed25519 public key as a did:key and its publicKeyMultibase form. */
export function didKeyFromPublicKey(publicKey: Uint8Array): {
  did: string;
  publicKeyMultibase: string;
} {
  const prefixed = new Uint8Array(ED25519_PUB_MULTICODEC.length + publicKey.length);
  prefixed.set(ED25519_PUB_MULTICODEC, 0);
  prefixed.set(publicKey, ED25519_PUB_MULTICODEC.length);
  const publicKeyMultibase = `z${base58.encode(prefixed)}`;
  return { did: `did:key:${publicKeyMultibase}`, publicKeyMultibase };
}

/** Recover the raw 32-byte public key from a publicKeyMultibase (z6Mk...). */
export function publicKeyFromMultibase(publicKeyMultibase: string): Uint8Array {
  if (!publicKeyMultibase.startsWith('z')) {
    throw new Error('expected base58btc multibase starting with "z"');
  }
  const decoded = base58.decode(publicKeyMultibase.slice(1));
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('not an Ed25519 multicodec public key');
  }
  return decoded.slice(ED25519_PUB_MULTICODEC.length);
}

/** SHA-256 of a UTF-8 message, hex-encoded — the "pre-hash" the sign API expects. */
export function sha256Hex(message: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(message)));
}

/** Sign a pre-hashed (hex) message with an Ed25519 private key. Returns hex. */
export function signHashHex(privateKey: Uint8Array, hashHex: string): string {
  return bytesToHex(ed.sign(hexToBytes(hashHex), privateKey));
}

/** Verify a hex signature over a hex hash against an Ed25519 public key. */
export function verifyHashHex(
  publicKey: Uint8Array,
  hashHex: string,
  signatureHex: string,
): boolean {
  try {
    return ed.verify(hexToBytes(signatureHex), hexToBytes(hashHex), publicKey);
  } catch {
    return false;
  }
}

export { bytesToHex };
