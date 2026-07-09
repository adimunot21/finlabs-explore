import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './lib/client.js';
import { sha256Hex, verifyHashHex, publicKeyFromMultibase } from './lib/crypto.js';
import type {
  AccountProfile,
  AccountKeyInfo,
  EntityType,
  CredentialToken,
  VerificationResult,
} from './lib/types.js';

interface Session {
  token: string;
  profile: AccountProfile;
  key: AccountKeyInfo;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  return (
    <div className="page">
      <header>
        <h1>Wayfinder</h1>
        <p className="sub">
          Phase 3 · <strong>Identity &amp; Keys</strong> and Phase 4 · <strong>Trust &amp; Credentials</strong> —
          create a real Finternet account, sign and verify a message, then have a trust provider issue you a
          verifiable credential and watch verification fail once it's revoked. Real Ed25519 /{' '}
          <code>did:key</code> cryptography; credential data validated against the vendored{' '}
          <code>credential.schema.json</code>.
        </p>
      </header>

      {!session ? (
        <CreateAccount onReady={setSession} />
      ) : (
        <>
          <Identity session={session} />
          <SignAndVerify session={session} />
          <Credentials session={session} />
          <button className="ghost" onClick={() => setSession(null)}>
            ← Start over with a new account
          </button>
        </>
      )}

      <footer>
        <span>
          A DID is a public key you control · a signature proves who authorized what · a credential is a
          signed claim about you that anyone can verify — and an issuer can revoke.
        </span>
      </footer>
    </div>
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

function Credentials({ session }: { session: Session }) {
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
