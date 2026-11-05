import { useState, type FormEvent, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { Check, Copy, Landmark } from 'lucide-react';
import { checkBank, cleanBank, EMPTY_BANK, maskAccount, saveBank, type BankDetails } from '@/bank';
import { field } from '@/ui';

const nameOf = (u: User) => u.displayName ?? u.email ?? 'Unknown';

// Add / edit form for a member's own bank details. Used from the header icon, the first-login
// prompt and the claim confirmation step.
export function BankForm({
  user,
  bank,
  onSaved,
  onCancel,
  cancelLabel = 'Cancel',
  saveLabel = 'Save bank details',
  note,
}: {
  user: User;
  bank: BankDetails | null;
  onSaved: (b: BankDetails) => void;
  onCancel: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  note?: ReactNode;
}) {
  const [form, setForm] = useState<BankDetails>(bank ?? { ...EMPTY_BANK, holderName: user.displayName ?? '' });
  const [confirm, setConfirm] = useState(bank?.accountNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<BankDetails>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // this form can open on top of the claim form
    const clean = cleanBank(form);
    const bad = checkBank(clean, confirm);
    if (bad) return setError(bad);
    setSaving(true);
    setError('');
    try {
      await saveBank({ uid: user.uid, name: nameOf(user), email: user.email ?? '' }, clean);
      onSaved(clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bank details');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {note}
      <label className="block text-xs text-ink-600">
        Account holder name
        <input
          autoFocus
          required
          className={`${field} mt-1`}
          value={form.holderName}
          onChange={(e) => set({ holderName: e.target.value })}
          placeholder="As printed on passbook"
        />
      </label>
      <label className="block text-xs text-ink-600">
        Bank name
        <input
          required
          className={`${field} mt-1`}
          value={form.bankName}
          onChange={(e) => set({ bankName: e.target.value })}
          placeholder="State Bank of India"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-600">
          Account number
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            className={`${field} mt-1 tabular-nums`}
            value={form.accountNumber}
            onChange={(e) => set({ accountNumber: e.target.value })}
          />
        </label>
        <label className="text-xs text-ink-600">
          Re-enter account number
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            onPaste={(e) => e.preventDefault()}
            className={`${field} mt-1 tabular-nums`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <label className="text-xs text-ink-600">
          IFSC code
          <input
            required
            maxLength={11}
            className={`${field} mt-1 uppercase`}
            value={form.ifsc}
            onChange={(e) => set({ ifsc: e.target.value.toUpperCase().replace(/\s+/g, '') })}
            placeholder="CIUB0000034"
          />
          <span className={`mt-1 block text-[11px] ${form.ifsc && form.ifsc.length !== 11 ? 'text-amber-600' : 'text-ink-400'}`}>
            {form.ifsc.length}/11 characters
          </span>
        </label>
        <label className="text-xs text-ink-600">
          UPI ID (optional)
          <input
            className={`${field} mt-1`}
            value={form.upiId}
            onChange={(e) => set({ upiId: e.target.value })}
            placeholder="name@okaxis"
          />
        </label>
      </div>
      <p className="text-xs text-ink-500">Only you and the admin can see these details.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost py-2">
          {cancelLabel}
        </button>
        <button type="submit" disabled={saving} className="btn-primary py-2 disabled:opacity-60">
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </form>
  );
}

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        })
      }
      className="text-ink-400 hover:text-brand-600"
      aria-label="Copy"
      title="Copy"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// Read-only view of bank details. `full` shows the whole account number with copy buttons (admin paying out).
export function BankSummary({ bank, full = false }: { bank: BankDetails; full?: boolean }) {
  const rows: [string, string][] = [
    ['Name', bank.holderName],
    ['Bank', bank.bankName],
    ['Account no.', full ? bank.accountNumber : maskAccount(bank.accountNumber)],
    ['IFSC', bank.ifsc],
    ...(bank.upiId ? ([['UPI', bank.upiId]] as [string, string][]) : []),
  ];
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        <Landmark className="h-3.5 w-3.5" /> Bank details
      </p>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <dt className="text-ink-500">{k}</dt>
            <dd className="flex min-w-0 items-center gap-2 font-medium text-ink-900">
              <span className="break-all tabular-nums">{v}</span>
              {full && <CopyValue value={v} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
