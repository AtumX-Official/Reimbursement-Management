import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { ReceiptIndianRupee } from 'lucide-react';
import { auth, googleProvider } from '@/firebase';
import Home from '@/Home';
import { isAllowed } from '@/roles';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function Login({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: () => void }) {
  return (
    <main className="hero-gradient relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="card relative w-full max-w-sm text-center shadow-2xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 text-white shadow-glow">
          <ReceiptIndianRupee className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          <span className="text-brand-600">AtumX</span> Reimbursement
        </h1>
        <p className="mt-2 text-sm text-ink-600">Sign in with your Google account</p>
        <button
          onClick={onLogin}
          disabled={busy}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-800 shadow-sm transition hover:bg-ink-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loggingIn = useRef(false);

  // Any session without a verified email is signed out.
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u && !isAllowed(u)) {
          setUser(null);
          if (!loggingIn.current) signOut(auth);
          return;
        }
        setUser(u);
      }),
    [],
  );

  const login = async () => {
    setBusy(true);
    setError('');
    loggingIn.current = true;
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (!isAllowed(cred.user)) {
        await cred.user.delete().catch(() => signOut(auth));
        throw new Error(`This Google account (${cred.user.email}) has no verified email.`);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      loggingIn.current = false;
      setBusy(false);
    }
  };

  if (user === undefined) return null;
  return user && !busy ? <Home user={user} /> : <Login busy={busy} error={error} onLogin={login} />;
}
