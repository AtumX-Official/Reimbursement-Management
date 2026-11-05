import type { User } from 'firebase/auth';
import { prepareReceipt } from '@/receipt';

// Web app URL of apps-script/Code.gs, which saves proofs into the shared Google Drive folder.
const UPLOAD_URL = import.meta.env.VITE_DRIVE_UPLOAD_URL as string | undefined;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type ProofFile = { name: string; type: string; data: string }; // data is a data: URL
export type UploadedProof = { id: string; url: string; name: string };

const readAsDataURL = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });

// Photos are shrunk first so uploads are quick on mobile data; PDFs go up as they are.
export async function prepareProof(file: File): Promise<ProofFile> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('PDF must be under 10 MB.');
    return { name: file.name, type: file.type, data: await readAsDataURL(file) };
  }
  return prepareReceipt(file);
}

async function call<T>(user: User, payload: Record<string, unknown>): Promise<T> {
  if (!UPLOAD_URL) throw new Error('Proof upload is not set up yet (VITE_DRIVE_UPLOAD_URL is missing). Tell the admin.');
  const idToken = await user.getIdToken();
  // text/plain keeps this a "simple" request, which Apps Script web apps accept from the browser.
  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, idToken }),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}). Try again.`);
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'Upload failed. Try again.');
  return out as T;
}

export const uploadProof = (
  user: User,
  proof: ProofFile,
  meta: { reason: string; date: string; amount: number },
) =>
  call<UploadedProof>(user, {
    action: 'upload',
    type: proof.type,
    data: proof.data.slice(proof.data.indexOf(',') + 1),
    ...meta,
  });

export const deleteProof = (user: User, fileId: string) => call(user, { action: 'delete', fileId });
