import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './lib/client.js';
import {
  sha256Hex,
  verifyHashHex,
  publicKeyFromMultibase,
  foldMerkleProof,
  verifyEmbeddedCredential,
} from './lib/crypto.js';
import type {
  AccountProfile,
  AccountKeyInfo,
  EntityType,
  CredentialToken,
  VerificationResult,
  TokenClass,
  TokenInstance,
  ProofDetails,
  TransactionLog,
} from './lib/types.js';

interface Session {
  token: string;
  profile: AccountProfile;
  key: AccountKeyInfo;
}

// The five milestones of the lifecycle, tracked so the progress rail can light up as you go.
type Stage = 'credential' | 'token' | 'transfer' | 'proof';
type Journey = Record<Stage, boolean>;
const EMPTY_JOURNEY: Journey = { credential: false, token: false, transfer: false, proof: false };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [journey, setJourney] = useState<Journey>(EMPTY_JOURNEY);
  // The id of the most recently minted token. Lives here, not in <Tokens>, because <Transfer> is a
  // sibling: it needs to know that the wallet changed so it can re-ask the server what we now own.
  const [mintedId, setMintedId] = useState<string | null>(null);

  // Stable, no-op-on-unchanged updater so child effects can report milestones without looping.
  const mark = useCallback((stage: Stage, value: boolean) => {
    setJourney((j) => (j[stage] === value ? j : { ...j, [stage]: value }));
  }, []);

  function reset() {
    setSession(null);
    setJourney(EMPTY_JOURNEY);
    setMintedId(null);
  }

  return (
    <div className="page">
      <Hero />
      {session && <ProgressRail session={session} journey={journey} />}

      {!session ? (
        <>
          <TheStory />
          <CreateAccount onReady={setSession} />
        </>
      ) : (
        <>
          <SessionBar session={session} onReset={reset} />
          <TheStory collapsed />
          <Identity session={session} />
          <SignAndVerify session={session} />
          <Credentials session={session} onStage={mark} />
          <Tokens session={session} onStage={mark} onMinted={setMintedId} />
          <Transfer session={session} onStage={mark} mintedId={mintedId} />
          {journey.transfer && <Done journey={journey} />}
          <button className="ghost" onClick={reset}>
            ← Start over with a new account
          </button>
        </>
      )}

      <footer>
        <span>
          A DID is a public key you control · a signature proves who authorized what · a credential is a
          signed claim about you · a token is an asset that carries its own rules · a proof lets anyone verify
          a transfer happened — with only hashes, trusting no one.
        </span>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <header>
      <h1>Wayfinder</h1>
      <p className="sub">
        A hands-on tour of <strong>Finternet</strong> — a proposed “network of networks” for money and assets.
        In about two minutes you'll walk the full lifecycle: become your own identity, earn a credential, mint
        an asset that <em>refuses to exist unless you're compliant</em>, move it, and verify the whole thing
        yourself with nothing but math. Real Ed25519 / <code>did:key</code> keys and real SHA-256 proof chains;
        every message is validated against Finternet Labs' own published schemas.
      </p>
    </header>
  );
}

// Zero-context framing: what problem Finternet is attacking. Shown open on the landing screen, and
// kept one click away afterwards (`collapsed`) — the "why" is most needed once you're mid-lifecycle.
function TheStory({ collapsed = false }: { collapsed?: boolean }) {
  const body = (
    <>
      <p className="hint">
        Today your money is a row in your bank's private database. It can't move to another institution's
        ledger without intermediaries reconciling it, because the asset has no existence of its own. Finternet's
        bet: make each asset a <strong>self-describing object</strong> that carries its own identity, rules, and
        history — so any ledger can hold it, compliance is enforced at the moment of creation, and anyone can
        verify what happened without trusting a middleman.
      </p>
      <p className="hint">
        The eight steps below are <strong>one lifecycle</strong>, not eight demos:{' '}
        <strong>identity → credential → token → transfer → proof</strong>. Each step's output is the next
        step's input — your key signs the credential request, the credential unlocks the mint, the token is
        what moves, and the transfer is what you prove.
      </p>
    </>
  );

  if (!collapsed) {
    return (
      <section className="card story">
        <h2>Why any of this?</h2>
        {body}
        <p className="hint">
          You'll build that stack from the bottom up, one real piece at a time. Start by creating your identity.
        </p>
      </section>
    );
  }

  return (
    <details className="card story">
      <summary>Why any of this? — the problem Finternet is attacking</summary>
      {body}
    </details>
  );
}

