import { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { CATEGORIES, exportCsv, type Claim } from '@/claims';
import { formatMonth } from '@/dates';
import { formatINR } from '@/money';

type Row = {
  key: string;
  name: string;
  email: string;
  count: number;
  claimed: number;
  pending: number;
  toPay: number;
  paid: number;
};

export default function SummaryPage({ claims, error }: { claims: Claim[] | null; error: string }) {
  const [month, setMonth] = useState('');

  if (error) return <p className="card mt-8 text-sm text-red-600">Could not load claims: {error}</p>;
  if (claims === null) return <p className="mt-8 text-sm text-ink-500">Loading claims…</p>;

  const list = claims.filter((c) => !month || c.date.startsWith(month));

  const members = new Map<string, Row>();
  for (const c of list) {
    const r =
      members.get(c.userId) ??
      ({ key: c.userId, name: c.userName, email: c.userEmail, count: 0, claimed: 0, pending: 0, toPay: 0, paid: 0 } as Row);
    r.count += 1;
    r.claimed += c.amount;
    if (c.status === 'pending') r.pending += c.amount;
    if (c.status === 'approved') r.toPay += c.approvedAmount;
    if (c.status === 'paid') r.paid += c.approvedAmount;
    members.set(c.userId, r);
  }
  const rows = [...members.values()].sort((a, b) => b.toPay + b.pending - (a.toPay + a.pending) || b.claimed - a.claimed);
  const total = rows.reduce(
    (t, r) => ({
      count: t.count + r.count,
      claimed: t.claimed + r.claimed,
      pending: t.pending + r.pending,
      toPay: t.toPay + r.toPay,
      paid: t.paid + r.paid,
    }),
    { count: 0, claimed: 0, pending: 0, toPay: 0, paid: 0 },
  );

  // Approved + paid spend per category, for a quick "where is the money going" view.
  const spent = list.filter((c) => c.status === 'approved' || c.status === 'paid');
  const byCat = [...CATEGORIES, ...new Set(spent.map((c) => c.category))]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((cat) => ({ cat, amount: spent.filter((c) => c.category === cat).reduce((n, c) => n + c.approvedAmount, 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...byCat.map((x) => x.amount));

  return (
    <>
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink-900">
          Summary{' '}
          <span className="text-sm font-normal text-ink-500">{month ? formatMonth(month) : 'all time'}</span>
        </h2>
        <div className="flex gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-full border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
            aria-label="Filter by month"
          />
          <button
            onClick={() => exportCsv(list, `reimbursements-${month || 'all'}.csv`)}
            disabled={list.length === 0}
            className="btn-ghost py-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export all
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <BarChart3 className="h-10 w-10 text-ink-300" />
          <p className="mt-3 text-ink-600">No claims {month ? 'in this month' : 'yet'}.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="overflow-x-auto rounded-2xl border border-ink-200 xl:col-span-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 text-right font-medium">Claims</th>
                  <th className="px-4 py-3 text-right font-medium">Claimed</th>
                  <th className="px-4 py-3 text-right font-medium">Pending</th>
                  <th className="px-4 py-3 text-right font-medium">To pay</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-brand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-900">{r.name}</p>
                      <p className="text-xs text-ink-500">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-700">{r.count}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-700">{formatINR(r.claimed)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-700">
                      {r.pending ? formatINR(r.pending) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-sky-700">
                      {r.toPay ? formatINR(r.toPay) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">
                      {r.paid ? formatINR(r.paid) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-ink-200 bg-ink-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-ink-900">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{total.count}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatINR(total.claimed)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-700">{formatINR(total.pending)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-sky-700">{formatINR(total.toPay)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">{formatINR(total.paid)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card">
            <h3 className="font-semibold text-ink-900">Spend by category</h3>
            <p className="text-xs text-ink-500">Approved and paid claims</p>
            {byCat.length === 0 ? (
              <p className="mt-6 text-sm text-ink-500">Nothing approved yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {byCat.map(({ cat, amount }) => (
                  <li key={cat}>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-700">{cat}</span>
                      <span className="tabular-nums font-medium text-ink-900">{formatINR(amount)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-ink-100">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(amount / maxCat) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
