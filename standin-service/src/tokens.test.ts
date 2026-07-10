import { describe, it, expect } from 'vitest';
import { issueCredential, revokeCredential, verifyVcSignature, issuerInfo } from './credentials.js';
import { mintToken, getToken } from './tokens.js';

// A distinct holder DID per test keeps the shared in-memory credential store from leaking
// state between cases (credentialsForHolder filters by this exact DID).
const holder = (n: string) => `did:key:z6Mkho1der${n}TestTestTestTestTestTestTestTestTe`;

describe('token mint compliance hook (regulation at the flow level)', () => {
  it('BLOCKS minting a KYC-gated token when the holder has no credential', () => {
    const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid: holder('A'), initialSupply: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('COMPLIANCE_CHECK_FAILED');
  });

  it('ALLOWS minting once the holder has a valid credential, and the token is schema-valid', () => {
    const owner = holder('B');
    issueCredential({ holderDid: owner, subject: { fullName: 'Bob Example' } });

    const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid: owner, initialSupply: '1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.token.metadata.tokenClass).toBe('PROP-DEED');
      expect(r.token.identities.some((i) => i.type === 'owner' && i.id === owner)).toBe(true);
      // it was validated against the real token.schema.json inside mintToken, and is retrievable
      expect(getToken(r.token.id)?.id).toBe(r.token.id);
    }
  });

  it('embeds the authorizing credential in the token, verbatim and verifiable offline', () => {
    const owner = holder('E');
    const cred = issueCredential({ holderDid: owner, subject: { fullName: 'Erin Example' } });
    const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid: owner, initialSupply: '1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const claim = r.token.claims?.[0];
    expect(claim).toBeDefined();
    if (!claim) return;

    // Verbatim: the very VC the issuer signed, not a reshaped copy.
    expect(claim.id).toBe(cred.claims[0]!.id);
    expect(claim.issuer).toBe(issuerInfo.did);
    expect(claim.credentialSubject.id).toBe(owner);

    // The whole point: its signature verifies with nothing but the credential itself —
    // no issuer call, no store lookup. The token proves its own compliance.
    expect(verifyVcSignature(claim)).toBe(true);
  });

  it('detects tampering with the credential embedded in a token', () => {
    const owner = holder('F');
    issueCredential({ holderDid: owner, subject: { fullName: 'Frank Example' } });
    const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid: owner, initialSupply: '1' });
    if (!r.ok) throw new Error('mint precondition failed');

    const claim = r.token.claims![0]!;
    claim.credentialSubject.fullName = 'Mallory'; // swap the subject after issuance
    expect(verifyVcSignature(claim)).toBe(false);
  });

  it('BLOCKS minting again after the holder’s credential is revoked', () => {
    const owner = holder('C');
    const cred = issueCredential({ holderDid: owner, subject: { fullName: 'Carol Example' } });
    expect(mintToken({ tokenClass: 'PROP-DEED', ownerDid: owner, initialSupply: '1' }).ok).toBe(true);

    revokeCredential(cred.id);
    const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid: owner, initialSupply: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('COMPLIANCE_CHECK_FAILED');
  });

  it('returns CLASS_NOT_FOUND for an unknown token class', () => {
    const r = mintToken({ tokenClass: 'NOPE', ownerDid: holder('D'), initialSupply: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CLASS_NOT_FOUND');
  });
});
