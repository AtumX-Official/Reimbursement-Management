const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const formatINR = (n: number) => inr.format(n || 0);

// Rounds to paise so floating point noise never reaches Firestore.
export const toPaise = (n: number) => Math.round(n * 100) / 100;
