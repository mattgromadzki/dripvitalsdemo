// Reads an image File and returns a compressed data URL suitable for storing
// inline (e.g. as a treatment thumbnail).
//
// Why this is careful about size: thumbnails are stored INSIDE the treatments
// array, which is persisted to localStorage (~5 MB quota) and POSTed to the
// server (Vercel caps request bodies at ~4.5 MB). A single un-shrunk image can
// blow past those limits, and both persist paths swallow the resulting error —
// so the thumbnail silently fails to save. Two failure modes are fixed here:
//   1. PNG/unknown types are re-encoded to JPEG. canvas.toDataURL IGNORES the
//      quality arg for PNG, so PNG uploads were never actually compressed.
//   2. The output is iteratively shrunk (quality, then dimension) until it fits
//      under a small byte budget, so many thumbnails can coexist safely.

const TARGET_BYTES = 70 * 1024; // ~70 KB per thumbnail

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4); // base64 → bytes
}

export async function fileToCompressedDataURL(
  file: File,
  maxDim = 480,
  quality = 0.78,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image"));
    el.src = dataUrl;
  });

  // WebP supports lossy quality in toDataURL; everything else (incl. PNG) → JPEG
  // so the quality arg actually takes effect and transparency-free photos stay small.
  const mime = file.type === "image/webp" ? "image/webp" : "image/jpeg";

  function render(dim: number, q: number): string {
    let { width, height } = img;
    if (width > dim || height > dim) {
      if (width >= height) { height = Math.round((height * dim) / width); width = dim; }
      else { width = Math.round((width * dim) / height); height = dim; }
    }
    const canvas = document.createElement("canvas");
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(mime, q);
  }

  // Shrink quality first, then dimension, until under the byte budget.
  let dim = maxDim;
  let q = quality;
  let out = render(dim, q);
  let guard = 0;
  while (dataUrlBytes(out) > TARGET_BYTES && guard < 8) {
    if (q > 0.4) {
      q = Math.round((q - 0.12) * 100) / 100;
    } else if (dim > 200) {
      dim = Math.round(dim * 0.8);
      q = quality; // reset quality at the smaller dimension
    } else {
      break; // can't shrink further; accept what we have
    }
    out = render(dim, q);
    guard++;
  }
  return out;
}
