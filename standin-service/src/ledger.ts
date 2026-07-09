// STAND-IN: the unified ledger + proof engine (arch-map boxes 4–5).
//
// Finternet Labs' real Unified Ledger provider (solana-ul-provider) does not build on this
// machine (a bit-rotted pinned dependency; established in Phase 1, docs/01). So this in-memory
// ledger is a stand-in — BUT the substance is real: the state-commitment hash chain and the
// Merkle proofs computed here are genuine SHA-256 and independently verifiable (the browser
// re-folds leaf→root in app/src/lib/crypto.ts). What's a stand-in is the storage and the fact
// that there's one process, not a distributed ledger anchored to a public chain.
//
// Concepts (docs/06_movement.md, paper §5.4.4 & §5.4.6):
//   - TokenTransaction : a per-token state change, carrying stateBefore/stateAfter commitments.
//   - TransactionLog   : the business-transaction envelope wrapping ≥1 TokenTransaction.
//   - stateCommitment  : sha256 of the new state, INCLUDING the previous commitment → a hash
//                        chain per token (tamper any past state and every later commitment breaks).
//   - Merkle proof     : every transaction is a leaf; one merkleRoot commits to all of them; a
//                        compact proofPath proves inclusion without shipping the whole tree.

import { randomUUID } from 'node:crypto';
import { sha256Hex } from './crypto.js';

// ---- shapes (subset of the real transaction/proof schemas we populate) ----
export interface StateReference {
  stateCommitment: string;
  previousCommitment?: string;
  lastTxId?: string;
  stateVersion?: number;
}
export interface TokenTransaction {
  '@type': 'TokenTransaction';
  tokenTxId: string;
  txId: string;
  tokenId: string;
  operation: 'mint' | 'transfer';
  fromAccount?: string;
  toAccount?: string;
  amount?: { amount: string; unit: string };
  participants?: { accountId: string; role: 'sender' | 'receiver' }[];
  stateBefore?: StateReference;
  stateAfter: StateReference;
  timestamp: string;
}
export interface TransactionLog {
  '@type': 'TransactionLog';
  txId: string;
  initiator: string;
  tokenTransactions: { tokenTxId: string; tokenId: string; operation: string }[];
  status: 'completed';
  timestamps: { submitted: string; started: string; completed: string; finalized: string };
  proofId: string;
  proofProfile: 'merkle';
  ledgerAnchors: { chain: string; network: string; txHash: string; timestamp: string }[];
}
export interface ProofPathNode {
  hash: string;
  direction: 'left' | 'right';
}
export interface ProofDetails {
  txId: string;
  leafHash: string;
  merkleRoot: string;
  proofPath: ProofPathNode[];
  leafIndex: number;
  proofStatus: 'proven';
  verification: { algorithm: 'sha256' };
}

// ---- storage (in-memory; STAND-IN) ----
const txLogs = new Map<string, TransactionLog>(); // txId -> TransactionLog
const tokenTxById = new Map<string, TokenTransaction>(); // tokenTxId -> TokenTransaction
const historyByToken = new Map<string, string[]>(); // tokenId -> [tokenTxId] (chronological)
const leaves: { txId: string; leafHash: string }[] = []; // one Merkle leaf per business transaction

// ---- hashing helpers ----
// Stable JSON so the same logical object always hashes to the same string.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
// Combine two hex hashes into their parent hash (order matters → left then right).
function hashPair(left: string, right: string): string {
  return sha256Hex(left + right);
}

// ---- state-commitment chain ----
// The new commitment folds in the previous one, so the per-token history is tamper-evident.
function nextCommitment(input: {
  previousCommitment: string;
  txId: string;
  tokenId: string;
  ownerDid: string;
  timestamp: string;
}): string {
  return sha256Hex(canonical(input));
}

function addLeaf(txId: string, leafData: unknown): { leafHash: string; leafIndex: number } {
  const leafHash = sha256Hex(canonical(leafData));
  const leafIndex = leaves.length;
  leaves.push({ txId, leafHash });
  return { leafHash, leafIndex };
}

function anchorNow(): { chain: string; network: string; txHash: string; timestamp: string } {
  // STAND-IN: a real ledger anchors the Merkle root in a public chain tx. We fabricate a
  // plausible anchor record so the shape is exercised; the txHash is not a real chain tx.
  return {
    chain: 'wayfinder-standin',
    network: 'devnet',
    txHash: `0x${sha256Hex(`anchor-${randomUUID()}`)}`,
    timestamp: new Date().toISOString(),
  };
}

function buildLog(txId: string, initiator: string, tokenTx: TokenTransaction): TransactionLog {
  const now = new Date().toISOString();
  const log: TransactionLog = {
    '@type': 'TransactionLog',
    txId,
    initiator,
    tokenTransactions: [{ tokenTxId: tokenTx.tokenTxId, tokenId: tokenTx.tokenId, operation: tokenTx.operation }],
    status: 'completed',
    timestamps: { submitted: now, started: now, completed: now, finalized: now },
    proofId: `urn:uuid:proof-${randomUUID()}`,
    proofProfile: 'merkle',
    ledgerAnchors: [anchorNow()],
  };
  txLogs.set(txId, log);
  tokenTxById.set(tokenTx.tokenTxId, tokenTx);
  const hist = historyByToken.get(tokenTx.tokenId) ?? [];
  hist.push(tokenTx.tokenTxId);
  historyByToken.set(tokenTx.tokenId, hist);
  return log;
}

