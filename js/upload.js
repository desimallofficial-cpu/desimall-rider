/** DesiMall client-side image validation, compression, preview and Drive upload. */
const DesiMallUpload = (() => {
  const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
  const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function validate(file) {
    if (!file) throw new Error('Please choose an image.');
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Only JPG, PNG and WEBP images are allowed.');
    if (file.size > MAX_SOURCE_BYTES) throw new Error('Image size must be below 8 MB.');
    return true;
  }

  function preview(file, imageElement) {
    validate(file);
    const reader = new FileReader();
    reader.onload = () => {
      imageElement.src = String(reader.result || '');
      imageElement.hidden = false;
    };
    reader.onerror = () => {
      throw new Error('Image preview could not be created.');
    };
    reader.readAsDataURL(file);
  }

  async function compress(file) {
    validate(file);
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = 0.82;
    let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    }
    if (!blob) throw new Error('Image compression failed.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Image could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadProductImage(file) {
    const prepared = await compress(file);
    const Base64Data = await toBase64(prepared);
    const session = JSON.parse(localStorage.getItem('desimall_seller_session') || '{}');
    const result = await DesiMallAPI.uploadProductImage({
      Token: session.token || '',
      FileName: prepared.name,
      MimeType: prepared.type,
      Base64Data
    });
    if (!result.success) {
      const detail = result.error ? ` (${result.error})` : '';
      throw new Error((result.message || 'Image upload failed.') + detail);
    }
    return result;
  }

  return { validate, preview, compress, uploadProductImage };
})();
