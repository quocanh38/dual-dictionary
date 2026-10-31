// Browser-only photo downscaler. Never imported by Node checks.
import { PHOTO_ACCEPTED_MIME, PHOTO_TARGET_MAX_DIM, validatePhotoInput } from './photo-request.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(Error('Could not read the photo.'));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    } catch {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch { reject(Error('Could not read the photo.')); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Error('Could not read the photo.')); };
      img.src = url;
    }
  });
}

export async function downscalePhoto(file, { maxDim = PHOTO_TARGET_MAX_DIM, quality = 0.85 } = {}) {
  const errors = validatePhotoInput(file);
  if (errors.length) throw Error(errors.join(' '));
  const bitmap = await createImageBitmap(file).catch(() => { throw Error('This browser cannot decode the photo.'); });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw Error('Could not compress the photo.');
  if (!PHOTO_ACCEPTED_MIME.includes(blob.type) && blob.type !== 'image/jpeg') throw Error('Unsupported photo output.');
  const dataUrl = await blobToDataUrl(blob);
  return { dataUrl, width, height, mime: blob.type };
}
