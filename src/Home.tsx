import { useEffect, useState } from 'react';
import { signOut, type User } from 'firebase/auth';
import { BarChart3, FilePlus2, Landmark, LogOut, ReceiptIndianRupee, ReceiptText, Wallet } from 'lucide-react';
import { auth } from '@/firebase';
import { isAdmin } from '@/roles';
import { watchAllClaims, watchMyClaims, type Claim } from '@/claims';
import ClaimForm from '@/ClaimForm';
import ClaimsPage from '@/ClaimsPage';
import SummaryPage from '@/SummaryPage';
import { watchBank, type BankDetails } from '@/bank';
import { BankForm, BankSummary } from '@/BankForm';
import { Modal } from '@/ui';

// Remembers that a member chose "Later" on the first-login bank prompt, so it is not shown again.
const laterKey = (uid: string) => `atumx-reimb-bank-later-${uid}`;
const saidLater = (uid: string) => {
  try {
    return localStorage.getItem(laterKey(uid)) === '1';
  } catch {
    return false;
  }
};
const rememberLater = (uid: string) => {
  try {
    localStorage.setItem(laterKey(uid), '1');
  } catch {
    /* storage unavailable: the prompt just shows again next time */
  }
};

type View = 'claims' | 'summary' | 'mine' | 'new';

// The admin reviews, approves and pays claims; everyone else files claims and tracks their own.
const viewsFor = (admin: boolean) =>
  admin
    ? [
        { key: 'claims' as View, label: 'Claims', desc: 'Review, approve & pay', icon: ReceiptText },
        { key: 'summary' as View, label: 'Summary', desc: 'Totals by member', icon: BarChart3 },
      ]
    : [
        { key: 'mine' as View, label: 'My claims', desc: 'Track status & payouts', icon: Wallet },
        { key: 'new' as View, label: 'New claim', desc: 'Submit an expense', icon: FilePlus2 },
      ];

export default function Home({ user }: { user: User }) {
  const admin = isAdmin(user);
  const views = viewsFor(admin);
  const [view, setView] = useState<View>(views[0].key);
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState('');
  // undefined = still loading, null = member has not added bank details yet.
  const [bank, setBank] = useState<BankDetails | null | undefined>(undefined);
  const [bankOpen, setBankOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [firstPrompt, setFirstPrompt] = useState(false);

  useEffect(() => {
    if (admin) return;
    return watchBank(
      user.uid,
      (b) => {
        setBank(b);
        // First visit without bank details: ask once, with a "Later" option.
        if (!b && !saidLater(user.uid)) setFirstPrompt(true);
      },
      (e) => {
        console.error(e);
        setBank(null);
      },
    );
  }, [admin, user.uid]);

  const openBank = () => {
    setEditingBank(!bank);
    setBankOpen(true);
  };
  const closeBank = () => {
    setBankOpen(false);
    setEditingBank(false);
  };
  const later = () => {
    rememberLater(user.uid);
    setFirstPrompt(false);
  };

  useEffect(() => {
    const onError = (e: Error) => {
      console.error(e);
      setError(e.message);
    };
    return admin ? watchAllClaims(setClaims, onError) : watchMyClaims(user.uid, setClaims, onError);
  }, [admin, user.uid]);

  return (
    <div className="min-h-screen">
      <div className="hero-gradient relative overflow-hidden text-white">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-950/40 backdrop-blur">
          <div className="container-px flex h-14 items-center justify-between gap-3 sm:h-16">
            <span className="flex items-center gap-2 truncate font-display text-base font-bold sm:text-lg">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <ReceiptIndianRupee className="h-4 w-4" />
              </span>
              <span>
                <span className="text-brand-200">AtumX</span> Reimbursement
              </span>
            </span>
            <div className="flex items-center gap-3">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full ring-2 ring-white/30"
                />
              )}
              <span className="hidden text-sm text-brand-100 sm:inline">{user.displayName ?? user.email}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  admin ? 'bg-accent-500 text-white' : 'bg-white/15 text-white'
                }`}
              >
                {admin ? 'Admin' : 'User'}
              </span>
              {!admin && (
                <button
                  onClick={openBank}
                  className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/20 text-brand-100 transition hover:bg-white/10 hover:text-white"
                  aria-label="Bank details"
                  title={bank === null ? 'Add your bank details' : 'Bank details'}
                >
                  <Landmark className="h-4 w-4" />
                  {bank === null && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-brand-900" />
                  )}
                </button>
              )}
              <button
                onClick={() => signOut(auth)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/20 text-brand-100 transition hover:bg-white/10 hover:text-white"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="container-px relative pb-16 pt-8 sm:pb-20 sm:pt-12">
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
            Welcome{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-100 sm:text-base">
            {admin
              ? 'Review expense claims, approve them and record payouts.'
              : 'Spent your own money on company work? Submit the bill here and get paid back.'}
          </p>
        </div>
      </div>

      <main className="container-px -mt-10 pb-10 sm:-mt-12">
        <nav className="relative grid grid-cols-2 gap-3 sm:max-w-xl sm:gap-4">
          {views.map(({ key, label, desc, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition sm:flex-row sm:gap-4 sm:p-4 sm:text-left ${
                view === key
                  ? 'border-brand-500 bg-white shadow-glow ring-2 ring-brand-500/30'
                  : 'border-ink-200 bg-white shadow-card hover:border-brand-300'
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-12 sm:w-12 ${
                  view === key ? 'bg-gradient-to-br from-brand-600 to-accent-600 text-white' : 'bg-brand-50 text-brand-700'
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900 sm:text-base">{label}</span>
                <span className="hidden text-xs text-ink-500 sm:block">{desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {view === 'new' && !admin ? (
          <ClaimForm user={user} bank={bank ?? null} onDone={() => setView('mine')} />
        ) : view === 'summary' && admin ? (
          <SummaryPage claims={claims} error={error} />
        ) : (
          <ClaimsPage user={user} admin={admin} claims={claims} error={error} onNew={() => setView('new')} />
        )}
      </main>

      {bankOpen && (
        <Modal
          title="Bank details"
          subtitle="Your reimbursements are paid to this account"
          onClose={closeBank}
        >
          {bank && !editingBank ? (
            <div className="space-y-3">
              <BankSummary bank={bank} />
              <div className="flex justify-end gap-2">
                <button onClick={closeBank} className="btn-ghost py-2">
                  Close
                </button>
                <button onClick={() => setEditingBank(true)} className="btn-primary py-2">
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <BankForm
              user={user}
              bank={bank ?? null}
              onSaved={() => setEditingBank(false)}
              onCancel={() => (bank ? setEditingBank(false) : closeBank())}
            />
          )}
        </Modal>
      )}

      {firstPrompt && !bankOpen && bank === null && (
        <Modal title="Add your bank details" subtitle="So the admin knows where to pay you back" onClose={later}>
          <BankForm
            user={user}
            bank={null}
            cancelLabel="Later"
            onSaved={() => setFirstPrompt(false)}
            onCancel={later}
            note={
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
                You can skip this for now, but bank details are needed before you submit a claim. You can change them
                anytime from the <Landmark className="inline h-4 w-4 align-text-bottom" /> icon at the top.
              </p>
            }
          />
        </Modal>
      )}
    </div>
  );
}
