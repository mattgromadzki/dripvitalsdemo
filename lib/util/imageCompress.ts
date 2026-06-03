"use client";

/**
 * Read a user-uploaded image File and return a compressed base64 data URL.
 * - Max edge `maxDim` (default 480px) — preserves aspect ratio.
 * - JPEG quality `quality` (default 0.78) — good balance for product photos.
 *
 * This keeps thumbnails small (~25–60 KB each) so localStorage doesn't blow
 * past the typical 5–10 MB per-origin quota even with many treatments.
 */
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

  // Compute scaled dimensions while preserving aspect ratio.
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width  = maxDim;
    } else {
      width  = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(img, 0, 0, width, height);

  // PNG keeps transparency but is much larger. JPEG is fine for product photos.
  const mime = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  return canvas.toDataURL(mime, quality);
}
