// Receipts are stored inside Firestore (no Cloud Storage needed), so they must fit well under
// Firestore's 1 MiB document limit. Images are shrunk and re-encoded as JPEG; PDFs must already be small.

export type ReceiptFile = { name: string; type: string; data: string };

const MAX_DATA_URL = 900_000; // characters of base64 data URL
const MAX_PDF_BYTES = 650 * 1024;

const readAsDataURL = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be opened. Try a JPG or PNG.'));
    img.src = src;
  });

async function compressImage(file: File): Promise<string> {
  const img = await loadImage(await readAsDataURL(file));
  // Try progressively smaller sizes / lower quality until it fits.
  for (const [maxSide, quality] of [
    [1600, 0.8],
    [1400, 0.7],
    [1200, 0.6],
    [1000, 0.55],
    [800, 0.5],
  ] as const) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', quality);
    if (data.length <= MAX_DATA_URL) return data;
  }
  throw new Error('This image is too large even after compressing. Try a smaller photo.');
}

export async function prepareReceipt(file: File): Promise<ReceiptFile> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('PDF must be under 650 KB. Take a photo of the bill instead.');
    return { name: file.name, type: file.type, data: await readAsDataURL(file) };
  }
  if (file.type.startsWith('image/')) {
    return { name: file.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg', data: await compressImage(file) };
  }
  throw new Error('Upload a photo (JPG/PNG) or a PDF.');
}

// Opens a stored receipt in a new tab (data: URLs cannot be opened directly by most browsers).
export async function openReceipt(r: ReceiptFile) {
  const blob = await (await fetch(r.data)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
