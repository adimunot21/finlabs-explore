import { useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './lib/client.js';
import { sha256Hex, verifyHashHex, publicKeyFromMultibase } from './lib/crypto.js';
import type { AccountProfile, AccountKeyInfo, EntityType } from './lib/types.js';

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
          Phase 3 · <strong>Identity &amp; Keys</strong> — create a real Finternet account, then sign and
          verify a message. Everything here runs against the real spec shapes
          (<code>specs-vendor/api</code>) with genuine Ed25519 / <code>did:key</code> cryptography.
        </p>
      </header>

      {!session ? (
        <CreateAccount onReady={setSession} />
      ) : (
        <>
          <Identity session={session} />
          <SignAndVerify session={session} />
          <button className="ghost" onClick={() => setSession(null)}>
            ← Start over with a new account
          </button>
        </>
      )}

      <footer>
        <span>
          A DID is a public key you control · a signature proves who authorized what · verifying needs only
          the public key.
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <span className="row-value">{children}</span>
    </div>
  );
}
