import { useState } from 'react';
import type { User } from 'firebase/auth';
import { Download, Plus, ReceiptText } from 'lucide-react';
import { exportCsv, payable, type Claim, type ClaimStatus } from '@/claims';
import { formatDate, formatMonth } from '@/dates';
import { formatINR } from '@/money';
import ClaimCard from '@/ClaimCard';
import { SearchBox, STATUS } from '@/ui';

type Filter = ClaimStatus | 'all';
const FILTERS: Filter[] = ['pending', 'approved', 'paid', 'rejected', 'all'];

const sum = (cs: Claim[]) => cs.reduce((n, c) => n + payable(c), 0);

export default function ClaimsPage({
  user,
  admin,
  claims,
  error,
  onNew,
}: {
  user: User;
  admin: boolean;
  claims: Claim[] | null;
  error: string;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<Filter>(admin ? 'pending' : 'all');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('');

  const all = claims ?? [];
  const inMonth = all.filter((c) => !month || c.date.startsWith(month));
  const byStatus = (s: ClaimStatus) => inMonth.filter((c) => c.status === s);

  const q = search.trim().toLowerCase();
  const shown = inMonth
    .filter((c) => filter === 'all' || c.status === filter)
    .filter(
      (c) =>
        !q ||
        [c.title, c.category, c.description, c.userName, c.userEmail, formatDate(c.date)].some((v) =>
          v.toLowerCase().includes(q),
        ),
    );

  const stats: { key: ClaimStatus; label: string; hint: string }[] = [
    { key: 'pending', label: admin ? 'To review' : 'Waiting', hint: 'claimed' },
    { key: 'approved', label: admin ? 'To pay' : 'Approved', hint: 'approved' },
    { key: 'paid', label: 'Paid', hint: 'paid out' },
    { key: 'rejected', label: 'Rejected', hint: 'claimed' },
  ];

  return (
    <>
      {claims && (
        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ key, label, hint }) => {
            const list = byStatus(key);
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(active ? 'all' : key)}
                className={`card text-left transition sm:p-5 ${active ? 'ring-2 ring-brand-500/50' : 'hover:border-ink-300'}`}
              >
                <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-500">
                  <span className={`h-2 w-2 rounded-full ${STATUS[key].dot}`} />
                  {label}
                </span>
                <span className="mt-2 block font-display text-xl font-bold tabular-nums text-ink-900 sm:text-2xl">
                  {formatINR(sum(list))}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {list.length} claim{list.length === 1 ? '' : 's'} · {hint}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <div className="mt-8 mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">
          {admin ? 'Claims' : 'My claims'}{' '}
          {claims && <span className="text-ink-500">({shown.length})</span>}
          {month && <span className="ml-2 text-sm font-normal text-ink-500">in {formatMonth(month)}</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 overflow-x-auto rounded-full border border-ink-200 bg-ink-50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
                  filter === f ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-full border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
            aria-label="Filter by month"
            title="Filter by month spent"
          />
          <SearchBox value={search} onChange={setSearch} placeholder={admin ? 'Search member, item…' : 'Search'} />
          {admin ? (
            <button
              onClick={() => exportCsv(shown, `reimbursements${month ? '-' + month : ''}-${filter}.csv`)}
              disabled={shown.length === 0}
              className="btn-ghost py-2 disabled:opacity-50"
              title="Download the claims shown as CSV"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          ) : (
            <button onClick={onNew} className="btn-primary py-2">
              <Plus className="h-4 w-4" /> New claim
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="card text-sm text-red-600">Could not load claims: {error}</p>
      ) : claims === null ? (
        <p className="text-sm text-ink-500">Loading claims…</p>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <ReceiptText className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">
            {all.length === 0
              ? admin
                ? 'No claims yet.'
                : 'You have not claimed anything yet. Click New claim to submit a bill.'
              : 'No claims match these filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <ClaimCard key={c.id} user={user} claim={c} admin={admin} />
          ))}
        </div>
      )}
    </>
  );
}
