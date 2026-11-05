/**
 * AtumX Reimbursement - proof uploader.
 *
 * Saves the bill / proof a member attaches into the shared Google Drive folder.
 * Deploy this as a Web app from the info@atumx.in account:
 *   Execute as: Me (info@atumx.in)   Who has access: Anyone
 * Then put the Web app URL in the app's .env.local as VITE_DRIVE_UPLOAD_URL.
 *
 * "Anyone" is needed so the browser can call it, but every request must carry a
 * valid Firebase sign-in token from this app, which is checked below.
 */

const FOLDER_ID = '1_WNk0Q1mh6mFeu9ExH-JKrZHPAnh4PNi';
const FIREBASE_API_KEY = 'AIzaSyBUGDXWBa8d2oW4BoPBSthtaAI6aer7dIM';
const ADMIN_EMAIL = 'info@atumx.in';
const MAX_BYTES = 10 * 1024 * 1024;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const email = verifyUser_(body.idToken);
    if (body.action === 'delete') return json_(deleteProof_(email, body.fileId));
    return json_(saveProof_(email, body));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// Asks Firebase who the token belongs to; only signed-in users with a verified email get through.
function verifyUser_(idToken) {
  if (!idToken) throw new Error('Not signed in.');
  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    },
  );
  const user = (JSON.parse(res.getContentText()).users || [])[0];
  const email = user && String(user.email || '').toLowerCase();
  if (!email || !user.emailVerified) {
    throw new Error('Sign-in expired. Please sign in again.');
  }
  return email;
}

function saveProof_(email, body) {
  const type = String(body.type || '');
  if (!/^image\//.test(type) && type !== 'application/pdf') throw new Error('Upload a photo or a PDF.');
  const bytes = Utilities.base64Decode(String(body.data || ''));
  if (!bytes.length) throw new Error('The file is empty.');
  if (bytes.length > MAX_BYTES) throw new Error('File must be under 10 MB.');

  // e.g. 2026-11-05_venkat_Rs450_Auto to client site.jpg
  const ext = type === 'application/pdf' ? 'pdf' : 'jpg';
  const name = [clean_(body.date, 10), clean_(email.split('@')[0], 30), 'Rs' + Number(body.amount || 0), clean_(body.reason, 60)]
    .filter(String)
    .join('_') + '.' + ext;

  const file = DriveApp.getFolderById(FOLDER_ID).createFile(Utilities.newBlob(bytes, type, name));
  // The uploader is recorded so only they (or the admin) can remove it later.
  file.setDescription('Uploaded by ' + email + '\nReason: ' + String(body.reason || '').slice(0, 300));
  return { ok: true, id: file.getId(), url: file.getUrl(), name: name };
}

// Used when a member withdraws a pending claim, so its proof does not stay behind.
function deleteProof_(email, fileId) {
  const file = DriveApp.getFileById(String(fileId || ''));
  const owner = (/Uploaded by (\S+)/.exec(file.getDescription() || '') || [])[1];
  if (email !== ADMIN_EMAIL && email !== owner) throw new Error('You can only remove your own proof.');
  file.setTrashed(true);
  return { ok: true };
}

function clean_(s, max) {
  return String(s || '')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