// ---- public API ----

/** Record the genesis (mint) transaction for a token and return its opening state commitment. */
export function recordMint(input: { tokenId: string; ownerDid: string }): {
  txId: string;
  stateCommitment: string;
} {
  const txId = randomUUID();
  const now = new Date().toISOString();
  const stateCommitment = nextCommitment({
    previousCommitment: '', // genesis: no prior state
    txId,
    tokenId: input.tokenId,
    ownerDid: input.ownerDid,
    timestamp: now,
  });
  const tokenTx: TokenTransaction = {
    '@type': 'TokenTransaction',
    tokenTxId: `urn:uuid:tokentx-${randomUUID()}`,
    txId: `urn:uuid:tx-${txId}`,
    tokenId: input.tokenId,
    operation: 'mint',
    toAccount: input.ownerDid,
    participants: [{ accountId: input.ownerDid, role: 'receiver' }],
    stateAfter: { stateCommitment, stateVersion: 1 },
    timestamp: now,
  };
  buildLog(`urn:uuid:tx-${txId}`, input.ownerDid, tokenTx);
  addLeaf(`urn:uuid:tx-${txId}`, {
    txId: `urn:uuid:tx-${txId}`,
    operation: 'mint',
    tokenId: input.tokenId,
    stateAfter: stateCommitment,
    timestamp: now,
  });
  return { txId: `urn:uuid:tx-${txId}`, stateCommitment };
}

/** Record a transfer: chain a new state commitment from the previous one. */
export function recordTransfer(input: {
  tokenId: string;
  fromDid: string;
  toDid: string;
  previousCommitment: string;
}): { txId: string; stateCommitment: string } {
  const txId = randomUUID();
  const now = new Date().toISOString();
  const stateCommitment = nextCommitment({
    previousCommitment: input.previousCommitment,
    txId,
    tokenId: input.tokenId,
    ownerDid: input.toDid,
    timestamp: now,
  });
  const fullTxId = `urn:uuid:tx-${txId}`;
  const tokenTx: TokenTransaction = {
    '@type': 'TokenTransaction',
    tokenTxId: `urn:uuid:tokentx-${randomUUID()}`,
    txId: fullTxId,
    tokenId: input.tokenId,
    operation: 'transfer',
    fromAccount: input.fromDid,
    toAccount: input.toDid,
    amount: { amount: '1', unit: 'token' },
    participants: [
      { accountId: input.fromDid, role: 'sender' },
      { accountId: input.toDid, role: 'receiver' },
    ],
    stateBefore: { stateCommitment: input.previousCommitment },
    stateAfter: { stateCommitment, previousCommitment: input.previousCommitment, lastTxId: fullTxId, stateVersion: 2 },
    timestamp: now,
  };
  buildLog(fullTxId, input.fromDid, tokenTx);
  addLeaf(fullTxId, {
    txId: fullTxId,
    operation: 'transfer',
    tokenId: input.tokenId,
    stateBefore: input.previousCommitment,
    stateAfter: stateCommitment,
    timestamp: now,
  });
  return { txId: fullTxId, stateCommitment };
}

export function getTransaction(txId: string): TransactionLog | undefined {
  return txLogs.get(txId);
}

export function tokenTransactions(tokenId: string): TokenTransaction[] {
  return (historyByToken.get(tokenId) ?? [])
    .map((id) => tokenTxById.get(id))
    .filter((t): t is TokenTransaction => Boolean(t));
}

// ---- Merkle proof ----
// Build every tree level from the current leaves (duplicating the last node on odd counts),
// then read off the sibling at each level to form the inclusion path.
function merkleLevels(hashes: string[]): string[][] {
  if (hashes.length === 0) return [['']];
  const levels: string[][] = [hashes];
  let cur = hashes;
  while (cur.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i]!;
      const right = i + 1 < cur.length ? cur[i + 1]! : cur[i]!; // duplicate last if odd
      next.push(hashPair(left, right));
    }
    levels.push(next);
    cur = next;
  }
  return levels;
}

/** Merkle inclusion proof for a business transaction, relative to the current ledger tree. */
export function getProof(txId: string): ProofDetails | undefined {
  const leafIndex = leaves.findIndex((l) => l.txId === txId);
  if (leafIndex < 0) return undefined;
  const levels = merkleLevels(leaves.map((l) => l.leafHash));
  const proofPath: ProofPathNode[] = [];
  let idx = leafIndex;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l]!;
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = sibIdx < level.length ? level[sibIdx]! : level[idx]!; // duplicated sibling
    proofPath.push({ hash: sibling, direction: isRight ? 'left' : 'right' });
    idx = Math.floor(idx / 2);
  }
  return {
    txId,
    leafHash: leaves[leafIndex]!.leafHash,
    merkleRoot: levels[levels.length - 1]![0]!,
    proofPath,
    leafIndex,
    proofStatus: 'proven',
    verification: { algorithm: 'sha256' },
  };
}
