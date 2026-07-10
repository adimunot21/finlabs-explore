import { describe, it, expect } from 'vitest';
import { verifyEmbeddedCredential } from './crypto.js';
import token from './__fixtures__/token-with-claim.json' with { type: 'json' };
import type { VerifiableClaim } from './types.js';

// This is a CROSS-IMPLEMENTATION test, and that's the whole point of it.
//
// The fixture is a real token minted by standin-service: the credential inside `claims[0]` was
// canonicalized and Ed25519-signed by the SERVER. Here the BROWSER's independent canonicalJson +
// SHA-256 + ed25519-verify has to reproduce that exact byte sequence. If the two canonicalizations
// ever drift by a single character, this test fails — which is far better than the UI quietly
// showing a red ✗ on a perfectly valid credential.

const claim = (token as { claims: VerifiableClaim[] }).claims[0]!;

describe('verifying a credential embedded in a token (server-signed, browser-verified)', () => {
  it('the fixture token really carries an embedded credential', () => {
    expect(claim).toBeDefined();
    expect(claim.issuer).toMatch(/^did:key:z/);
    expect(claim.proof?.type).toBe('Ed25519Signature2020');
  });

  it('verifies the issuer signature using only the credential itself', () => {
    // No issuer call, no server: the public key comes out of proof.verificationMethod.
    expect(verifyEmbeddedCredential(claim)).toBe(true);
  });

  it('fails when the embedded credential is tampered with', () => {
    const tampered = {
      ...claim,
      credentialSubject: { ...claim.credentialSubject, fullName: 'Mallory' },
    };
    expect(verifyEmbeddedCredential(tampered)).toBe(false);
  });

  it('fails when the proof is missing', () => {
    const { proof: _proof, ...noProof } = claim;
    void _proof;
    expect(verifyEmbeddedCredential(noProof)).toBe(false);
  });
});