const STAGES: { key: 'account' | Stage; label: string; blurb: string }[] = [
  { key: 'account', label: 'Identity', blurb: 'a key pair you control' },
  { key: 'credential', label: 'Credential', blurb: 'a signed claim about you' },
  { key: 'token', label: 'Token', blurb: 'a compliant asset' },
  { key: 'transfer', label: 'Transfer', blurb: 'move it on the ledger' },
  { key: 'proof', label: 'Proof', blurb: 'verify it yourself' },
];

function ProgressRail({ session, journey }: { session: Session; journey: Journey }) {
  const done = (k: 'account' | Stage) => (k === 'account' ? Boolean(session) : journey[k]);
  return (
    <nav className="rail" aria-label="Lifecycle progress">
      {STAGES.map((s, i) => (
        <div key={s.key} className={`rail-step ${done(s.key) ? 'done' : ''}`}>
          <span className="rail-dot">{done(s.key) ? '✓' : i + 1}</span>
          <span className="rail-text">
            <strong>{s.label}</strong>
            <em>{s.blurb}</em>
          </span>
        </div>
      ))}
    </nav>
  );
}

function SessionBar({ session, onReset }: { session: Session; onReset: () => void }) {
  const { profile } = session;
  const short = `${profile.did.slice(0, 22)}…${profile.did.slice(-6)}`;
  return (
    <div className="sessionbar">
      <span>
        Signed in as <strong>{profile.address}</strong> · <span className="mono">{short}</span>
      </span>
      <button className="ghost small" onClick={onReset}>
        Start over
      </button>
    </div>
  );
}

function Done({ journey }: { journey: Journey }) {
  return (
    <section className="card done">
      <h2>That's the whole Finternet lifecycle 🎉</h2>
      <p className="hint">In a couple of minutes, with real cryptography at every step, you just:</p>
      <ul className="done-list">
        <li>became your own <strong>identity</strong> — a <code>did:key</code> that is literally your public key;</li>
        <li>received a <strong>verifiable credential</strong> anyone can check, and an issuer can revoke;</li>
        <li>minted a <strong>token</strong> that the ledger refused to create until you were compliant;</li>
        <li>
          <strong>transferred</strong> it, chaining a tamper-evident state commitment;
        </li>
        <li>
          and {journey.proof ? 'verified' : 'can verify'} the <strong>Merkle proof</strong> of that transfer in
          your own browser — trusting no one.
        </li>
      </ul>
      <p className="hint">
        That's Finternet's claim in miniature: assets that carry their own rules and history, so value can move
        across ledgers with compliance built in and trust replaced by proof.
      </p>
    </section>
  );
}

