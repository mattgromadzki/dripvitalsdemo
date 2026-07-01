"use client";

// Compresses an image File to a reasonably-sized JPEG data URL, entirely in the
// browser, so we can store a patient's ID photo in the existing data store
// without a separate file/blob service. Returns a self-contained data URL.

export interface CompressedImage {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeKb: number;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = src;
  });
}

function sizeKbOf(dataUrl: string): number {
  const i = dataUrl.indexOf(",");
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.round((b64.length * 3) / 4 / 1024);
}

export async function compressImageFile(
  file: File,
  opts: { maxDim?: number; quality?: number; maxSizeKb?: number } = {},
): Promise<CompressedImage> {
  const maxDim = opts.maxDim ?? 1500;
  let quality = opts.quality ?? 0.82;
  const maxSizeKb = opts.maxSizeKb ?? 900;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG or PNG).");
  }

  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);

  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image on this device.");
  // White backing in case of transparency, so IDs don't render black areas.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let out = canvas.toDataURL("image/jpeg", quality);
  // Step the quality down if still too large, so storage stays well-bounded.
  while (sizeKbOf(out) > maxSizeKb && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  return { dataUrl: out, mimeType: "image/jpeg", width, height, sizeKb: sizeKbOf(out) };
}
