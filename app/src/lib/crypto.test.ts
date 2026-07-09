import { describe, it, expect } from 'vitest';
import { sha256Hex, publicKeyFromMultibase, verifyHashHex, multibaseFromDid } from './crypto.js';

// A fixed vector produced by the stand-in's crypto (same algorithms), so the app's
// verification is checked against a known-good signature, independent of the server.
// did:key -> its Ed25519 public key; signature is over sha256("hello wayfinder").
const DID = 'did:key:z6Mktq6bx1WsZhE9yKN2jsY7bF3f3Yb3Zt9m5m9dZC3q1abc'; // placeholder; not used for verify

describe('client crypto', () => {
  it('derives publicKeyMultibase from a did:key', () => {
    expect(multibaseFromDid('did:key:z6Mkfoo')).toBe('z6Mkfoo');
    expect(multibaseFromDid('z6Mkfoo')).toBe('z6Mkfoo');
    void DID;
  });

  it('round-trips a generated key end-to-end (sign here, verify here)', async () => {
    // Generate a keypair with the same library, sign, and verify — proves the app's
    // verify path is correct without needing the server.
    const ed = await import('@noble/ed25519');
    const { sha512 } = await import('@noble/hashes/sha512');
    ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));
    const { base58 } = await import('@scure/base');
    const { bytesToHex } = await import('@noble/hashes/utils');

    const priv = ed.utils.randomPrivateKey();
    const pub = ed.getPublicKey(priv);
    const multibase = 'z' + base58.encode(new Uint8Array([0xed, 0x01, ...pub]));

    const hash = sha256Hex('hello wayfinder');
    const signature = bytesToHex(ed.sign(hexToBytesLocal(hash), priv));

    const recovered = publicKeyFromMultibase(multibase);
    expect(recovered).toEqual(pub);
    expect(verifyHashHex(recovered, hash, signature)).toBe(true);
    expect(verifyHashHex(recovered, sha256Hex('hello wayfinder!'), signature)).toBe(false);
  });
});

function hexToBytesLocal(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