function CreateAccount({ onReady }: { onReady: (s: Session) => void }) {
  const [address, setAddress] = useState('alice');
  const [name, setName] = useState('Alice Example');
  const [entityType, setEntityType] = useState<EntityType>('PERSONAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { available } = await api.checkAvailability(address);
      if (!available) throw new Error(`Address "${address}" is already taken — pick another.`);
      const { accessToken } = await api.createAccount({ address, name, entityType });
      const [profile, keys] = await Promise.all([api.getAccount(accessToken), api.searchKeys(accessToken)]);
      const key = keys.keys[0];
      if (!key) throw new Error('Account created but no key was returned.');
      onReady({ token: accessToken, profile, key });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>1 · Create your account</h2>
      <p className="hint">
        Choosing an address generates an Ed25519 key pair for you. Your <em>DID</em> will literally be your
        public key — no central registrar issues it.
      </p>
      <div className="form">
        <label>
          Address (username)
          <input value={address} onChange={(e) => setAddress(e.target.value.toLowerCase())} placeholder="alice" />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice Example" />
        </label>
        <label>
          Type
          <select value={entityType} onChange={(e) => setEntityType(e.target.value as EntityType)}>
            <option value="PERSONAL">PERSONAL</option>
            <option value="BUSINESS">BUSINESS</option>
          </select>
        </label>
      </div>
      <button onClick={create} disabled={busy || !address || !name}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Identity({ session }: { session: Session }) {
  const { profile, key } = session;
  return (
    <section className="card">
      <h2>2 · Your identity</h2>
      <p className="hint">
        The <code>did:key</code> below and the public key are the same 32 bytes, encoded two ways — the DID{' '}
        <em>is</em> the public key.
      </p>
      <Row label="Address">
        <span className="mono">{profile.address}</span>
      </Row>
      <Row label="DID">
        <span className="mono break">{profile.did}</span>
      </Row>
      <Row label="Public key">
        <span className="mono break">{key.publicKeyMultibase}</span>
        <span className="tag">{key.keyType}</span>
      </Row>
    </section>
  );
}

function SignAndVerify({ session }: { session: Session }) {
  const { key } = session;
  const [message, setMessage] = useState('Transfer 100 USDC to bob');
  const [signature, setSignature] = useState<string | null>(null);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);
  const [verifyText, setVerifyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = useMemo(() => publicKeyFromMultibase(key.publicKeyMultibase), [key.publicKeyMultibase]);

  // Live verification: re-check whenever the "message to verify" or signature changes.
  const verdict = useMemo(() => {
    if (!signature) return null;
    return verifyHashHex(publicKey, sha256Hex(verifyText), signature);
  }, [signature, verifyText, publicKey]);

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const hash = sha256Hex(message);
      const { signature: sig } = await api.sign(key.keyId, hash);
      setSignature(sig);
      setSignedMessage(message);
      setVerifyText(message); // start the verify box with the exact signed message
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>3 · Sign a message</h2>
      <p className="hint">
        The message is hashed (SHA-256) and signed with your <em>private</em> key by the custodial signer.
        The server never hands out your private key — it only returns the signature.
      </p>
      <label className="block">
        Message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
      </label>
      <button onClick={sign} disabled={busy || !message}>
        {busy ? 'Signing…' : 'Sign message'}
      </button>
      {error && <p className="error">{error}</p>}

      {signature && (
        <>
          <Row label="Signature">
            <span className="mono break">{signature}</span>
          </Row>

          <h2 style={{ marginTop: '1.5rem' }}>4 · Verify</h2>
          <p className="hint">
            Verification happens right here in the browser using only your <em>public</em> key. Edit the text
            below — change one character — and watch the signature stop matching. That's tamper-detection.
          </p>
          <label className="block">
            Message to verify (was: <span className="mono">{signedMessage}</span>)
            <textarea value={verifyText} onChange={(e) => setVerifyText(e.target.value)} rows={2} />
          </label>
          <div className={`verdict ${verdict ? 'ok' : 'bad'}`}>
            {verdict ? '✓ Signature valid — this is exactly what was signed.' : '✗ Invalid — the message does not match the signature.'}
          </div>
        </>
      )}
    </section>
  );
}

function Credentials({ session, onStage }: { session: Session; onStage: (s: Stage, v: boolean) => void }) {
  const { profile } = session;
  const [issuer, setIssuer] = useState<{ did: string; name: string } | null>(null);
  const [credential, setCredential] = useState<CredentialToken | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<null | 'issue' | 'verify' | 'revoke'>(null);
  const [error, setError] = useState<string | null>(null);

  // Who would be attesting to us? Fetch the stand-in trust provider once.
  useEffect(() => {
    api.getIssuer().then(setIssuer).catch(() => setIssuer(null));
  }, []);

  // Report to the progress rail: the credential milestone is "held AND currently valid".
  useEffect(() => {
    onStage('credential', result?.valid ?? false);
  }, [result, onStage]);

  function run<T>(kind: 'issue' | 'verify' | 'revoke', fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(kind);
    setError(null);
    return fn()
      .catch((e) => {
        setError(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
        return undefined;
      })
      .finally(() => setBusy(null));
  }

  async function issue() {
    const out = await run('issue', () =>
      api.issueCredential({
        holderDid: profile.did,
        subject: { fullName: profile.name, verificationLevel: 'enhanced' },
      }),
    );
    if (!out) return;
    setCredential(out.credential);
    // Immediately verify what we were handed, so the "green" is the server's real verdict.
    const v = await run('verify', () => api.verifyCredential(out.credential));
    if (v) setResult(v);
  }

  async function reverify() {
    if (!credential) return;
    const v = await run('verify', () => api.verifyCredential(credential));
    if (v) setResult(v);
  }

  async function revoke() {
    if (!credential) return;
    const ok = await run('revoke', () => api.revokeCredential(credential.id));
    if (!ok) return;
    await reverify(); // same credential, but now the issuer's status list says "revoked"
  }

  const vc = credential?.claims[0];

  return (
    <section className="card">
      <h2>5 · Get a verifiable credential</h2>
      <p className="hint">
        A <em>trust provider</em> (here, a stand-in KYC issuer with its own <code>did:key</code>) signs a
        claim <em>about you</em> — bound to your DID. Anyone can verify it with the issuer's public key. The
        issuer can also <em>revoke</em> it, and verification then fails even though the signature is still
        mathematically valid.
      </p>
      {issuer && (
        <Row label="Issuer">
          <span className="mono break">{issuer.did}</span>
          <span className="tag">{issuer.name}</span>
        </Row>
      )}

      {!credential ? (
        <button onClick={issue} disabled={busy !== null}>
          {busy === 'issue' ? 'Issuing…' : 'Request KYC credential'}
        </button>
      ) : (
        <>
          <Row label="Credential">
            <span className="mono break">{credential.id}</span>
            <span className="tag">{String(credential.metadata.name ?? credential['@type'])}</span>
          </Row>
          <Row label="Subject (you)">
            <span className="mono break">{String(vc?.credentialSubject.id ?? profile.did)}</span>
          </Row>
          <Row label="Proof">
            <span className="mono">{vc?.proof?.type ?? '—'}</span>
          </Row>

          {result && (
            <>
              <div className="checks">
                <Check ok={result.checks.schemaValid} label="Schema valid" />
                <Check ok={result.checks.signatureValid} label="Issuer signature" />
                <Check ok={result.checks.notRevoked} label="Not revoked" />
                <Check ok={result.checks.notExpired} label="Not expired" />
              </div>
              <div className={`verdict ${result.valid ? 'ok' : 'bad'}`}>
                {result.valid
                  ? '✓ Credential valid — the issuer really attested this, unaltered and unrevoked.'
                  : `✗ Invalid — ${result.reason ?? 'verification failed.'}`}
              </div>
            </>
          )}

          <div className="btn-row">
            <button className="ghost" onClick={reverify} disabled={busy !== null}>
              {busy === 'verify' ? 'Verifying…' : 'Re-verify'}
            </button>
            {result?.checks.notRevoked && (
              <button className="danger" onClick={revoke} disabled={busy !== null}>
                {busy === 'revoke' ? 'Revoking…' : 'Revoke (as the issuer)'}
              </button>
            )}
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Tokens({
  session,
  onStage,
  onMinted,
}: {
  session: Session;
  onStage: (s: Stage, v: boolean) => void;
  onMinted: (tokenId: string) => void;
}) {
  const { token, profile } = session;
  const [tokenClass, setTokenClass] = useState<TokenClass | null>(null);
  const [minted, setMinted] = useState<TokenInstance | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null); // compliance-hook refusal
  const [error, setError] = useState<string | null>(null);

  // What are we minting, and does it require KYC? Fetch the class once.
  useEffect(() => {
    api.getTokenClass('PROP-DEED').then(setTokenClass).catch(() => setTokenClass(null));
  }, []);

  // Report to the progress rail whenever a token is (or isn't) held.
  useEffect(() => {
    onStage('token', Boolean(minted));
  }, [minted, onStage]);

  async function mint() {
    setBusy(true);
    setBlocked(null);
    setError(null);
    try {
      const accepted = await api.mintToken(token, {
        tokenClass: 'PROP-DEED',
        initialSupply: '1',
        metadata: { name: 'Deed to 123 Main St' },
        data: { assetId: 'PROP-2026-001', propertyAddress: '123 Main St' },
      });
      const tok = await api.getToken(token, accepted.tokenId);
      setMinted(tok);
      onMinted(tok.id); // tells <Transfer> the wallet changed, so it re-queries what we own
    } catch (e) {
      if (e instanceof ApiError && e.code === 'COMPLIANCE_CHECK_FAILED') {
        // This is the whole point of the phase: the mint was refused *at creation*. Note we do NOT
        // touch `mintedId`: a refusal creates nothing, so the wallet — and any transfer already
        // proved below — is untouched.
        setMinted(null);
        setBlocked(e.message);
      } else {
        setError(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  const owner = minted?.identities.find((i) => i.type === 'owner')?.id;

  // The credential that authorized the mint, carried inside the token. We verify the issuer's
  // signature over it right here — no call to the issuer, no trust in the server.
  const carriedClaim = minted?.claims?.[0];
  const carriedClaimValid = useMemo(
    () => (carriedClaim ? verifyEmbeddedCredential(carriedClaim) : null),
    [carriedClaim],
  );

  return (
    <section className="card">
      <h2>6 · Mint a token (with a compliance hook)</h2>
      <p className="hint">
        A token is an asset represented as a self-describing object (the UNITS 5-section model:
        metadata · data · claims · identities · state). This token class is <em>KYC-gated</em>: the token
        manager <strong>refuses to mint</strong> unless you currently hold a valid credential from step 5 —
        the paper's “regulation at the flow level.” Revoke your credential above and minting stops working.
        And when it succeeds, the credential that authorized it is <strong>embedded into the token's
        claims</strong>, so the asset carries the proof of its own compliance wherever it goes.
      </p>
      {tokenClass && (
        <>
          <Row label="Token class">
            <span className="mono">{tokenClass.tokenClass}</span>
            <span className="tag">{tokenClass.tokenStandard}</span>
            {tokenClass.metadata.requiresKYC && <span className="tag warn">requires KYC</span>}
          </Row>
          <Row label="Name">
            <span>{tokenClass.name}</span>
          </Row>
        </>
      )}

      <button onClick={mint} disabled={busy}>
        {busy ? 'Minting…' : minted ? 'Mint another' : 'Mint property deed'}
      </button>

      {blocked && (
        <div className="verdict bad" style={{ marginTop: '1rem' }}>
          ✗ Mint refused at creation — {blocked}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {minted && (
        <>
          <div className="verdict ok" style={{ marginTop: '1rem' }}>
            ✓ Token minted — a compliant asset now exists on the ledger.
          </div>
          <Row label="Token id">
            <span className="mono break">{minted.id}</span>
          </Row>
          <Row label="Class / std">
            <span className="mono">{minted.metadata.tokenClass}</span>
            <span className="tag">{minted.metadata.fungibility}</span>
          </Row>
          <Row label="Owner (you)">
            <span className="mono break">{owner ?? profile.did}</span>
          </Row>
          <Row label="State">
            <span className="mono">{minted.state.status}</span>
            <span className="tag">supply {minted.state.supply?.totalSupply ?? '—'}</span>
          </Row>

          {carriedClaim && (
            <>
              <Row label="Carries">
                <span className="mono break">{carriedClaim.id}</span>
                <span className="tag">embedded credential</span>
              </Row>
              <Row label="Attested by">
                <span className="mono break">{carriedClaim.issuer}</span>
              </Row>
              <div className={`verdict ${carriedClaimValid ? 'ok' : 'bad'}`}>
                {carriedClaimValid
                  ? '✓ The token carries the very credential that authorized it — and your browser just verified the issuer’s signature on it, without contacting the issuer.'
                  : '✗ The embedded credential’s signature does not verify.'}
              </div>
              <p className="hint" style={{ marginTop: '0.6rem' }}>
                This is the paper’s <em>trusted proof chain</em>: the token is self-sufficient, so whoever
                receives it can check its compliance offline. (Honest caveat: this proves the issuer{' '}
                <em>did</em> attest it, unaltered — it can’t prove the credential hasn’t since been{' '}
                <em>revoked</em>. Freshness still needs the issuer’s status list.)
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Transfer({
  session,
  onStage,
  mintedId,
}: {
  session: Session;
  onStage: (s: Stage, v: boolean) => void;
  mintedId: string | null;
}) {
  const { token } = session;
  const [held, setHeld] = useState<TokenInstance | null>(null);
  const [recipient, setRecipient] = useState('bob');
  const [newOwner, setNewOwner] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofDetails | null>(null);
  const [log, setLog] = useState<TransactionLog | null>(null);
  const [tampered, setTampered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask the *server* what we own rather than trusting the mint response — same question a real
  // wallet asks, and it stays honest after the token leaves us. Prefer the token just minted, since
  // an account may hold several.
  const refreshHeld = useCallback(async () => {
    try {
      const { tokens } = await api.searchTokens(token);
      setHeld(tokens.find((t) => t.id === mintedId) ?? tokens[0] ?? null);
    } catch {
      setHeld(null);
    }
  }, [token, mintedId]);

  // Re-run on every mint: at mount the wallet is necessarily empty, so a mount-only fetch would
  // leave this step permanently showing "no token". A new mint also retires the previous transfer's
  // proof, so steps 7-8 restart cleanly for the new token.
  useEffect(() => {
    setProof(null);
    setLog(null);
    setNewOwner(null);
    setTampered(false);
    setError(null);
    void refreshHeld();
  }, [refreshHeld]);

  // Browser-side proof check: re-fold leaf→root. Flip one nibble of the leaf to see it break.
  const verdict = useMemo(() => {
    if (!proof) return null;
    const leaf = tampered ? (proof.leafHash.startsWith('0') ? 'f' : '0') + proof.leafHash.slice(1) : proof.leafHash;
    return foldMerkleProof(leaf, proof.proofPath) === proof.merkleRoot;
  }, [proof, tampered]);

  // Report milestones: the transfer happened once a proof exists; the proof stage is the
  // browser's own verdict (so toggling "tamper" un-lights it — verification really is live).
  useEffect(() => {
    onStage('transfer', Boolean(proof));
  }, [proof, onStage]);
  useEffect(() => {
    onStage('proof', verdict === true);
  }, [verdict, onStage]);

  async function transfer() {
    if (!held) {
      setError('Mint a token in step 6 first — there is nothing to transfer.');
      return;
    }
    setBusy(true);
    setError(null);
    setTampered(false);
    try {
      // Make sure the recipient exists as an account (throwaway, for the demo).
      const { available } = await api.checkAvailability(recipient);
      if (available) await api.createAccount({ address: recipient, name: recipient, entityType: 'PERSONAL' });

      const accepted = await api.transfer(token, held.id, recipient);
      // Fetch the ledger's proof + transaction log, and the token's new owner.
      const [pf, tl, moved] = await Promise.all([
        api.getProof(token, accepted.txId),
        api.getTransaction(token, accepted.txId),
        api.getToken(token, held.id),
      ]);
      setProof(pf);
      setLog(tl);
      setNewOwner(moved.identities.find((i) => i.type === 'owner')?.id ?? null);
      await refreshHeld(); // token has left our wallet now
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>7 · Transfer it — with a verifiable proof</h2>
      <p className="hint">
        Moving the token writes a <em>transaction</em> to the unified ledger and chains a new{' '}
        <em>state commitment</em> (a SHA-256 hash that folds in the previous one — tamper-evident history).
        The ledger returns a <em>Merkle proof</em> of inclusion, which the browser re-checks below using only
        hashes — no trust in the server. This is what UILP carries between ledgers.
      </p>

      {!held && !proof && <p className="hint">No token in this wallet yet — mint one in step 6.</p>}

      {held && !proof && (
        <>
          <Row label="Moving">
            <span className="mono break">{held.id}</span>
            <span className="tag">{held.metadata.tokenClass}</span>
          </Row>
          <label className="block">
            Recipient address
            <input value={recipient} onChange={(e) => setRecipient(e.target.value.toLowerCase())} placeholder="bob" />
          </label>
          <button onClick={transfer} disabled={busy || !recipient}>
            {busy ? 'Transferring…' : 'Transfer token'}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}

      {proof && (
        <>
          <div className="verdict ok">✓ Transfer recorded on the ledger.</div>
          <Row label="New owner">
            <span className="mono break">{newOwner}</span>
          </Row>
          {log && (
            <Row label="Transaction">
              <span className="mono break">{log.txId}</span>
              <span className="tag">{log.proofProfile}</span>
              <span className="tag">{log.status}</span>
            </Row>
          )}

          <h2 style={{ marginTop: '1.5rem' }}>8 · Verify the proof (in your browser)</h2>
          <p className="hint">
            The proof is a leaf hash plus {proof.proofPath.length} sibling hash
            {proof.proofPath.length === 1 ? '' : 'es'}. We re-fold leaf → root and compare to the ledger's
            published <code>merkleRoot</code>. Toggle “tamper” to change one nibble of the leaf and watch it
            stop matching.
          </p>
          <Row label="Leaf hash">
            <span className="mono break">{proof.leafHash}</span>
          </Row>
          <Row label="Merkle root">
            <span className="mono break">{proof.merkleRoot}</span>
          </Row>
          <label style={{ flexDirection: 'row', gap: '0.5rem', alignItems: 'center', margin: '0.5rem 0' }}>
            <input type="checkbox" checked={tampered} onChange={(e) => setTampered(e.target.checked)} style={{ width: 'auto' }} />
            Tamper with the leaf hash
          </label>
          <div className={`verdict ${verdict ? 'ok' : 'bad'}`}>
            {verdict
              ? '✓ Proof valid — this transaction is provably included under the ledger root.'
              : '✗ Invalid — the folded root does not match; this leaf is not in the tree.'}
          </div>
        </>
      )}
    </section>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`check ${ok ? 'ok' : 'bad'}`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{children}</span>
    </div>
  );
}
