import { describe, it, expect } from 'vitest';
import { issueCredential } from './credentials.js';
import { mintToken, transferToken } from './tokens.js';
import { getProof, tokenTransactions, type ProofPathNode } from './ledger.js';
import { sha256Hex } from './crypto.js';

const owner = (n: string) => `did:key:z6Mkowner${n}TestTestTestTestTestTestTestTestTest`;

// Independently re-fold a Merkle proof: leafHash + sibling path -> root (mirrors the browser).
function foldToRoot(leafHash: string, path: ProofPathNode[]): string {
  let h = leafHash;
  for (const node of path) h = node.direction === 'left' ? sha256Hex(node.hash + h) : sha256Hex(h + node.hash);
  return h;
}

// A KYC credential is required to mint the gated PROP-DEED class.
function mintDeed(ownerDid: string) {
  issueCredential({ holderDid: ownerDid, subject: { fullName: 'Owner' } });
  const r = mintToken({ tokenClass: 'PROP-DEED', ownerDid, initialSupply: '1' });
  if (!r.ok) throw new Error('mint precondition failed');
  return r.token;
}

describe('movement: transfer, state-commitment chain, Merkle proof', () => {
  it('mint records a genesis transaction and an opening state commitment', () => {
    const token = mintDeed(owner('A'));
    expect(token.state.stateCommitment).toBeTruthy();
    const history = tokenTransactions(token.id);
    expect(history.length).toBe(1);
    expect(history[0]?.operation).toBe('mint');
  });

  it('transfer moves ownership and chains a new commitment from the previous one', () => {
    const token = mintDeed(owner('B'));
    const before = token.state.stateCommitment;
    const to = owner('B2');

    const t = transferToken({ tokenId: token.id, fromDid: owner('B'), toDid: to });
    expect(t.ok).toBe(true);

    expect(token.identities.find((i) => i.type === 'owner')?.id).toBe(to); // ownership moved
    expect(token.state.stateCommitment).not.toBe(before); // commitment advanced

    const history = tokenTransactions(token.id);
    expect(history.map((h) => h.operation)).toEqual(['mint', 'transfer']);
    const transfer = history[1]!;
    expect(transfer.stateBefore?.stateCommitment).toBe(before); // chain link: before == prior head
    expect(transfer.stateAfter.stateCommitment).toBe(token.state.stateCommitment);
  });

  it('produces a Merkle proof that folds leaf->root, and tampering breaks it', () => {
    const token = mintDeed(owner('C'));
    const t = transferToken({ tokenId: token.id, fromDid: owner('C'), toDid: owner('C2') });
    if (!t.ok) throw new Error('transfer failed');

    const proof = getProof(t.txId);
    expect(proof).toBeTruthy();
    if (!proof) return;
    expect(foldToRoot(proof.leafHash, proof.proofPath)).toBe(proof.merkleRoot); // valid inclusion
    const tampered = 'dead' + proof.leafHash.slice(4);
    expect(foldToRoot(tampered, proof.proofPath)).not.toBe(proof.merkleRoot); // one changed leaf breaks it
  });

  it('refuses a transfer from a non-owner', () => {
    const token = mintDeed(owner('D'));
    const t = transferToken({ tokenId: token.id, fromDid: 'did:key:z6MkNotTheOwner', toDid: owner('D2') });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.code).toBe('NOT_OWNER');
  });
});
