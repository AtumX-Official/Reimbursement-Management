import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';

// Bank details are kept once per member in users/{uid} (not copied onto every claim).
// Only the member and the admin can read them; see firestore.rules.
export type BankDetails = {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string; // optional
};

export const EMPTY_BANK: BankDetails = { holderName: '', bankName: '', accountNumber: '', ifsc: '', upiId: '' };

const userDoc = (uid: string) => doc(db, 'users', uid);

const fromData = (x: Record<string, unknown> | undefined): BankDetails | null => {
  const b = x?.bank as Partial<BankDetails> | undefined;
  if (!b?.accountNumber || !b.ifsc) return null;
  return {
    holderName: b.holderName ?? '',
    bankName: b.bankName ?? '',
    accountNumber: b.accountNumber,
    ifsc: b.ifsc,
    upiId: b.upiId ?? '',
  };
};

// Live bank details for the signed-in member; null means not added yet.
export const watchBank = (uid: string, onData: (b: BankDetails | null) => void, onError: (e: Error) => void) =>
  onSnapshot(userDoc(uid), (snap) => onData(fromData(snap.data())), onError);

// One-off read, used by the admin when recording a payment.
export const getBank = async (uid: string) => fromData((await getDoc(userDoc(uid))).data());

export const saveBank = (user: { uid: string; name: string; email: string }, bank: BankDetails) =>
  setDoc(
    userDoc(user.uid),
    { name: user.name, email: user.email, bank, bankUpdatedAt: serverTimestamp() },
    { merge: true },
  );

export const cleanBank = (b: BankDetails): BankDetails => ({
  holderName: b.holderName.trim().replace(/\s+/g, ' '),
  bankName: b.bankName.trim().replace(/\s+/g, ' '),
  accountNumber: b.accountNumber.replace(/\s+/g, ''),
  ifsc: b.ifsc.trim().toUpperCase(),
  upiId: b.upiId.trim(),
});

// Returns the first problem with the details, or '' if they look fine.
export function checkBank(b: BankDetails, confirmAccount: string) {
  if (!b.holderName) return 'Enter the account holder name.';
  if (!b.bankName) return 'Enter the bank name.';
  if (!/^\d{9,18}$/.test(b.accountNumber)) return 'Account number should be 9 to 18 digits.';
  if (confirmAccount.replace(/\s+/g, '') !== b.accountNumber) return 'Account numbers do not match.';
  if (b.ifsc.length !== 11)
    return `IFSC must be 11 characters, you entered ${b.ifsc.length}. Check your passbook or cheque book.`;
  if (!/^[A-Z]{4}/.test(b.ifsc)) return 'IFSC must start with 4 letters (the bank code), e.g. CIUB, SBIN, HDFC.';
  if (b.ifsc[4] !== '0') return 'The 5th character of an IFSC is always 0 (zero).';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifsc)) return 'IFSC can only have letters and numbers, e.g. CIUB0000034.';
  if (b.upiId && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(b.upiId)) return 'UPI ID should look like name@okaxis.';
  return '';
}

// "XXXX XXXX 1234"
export const maskAccount = (n: string) => (n.length > 4 ? `•••• ${n.slice(-4)}` : n);
