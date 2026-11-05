import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ClaimStatus } from '@/claims';

export const fieldBase =
  'rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm';
export const field = `${fieldBase} w-full`;

export const STATUS: Record<ClaimStatus, { label: string; style: string; dot: string }> = {
  pending: { label: 'Pending', style: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  approved: { label: 'Approved', style: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  paid: { label: 'Paid', style: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', style: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// A centered popup over a dimmed backdrop; closes on Escape or a click outside the panel.
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card max-h-[90dvh] w-full overflow-y-auto bg-white ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="mt-0.5 break-all text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:w-60 sm:flex-none">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-ink-200 bg-ink-50 py-2 pl-9 pr-8 text-base text-ink-900 outline-none focus:border-brand-500 sm:text-sm"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-900"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
