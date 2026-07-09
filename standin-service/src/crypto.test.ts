import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  didKeyFromPublicKey,
  publicKeyFromMultibase,
  sha256Hex,
  signHashHex,
  verifyHashHex,
} from './crypto.js';

describe('Ed25519 + did:key (real crypto, not a stand-in)', () => {
  it('generates a 32-byte keypair', () => {
    const { privateKey, publicKey } = generateKeypair();
    expect(privateKey).toHaveLength(32);
    expect(publicKey).toHaveLength(32);
  });

  it('encodes an Ed25519 did:key as z6Mk... and round-trips the public key', () => {
    const { publicKey } = generateKeypair();
    const { did, publicKeyMultibase } = didKeyFromPublicKey(publicKey);
    expect(did).toBe(`did:key:${publicKeyMultibase}`);
    expect(publicKeyMultibase.startsWith('z6Mk')).toBe(true); // Ed25519 multicodec marker
    expect(publicKeyFromMultibase(publicKeyMultibase)).toEqual(publicKey);
  });

  it('signs a message hash and verifies it with the public key', () => {
    const { privateKey, publicKey } = generateKeypair();
    const hash = sha256Hex('transfer 100 USDC to bob');
    const signature = signHashHex(privateKey, hash);
    expect(verifyHashHex(publicKey, hash, signature)).toBe(true);
  });

  it('fails verification when the message is tampered with', () => {
    const { privateKey, publicKey } = generateKeypair();
    const signature = signHashHex(privateKey, sha256Hex('pay alice 100'));
    const tamperedHash = sha256Hex('pay alice 900'); // one changed digit
    expect(verifyHashHex(publicKey, tamperedHash, signature)).toBe(false);
  });

  it('fails verification under a different public key', () => {
    const alice = generateKeypair();
    const mallory = generateKeypair();
    const hash = sha256Hex('I am alice');
    const signature = signHashHex(alice.privateKey, hash);
    expect(verifyHashHex(mallory.publicKey, hash, signature)).toBe(false);
  });
});
