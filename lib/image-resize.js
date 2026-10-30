/**
 * SHRINK IMAGES BEFORE UPLOAD  (browser only)
 * ===========================================
 * Patricia photographs her stock on a phone. A modern phone camera produces a
 * 3–5 MB JPEG about 4000px wide, and until now that exact file was uploaded and
 * then served, unchanged, to every customer. On a Honiara mobile connection one
 * product photo was a bigger download than the whole rest of the site.
 *
 * This resizes and re-encodes the picture IN HER BROWSER, before it is sent.
 * Doing it client-side rather than on the server is deliberate:
 *
 *   - It saves HER upload data too, not just the customer's download. She is on
 *     the same expensive island connection they are.
 *   - It needs no image library on the server (no `sharp`), so there is nothing
 *     with native binaries to compile on the host and nothing new to keep patched.
 *   - It cannot fail the upload: every branch below falls back to the original
 *     file rather than throwing, so a browser that cannot do this still works.
 *
 * SECURITY NOTE: this is a convenience, NOT a control. The server still sniffs
 * magic bytes and enforces its own size cap in lib/uploads.js, because anything
 * running in a browser can be bypassed by anyone posting to the route directly.
 *
 * PRIVACY BONUS: redrawing through a canvas discards EXIF metadata, so the GPS
 * coordinates of Patricia's home do not ship inside her product photos.
 *
 * Client components only — this touches `document` and `createImageBitmap`.
 */

/**
 * Product photos. 1200px is enough for the largest slot the site has (the
 * gallery's main image on a desktop), and WebP at 0.82 is visually clean while
 * typically landing under 150 KB.
 */
export const PRODUCT_IMAGE = { maxEdge: 1200, quality: 0.82 };

/** Member profile pictures. Never shown larger than a small circle. */
export const AVATAR_IMAGE = { maxEdge: 512, quality: 0.8 };

/** Promise wrapper around canvas.toBlob. Resolves null when encoding is refused. */
function encode(canvas, type, quality) {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/** Swap the extension so the stored name matches what we actually encoded. */
function rename(originalName, extension) {
  const base = String(originalName || 'photo').replace(/\.[^.]+$/, '');
  return `${base}.${extension}`;
}

/**
 * Shrink an image chosen from a file input.
 *
 * @param {File} file the file straight off the <input type="file">
 * @param {{ maxEdge: number, quality: number }} options PRODUCT_IMAGE or AVATAR_IMAGE
 * @returns {Promise<File>} a smaller file, or the original one unchanged if it
 *   was already small enough or the browser could not re-encode it
 */
export async function shrinkImageForUpload(file, { maxEdge, quality }) {
  // Not an image, or not a browser that can do this — hand back what we got and
  // let the server have the final say.
  if (!file || typeof file !== 'object' || typeof file.type !== 'string') return file;
  if (!file.type.startsWith('image/')) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    // `imageOrientation: 'from-image'` applies the EXIF rotation flag, so a photo
    // taken holding the phone sideways is not stored on its side. Browsers that
    // do not know the option ignore it.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // corrupt, or a format the browser cannot decode
  }

  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxEdge / longestEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close?.();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.(); // release the decoded pixels straight away — phones are tight on memory

  // WebP first: it is materially smaller than JPEG at the same quality, keeps
  // transparency, and every browser we care about can encode it.
  let blob = await encode(canvas, 'image/webp', quality);
  let extension = 'webp';

  if (!blob || blob.type !== 'image/webp') {
    // No WebP encoder. A PNG is left alone rather than flattened into JPEG,
    // because JPEG has no alpha channel and a transparent logo would come back
    // with a black box behind it.
    if (file.type === 'image/png') return file;

    blob = await encode(canvas, 'image/jpeg', quality);
    extension = 'jpg';
    if (!blob || blob.type !== 'image/jpeg') return file;
  }

  // An already-optimised small image can come out BIGGER after re-encoding.
  // Only accept the new version when it actually saved something.
  if (blob.size >= file.size) return file;

  return new File([blob], rename(file.name, extension), { type: blob.type });
}
