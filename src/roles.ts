import type { User } from 'firebase/auth';

// The only account allowed to approve and pay claims. Firestore rules enforce the same check.
export const ADMIN_EMAIL = 'info@atumx.in';

export const isAdmin = (user: User) => user.email === ADMIN_EMAIL && user.emailVerified;

// Any Google account with a verified email may use the app. Firestore rules enforce the same check.
export const isAllowed = (user: User) => user.emailVerified && Boolean(user.email);
