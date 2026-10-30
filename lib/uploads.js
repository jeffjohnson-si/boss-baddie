import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * UPLOADED IMAGES  (server only)
 * ==============================
 * Every image a human uploads — product photos from Patricia, profile pictures
 * from members — is checked and stored here, so the rules live in one place
 * instead of being re-argued in each route.
 *
 * WHY THESE RULES:
 *   - The stored NAME is generated here (prefix + uuid + an extension we chose).
 *     The client filename is never used, which rules out path traversal
 *     ("../../x"), null bytes, and overwriting somebody else's upload.
 *   - The extension comes from the file's MAGIC BYTES, not from the declared
 *     Content-Type or the filename, so a script cannot arrive dressed as a PNG.
 *   - PNG / JPEG / WebP only. Notably NOT SVG: an SVG is a document that can
 *     carry <script>, and it would be served from our own origin.
 *   - Size is capped by the caller, because a product photo and a profile
 *     picture do not deserve the same allowance.
 *
 * WHERE THE BYTES GO:
 *   - With CLOUDINARY_* configured, to Cloudinary. This is required on
 *     Netlify/Vercel, whose filesystem is read-only and ephemeral.
 *   - Without it, to public/uploads, which is how local development works.
 *   The database only stores the returned URL/path, so callers do not care which
 *   backend is active.
 *
 * Client components must NEVER import this file.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOAD_PREFIX = 'uploads';

/**
 * The shape of a name this module produces, and the only shape it will delete.
 * Anchored to our own prefixes, UUID and the three accepted extensions, so a
 * value that somehow reached the store cannot become an arbitrary path or id.
 */
const UPLOAD_NAME =
  /^(?:p|a)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/;

const UPLOAD_ID =
  /^(?:p|a)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_FOLDER || UPLOAD_PREFIX;

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, folder };
}

/** True when uploads are going to Cloudinary rather than the local disk. */
export function hasObjectStorage() {
  return Boolean(cloudinaryConfig());
}

/**
 * Cloudinary signature: sort the signed parameters, join with `&`, append the
 * API secret, SHA-1. `file`, `api_key` and `cloud_name` are never signed.
 */
function signCloudinary(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/**
 * Turn a stored delivery URL back into the public_id needed by the destroy API.
 * Cloudinary URLs look like:
 *   https://res.cloudinary.com/<cloud>/image/upload/v123/uploads/p-<uuid>.webp
 */
function publicIdFromUrl(raw, config) {
  const marker = `res.cloudinary.com/${config.cloudName}/image/upload/`;
  const index = String(raw).indexOf(marker);
  if (index === -1) return null;

  let value = String(raw).slice(index + marker.length).split('?')[0];
  value = value.replace(/^v\d+\//, '').replace(/\.[a-z0-9]+$/i, '');

  const prefix = `${config.folder}/`;
  if (!value.startsWith(prefix)) return null;

  const name = value.slice(prefix.length);
  if (!UPLOAD_ID.test(name)) return null;

  return value;
}

/**
 * Identify the format from the file header. Returns the extension we will store
 * it as, or null when it is not an image we accept.
 */
export function sniffImageExtension(buffer) {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Pull the `file` field out of a multipart request and hand back its bytes.
 *
 * Both upload routes need exactly the same sequence of refusals, so they share
 * it: unreadable form, no file, empty file, and over the cap. `file.size` is only
 * advisory, so the real check is on the bytes we actually read.
 *
 * @returns {Promise<{ ok: true, buffer: Buffer } | { ok: false, error: string, status: number }>}
 */
export async function readImageUpload(request, maxBytes) {
  let file;
  try {
    const form = await request.formData();
    file = form.get('file');
  } catch {
    return { ok: false, error: 'Could not read the upload.', status: 400 };
  }

  if (!file || typeof file.arrayBuffer !== 'function') {
    return { ok: false, error: 'Choose an image to upload.', status: 400 };
  }

  const tooBig = {
    ok: false,
    error: `That image is larger than ${Math.round(maxBytes / (1024 * 1024))} MB. Please use a smaller one.`,
    status: 413,
  };

  if (typeof file.size === 'number' && file.size > maxBytes) return tooBig;

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return { ok: false, error: 'That file is empty.', status: 400 };
  if (buffer.length > maxBytes) return tooBig;

  if (!sniffImageExtension(buffer)) {
    return { ok: false, error: 'Only PNG, JPEG and WebP images can be uploaded.', status: 400 };
  }

  return { ok: true, buffer };
}

/**
 * Store an image and return the URL/path it is served at.
 *
 * @param {Buffer} buffer   the bytes we actually read, already size-checked
 * @param {string} prefix   short tag so a filename says what it is ('p' product, 'a' avatar)
 * @returns {Promise<string|null>} a Cloudinary URL or '/uploads/<name>', or null on failure
 */
export async function saveImageUpload(buffer, prefix) {
  const extension = sniffImageExtension(buffer);
  if (!extension) return null;

  const id = crypto.randomUUID();
  const name = `${prefix}-${id}`;
  const filename = `${name}.${extension}`;
  const config = cloudinaryConfig();

  if (config) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = { folder: config.folder, public_id: name, timestamp };
    const signature = signCloudinary(signed, config.apiSecret);

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: CONTENT_TYPES[extension] }), filename);
    form.append('api_key', config.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', config.folder);
    form.append('public_id', name);
    form.append('signature', signature);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
        { method: 'POST', body: form },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(
          `[uploads] Cloudinary upload failed: ${response.status} ${data?.error?.message ?? ''}`,
        );
        return null;
      }

      return data.secure_url || null;
    } catch (err) {
      console.error('[uploads] Cloudinary request failed:', err.message);
      return null;
    }
  }

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  } catch (err) {
    console.error('[uploads] write failed:', err.message);
    return null;
  }

  return `/uploads/${filename}`;
}

/**
 * Delete a file we previously stored. Best effort on purpose: this is only ever
 * housekeeping after a replaced picture, and a member's profile must not fail to
 * save because an old file had already gone.
 *
 * Accepts both backends:
 *   '/uploads/<name>'                          local file
 *   'https://res.cloudinary.com/.../<name>'    Cloudinary asset
 */
export async function deleteUpload(publicPath) {
  const raw = String(publicPath ?? '');

  if (raw.startsWith('/uploads/')) {
    const name = raw.slice('/uploads/'.length);
    if (!UPLOAD_NAME.test(name)) return false;

    try {
      await fs.unlink(path.join(UPLOAD_DIR, name));
      return true;
    } catch {
      return false;
    }
  }

  const config = cloudinaryConfig();
  if (!config) return false;

  const publicId = publicIdFromUrl(raw, config);
  if (!publicId) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signCloudinary({ public_id: publicId, timestamp }, config.apiSecret);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature,
  });

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok || (data.result !== 'ok' && data.result !== 'not found')) {
      console.error(
        `[uploads] Cloudinary delete failed: ${response.status} ${data?.error?.message ?? data?.result ?? ''}`,
      );
      return false;
    }

    // "not found" means the asset is already gone, which is the outcome we wanted.
    return true;
  } catch (err) {
    console.error('[uploads] Cloudinary delete failed:', err.message);
    return false;
  }
}
