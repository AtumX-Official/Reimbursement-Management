import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { ReceiptFile } from '@/receipt';

export const CATEGORIES = [
  'Travel',
  'Fuel',
  'Food',
  'Components',
  'Tools',
  'Courier',
  'Printing',
  'Software',
  'Office supplies',
  'Other',
] as const;

export const PAYMENT_MODES = ['UPI', 'Bank transfer', 'Cash', 'Cheque'] as const;

export type ClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type Claim = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD, when the money was spent
  description: string;
  payTo: string; // UPI ID / account the member wants to be paid to
  hasReceipt: boolean;
  receiptName: string;
  proofId: string; // Google Drive file id (newer claims); older claims keep the bill in Firestore
  proofUrl: string;
  status: ClaimStatus;
  createdAt: Date | null;
  approvedAmount: number;
  adminNote: string;
  handledBy: string;
  handledAt: Date | null;
  rejectReason: string;
  paidBy: string;
  paidAt: Date | null;
  paidOn: string;
  paymentMode: string;
  paymentRef: string;
};

export type NewClaim = {
  title: string; // the reason
  amount: number;
  date: string;
  proofId: string;
  proofUrl: string;
  proofName: string;
};

const claimsRef = collection(db, 'reimbursements');
const receiptsRef = collection(db, 'reimbursementReceipts');

const timeOf = (c: Claim) => c.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

// What the admin will actually pay: the approved amount once approved, otherwise the claimed amount.
export const payable = (c: Claim) => (c.status === 'approved' || c.status === 'paid' ? c.approvedAmount : c.amount);

function watch(q: Query, onData: (items: Claim[]) => void, onError: (e: Error) => void) {
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              userId: x.userId ?? '',
              userName: x.userName ?? '',
              userEmail: x.userEmail ?? '',
              title: x.title ?? '',
              category: x.category || 'Other',
              amount: Number(x.amount ?? 0),
              date: x.date ?? '',
              description: x.description ?? '',
              payTo: x.payTo ?? '',
              hasReceipt: Boolean(x.hasReceipt),
              receiptName: x.receiptName ?? '',
              proofId: x.proofId ?? '',
              proofUrl: x.proofUrl ?? '',
              status: x.status ?? 'pending',
              createdAt: x.createdAt?.toDate() ?? null,
              approvedAmount: Number(x.approvedAmount ?? x.amount ?? 0),
              adminNote: x.adminNote ?? '',
              handledBy: x.handledBy ?? '',
              handledAt: x.handledAt?.toDate() ?? null,
              rejectReason: x.rejectReason ?? '',
              paidBy: x.paidBy ?? '',
              paidAt: x.paidAt?.toDate() ?? null,
              paidOn: x.paidOn ?? '',
              paymentMode: x.paymentMode ?? '',
              paymentRef: x.paymentRef ?? '',
            } satisfies Claim;
          })
          // Newest first; a claim still being written has no server time yet, so it sorts on top.
          .sort((a, b) => timeOf(b) - timeOf(a)),
      ),
    onError,
  );
}

// Every claim, for the admin.
export const watchAllClaims = (onData: (items: Claim[]) => void, onError: (e: Error) => void) =>
  watch(query(claimsRef), onData, onError);

// Only the given user's claims. Sorted on the client so no composite index is needed.
export const watchMyClaims = (uid: string, onData: (items: Claim[]) => void, onError: (e: Error) => void) =>
  watch(query(claimsRef, where('userId', '==', uid)), onData, onError);

// The proof is already in Google Drive by now; the claim just records where it is.
export const submitClaim = (user: { uid: string; name: string; email: string }, claim: NewClaim) =>
  addDoc(claimsRef, {
    title: claim.title,
    amount: claim.amount,
    date: claim.date,
    proofId: claim.proofId,
    proofUrl: claim.proofUrl,
    category: 'Other',
    description: '',
    payTo: '',
    userId: user.uid,
    userName: user.name,
    userEmail: user.email,
    hasReceipt: true,
    receiptName: claim.proofName,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

export async function getReceipt(claimId: string): Promise<ReceiptFile | null> {
  const snap = await getDoc(doc(receiptsRef, claimId));
  if (!snap.exists()) return null;
  const x = snap.data();
  return { name: x.name ?? 'receipt', type: x.type ?? '', data: x.data ?? '' };
}

export async function withdrawClaim(c: Claim) {
  const batch = writeBatch(db);
  batch.delete(doc(claimsRef, c.id));
  if (c.hasReceipt && !c.proofId) batch.delete(doc(receiptsRef, c.id));
  await batch.commit();
}

export const approveClaim = (id: string, by: string, approvedAmount: number, adminNote: string) =>
  updateDoc(doc(claimsRef, id), {
    status: 'approved',
    approvedAmount,
    adminNote,
    handledBy: by,
    handledAt: serverTimestamp(),
  });

export const rejectClaim = (id: string, by: string, reason: string) =>
  updateDoc(doc(claimsRef, id), {
    status: 'rejected',
    rejectReason: reason,
    handledBy: by,
    handledAt: serverTimestamp(),
  });

export const markPaid = (id: string, by: string, p: { paidOn: string; paymentMode: string; paymentRef: string }) =>
  updateDoc(doc(claimsRef, id), {
    status: 'paid',
    ...p,
    paidBy: by,
    paidAt: serverTimestamp(),
  });

// Download the given claims as a CSV file (opens fine in Excel / Google Sheets).
export function exportCsv(claims: Claim[], filename: string) {
  const head = [
    'Submitted',
    'Member',
    'Email',
    'Expense date',
    'Reason',
    'Category',
    'Claimed (INR)',
    'Approved (INR)',
    'Status',
    'Pay to',
    'Paid on',
    'Payment mode',
    'Payment ref',
    'Description',
    'Admin note / reason',
    'Proof link',
  ];
  const rows = claims.map((c) => [
    c.createdAt?.toLocaleString('en-IN') ?? '',
    c.userName,
    c.userEmail,
    c.date,
    c.title,
    c.category,
    c.amount,
    c.status === 'approved' || c.status === 'paid' ? c.approvedAmount : '',
    c.status,
    c.payTo,
    c.paidOn,
    c.paymentMode,
    c.paymentRef,
    c.description,
    c.rejectReason || c.adminNote,
    c.proofUrl,
  ]);
  const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
