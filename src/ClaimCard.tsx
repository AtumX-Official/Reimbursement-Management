import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Banknote, Check, ExternalLink, FileText, Paperclip, Trash2, X } from 'lucide-react';
import {
  approveClaim,
  getReceipt,
  markPaid,
  PAYMENT_MODES,
  rejectClaim,
  withdrawClaim,
  type Claim,
} from '@/claims';
import { openReceipt, type ReceiptFile } from '@/receipt';
import { deleteProof } from '@/drive';
import { getBank, type BankDetails } from '@/bank';
import { BankSummary } from '@/BankForm';
import { checkDate, formatDate, formatTime, today } from '@/dates';
import { formatINR, toPaise } from '@/money';
import { field, Modal, StatusBadge } from '@/ui';

const nameOf = (u: User) => u.displayName ?? u.email ?? 'Unknown';

function FormButtons({ saving, label, onClose, danger }: { saving: boolean; label: string; onClose: () => void; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="btn-ghost py-2">
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className={
          danger
            ? 'inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60'
            : 'btn-primary py-2 disabled:opacity-60'
        }
      >
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

// Runs an async save, showing errors and keeping the form open if it fails.
function useSave(onClose: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError('');
    try {
      await fn();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };
  return { saving, error, setError, run };
}

function ApproveForm({ user, claim, onClose }: { user: User; claim: Claim; onClose: () => void }) {
  const [amount, setAmount] = useState(String(claim.amount));
  const [note, setNote] = useState('');
  const { saving, error, setError, run } = useSave(onClose);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = toPaise(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return setError('Enter the amount to approve.');
    if (n > claim.amount) return setError(`Cannot approve more than the claimed ${formatINR(claim.amount)}.`);
    run(() => approveClaim(claim.id, nameOf(user), n, note.trim()));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-600">
        Approved amount (₹) — claimed {formatINR(claim.amount)}
        <input
          autoFocus
          type="number"
          min={0.01}
          step={0.01}
          max={claim.amount}
          className={`${field} mt-1 tabular-nums`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label className="block text-xs text-ink-600">
        Note to member (optional)
        <textarea
          rows={2}
          className={`${field} mt-1 resize-none`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Parking not covered, approved fuel only"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <FormButtons saving={saving} label="Approve" onClose={onClose} />
    </form>
  );
}

function RejectForm({ user, claim, onClose }: { user: User; claim: Claim; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const { saving, error, setError, run } = useSave(onClose);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return setError('Tell the member why, so they can fix and resubmit.');
    run(() => rejectClaim(claim.id, nameOf(user), reason.trim()));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-600">
        Reason
        <textarea
          autoFocus
          rows={3}
          className={`${field} mt-1 resize-none`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Bill is not readable, please upload a clear photo"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <FormButtons saving={saving} label="Reject claim" onClose={onClose} danger />
    </form>
  );
}

function PayForm({ user, claim, onClose }: { user: User; claim: Claim; onClose: () => void }) {
  const [paidOn, setPaidOn] = useState(today);
  const [mode, setMode] = useState<string>(PAYMENT_MODES[0]);
  const [ref, setRef] = useState('');
  const { saving, error, setError, run } = useSave(onClose);
  // The member's bank details, fetched from their profile (they are not stored on the claim).
  const [bank, setBank] = useState<BankDetails | null | undefined>(undefined);
  const [bankError, setBankError] = useState('');

  useEffect(() => {
    let live = true;
    getBank(claim.userId)
      .then((b) => live && setBank(b))
      .catch((e) => {
        if (!live) return;
        setBank(null);
        setBankError(e instanceof Error ? e.message : 'Could not load bank details');
      });
    return () => {
      live = false;
    };
  }, [claim.userId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const bad = checkDate(paidOn);
    if (bad) return setError(bad);
    run(() => markPaid(claim.id, nameOf(user), { paidOn, paymentMode: mode, paymentRef: ref.trim() }));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Paying <span className="font-semibold">{formatINR(claim.approvedAmount)}</span>
        {claim.payTo && (
          <>
            {' '}
            to <span className="font-semibold break-all">{claim.payTo}</span>
          </>
        )}
      </div>
      {bank === undefined ? (
        <p className="rounded-xl bg-ink-50 px-3 py-4 text-center text-sm text-ink-500">Loading bank details…</p>
      ) : bank ? (
        <BankSummary bank={bank} full />
      ) : (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {bankError || `${claim.userName} has not added bank details yet.`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-ink-600">
          Paid on
          <input
            type="date"
            max={today()}
            required
            className={`${field} mt-1`}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        </label>
        <label className="text-xs text-ink-600">
          Mode
          <select className={`${field} mt-1`} value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-ink-600">
        Transaction / reference no. (optional)
        <input className={`${field} mt-1`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / UPI ref" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <FormButtons saving={saving} label="Mark as paid" onClose={onClose} />
    </form>
  );
}

function WithdrawForm({ user, claim, onClose }: { user: User; claim: Claim; onClose: () => void }) {
  const { saving, error, run } = useSave(onClose);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await withdrawClaim(claim);
          // Best effort: the claim is already gone, so a Drive hiccup should not block the member.
          if (claim.proofId) await deleteProof(user, claim.proofId).catch((err) => console.error(err));
        });
      }}
      className="space-y-3"
    >
      <p className="text-sm text-ink-600">
        This deletes the claim and its bill. You can submit a new one later.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <FormButtons saving={saving} label="Withdraw claim" onClose={onClose} danger />
    </form>
  );
}

function ReceiptView({ claim }: { claim: Claim }) {
  const [receipt, setReceipt] = useState<ReceiptFile | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getReceipt(claim.id)
      .then((r) => live && setReceipt(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load the receipt'));
    return () => {
      live = false;
    };
  }, [claim.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (receipt === undefined) return <p className="py-10 text-center text-sm text-ink-500">Loading bill…</p>;
  if (receipt === null) return <p className="text-sm text-ink-500">The bill file is missing.</p>;
  return (
    <div className="space-y-3">
      {receipt.type.startsWith('image/') ? (
        <img src={receipt.data} alt={`Bill for ${claim.title}`} className="w-full rounded-xl border border-ink-200" />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-ink-50 py-10 text-ink-600">
          <FileText className="h-10 w-10 text-brand-600" />
          <span className="text-sm">{receipt.name}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <a href={receipt.data} download={receipt.name} className="btn-ghost py-2">
          Download
        </a>
        <button onClick={() => openReceipt(receipt)} className="btn-primary py-2">
          <ExternalLink className="h-4 w-4" /> Open
        </button>
      </div>
    </div>
  );
}

type Action = 'approve' | 'reject' | 'pay' | 'withdraw' | 'receipt';

export default function ClaimCard({ user, claim, admin }: { user: User; claim: Claim; admin: boolean }) {
  const [action, setAction] = useState<Action | null>(null);
  const close = useCallback(() => setAction(null), []);
  const changed = (claim.status === 'approved' || claim.status === 'paid') && claim.approvedAmount !== claim.amount;
  const who = `${claim.userName} · ${claim.title}`;

  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-900">{claim.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {admin && (
              <>
                <span className="font-medium text-ink-700">{claim.userName}</span> ·{' '}
              </>
            )}
            {claim.category !== 'Other' && `${claim.category} · `}spent {formatDate(claim.date)}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p
            className={`font-display font-bold tabular-nums ${
              changed ? 'text-lg text-ink-400 line-through decoration-2' : 'text-2xl text-ink-900'
            }`}
          >
            {formatINR(claim.amount)}
          </p>
          {changed && (
            <p className="font-display text-2xl font-bold tabular-nums text-ink-900">
              {formatINR(claim.approvedAmount)}
              <span className="ml-1 align-middle text-xs font-medium text-ink-500">approved</span>
            </p>
          )}
        </div>
        {claim.proofUrl ? (
          <a
            href={claim.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-400 hover:text-brand-700"
          >
            <Paperclip className="h-3.5 w-3.5" /> View proof
          </a>
        ) : claim.hasReceipt ? (
          <button
            onClick={() => setAction('receipt')}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-400 hover:text-brand-700"
          >
            <Paperclip className="h-3.5 w-3.5" /> View bill
          </button>
        ) : (
          <span className="text-xs text-amber-600">No bill attached</span>
        )}
      </div>

      {claim.description && <p className="mt-3 text-sm text-ink-600">“{claim.description}”</p>}
      {admin && claim.payTo && (
        <p className="mt-2 text-xs text-ink-500">
          Pay to: <span className="break-all font-medium text-ink-700">{claim.payTo}</span>
        </p>
      )}
      {claim.adminNote && (
        <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-700">
          <span className="font-medium text-brand-700">Admin note:</span> {claim.adminNote}
        </p>
      )}
      {claim.rejectReason && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="font-medium">Rejected:</span> {claim.rejectReason}
        </p>
      )}

      <ol className="mt-4 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
        <li>Submitted {formatTime(claim.createdAt)}</li>
        {claim.status !== 'pending' && (
          <li>
            {claim.status === 'rejected' ? 'Rejected' : 'Approved'} by {claim.handledBy} · {formatTime(claim.handledAt)}
          </li>
        )}
        {claim.status === 'paid' && (
          <li className="font-medium text-emerald-700">
            Paid {formatDate(claim.paidOn)} via {claim.paymentMode}
            {claim.paymentRef && ` · Ref ${claim.paymentRef}`}
          </li>
        )}
      </ol>

      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4 empty:hidden">
        {admin && claim.status === 'pending' && (
          <>
            <button onClick={() => setAction('reject')} className="btn-ghost py-2">
              <X className="h-4 w-4" /> Reject
            </button>
            <button onClick={() => setAction('approve')} className="btn-primary py-2">
              <Check className="h-4 w-4" /> Approve
            </button>
          </>
        )}
        {admin && claim.status === 'approved' && (
          <button onClick={() => setAction('pay')} className="btn-primary bg-emerald-600 py-2 hover:bg-emerald-700">
            <Banknote className="h-4 w-4" /> Mark paid
          </button>
        )}
        {!admin && claim.status === 'pending' && (
          <button onClick={() => setAction('withdraw')} className="btn-ghost py-2 text-red-600">
            <Trash2 className="h-4 w-4" /> Withdraw
          </button>
        )}
      </div>

      {action === 'approve' && (
        <Modal title="Approve claim" subtitle={who} onClose={close}>
          <ApproveForm user={user} claim={claim} onClose={close} />
        </Modal>
      )}
      {action === 'reject' && (
        <Modal title="Reject claim" subtitle={who} onClose={close}>
          <RejectForm user={user} claim={claim} onClose={close} />
        </Modal>
      )}
      {action === 'pay' && (
        <Modal title="Record payment" subtitle={who} onClose={close}>
          <PayForm user={user} claim={claim} onClose={close} />
        </Modal>
      )}
      {action === 'withdraw' && (
        <Modal title="Withdraw this claim?" subtitle={claim.title} onClose={close}>
          <WithdrawForm user={user} claim={claim} onClose={close} />
        </Modal>
      )}
      {action === 'receipt' && (
        <Modal title="Bill" subtitle={who} onClose={close} wide>
          <ReceiptView claim={claim} />
        </Modal>
      )}
    </div>
  );
}
