import { describe, it, expect } from 'vitest';
import { issueCredential, verifyCredential, revokeCredential, issuerInfo } from './credentials.js';

const HOLDER = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBa82SsoPfnH4Ujp';

describe('verifiable credentials (real issuer signature, real schema)', () => {
  it('issues a schema-valid, signed KYC credential to a holder DID', () => {
    const cred = issueCredential({ holderDid: HOLDER, subject: { fullName: 'Alice Example', nationality: 'IN' } });
    expect(cred['@type']).toBe('CredentialToken');
    expect(cred.claims[0]?.issuer).toBe(issuerInfo.did); // string DID — embeddable as a token Claim
    expect(cred.claims[0]?.credentialSubject.id).toBe(HOLDER);
    expect(cred.claims[0]?.proof?.type).toBe('Ed25519Signature2020');

    const v = verifyCredential(cred);
    expect(v.valid).toBe(true);
    expect(v.checks).toEqual({ schemaValid: true, signatureValid: true, notRevoked: true, notExpired: true });
  });

  it('fails verification when the credential is tampered with', () => {
    const cred = issueCredential({ holderDid: HOLDER, subject: { fullName: 'Alice Example' } });
    // Attacker edits the subject after issuance but keeps the original signature.
    cred.claims[0]!.credentialSubject.fullName = 'Mallory';
    const v = verifyCredential(cred);
    expect(v.valid).toBe(false);
    expect(v.checks.signatureValid).toBe(false);
  });

  it('fails verification after the issuer revokes it', () => {
    const cred = issueCredential({ holderDid: HOLDER, subject: { fullName: 'Alice Example' } });
    expect(verifyCredential(cred).valid).toBe(true);
    revokeCredential(cred.id);
    const v = verifyCredential(cred);
    expect(v.valid).toBe(false);
    expect(v.checks.signatureValid).toBe(true); // signature is still fine…
    expect(v.checks.notRevoked).toBe(false); // …but it's revoked
  });
});
