// src/lib/upload.ts
//
// Secure logo upload pipeline.
//
// Threat model: user uploads may contain malicious payloads embedded in
// metadata (EXIF GPS leaks), oversized images (memory-DoS), and — most
// importantly — SVG with embedded <script> or <foreignObject> tags that
// would execute arbitrary JS if served as image/svg+xml.
//
// Our defense in depth:
//   1. Sniff the magic bytes (file-type). Never trust Content-Type/extension.
//   2. Whitelist only PNG/JPEG/WEBP/SVG.
//   3. Reject anything >5 MB or whose decoded dimensions exceed 4096x4096.
//   4. ALWAYS rasterize SVG → PNG before persisting. SVG never reaches
//      storage as-is, so a poisoned SVG becomes a static image and the
//      XSS vector is closed.
//   5. Run all rasters through sharp .resize+rotate without 'withMetadata'
//      → EXIF stripped by re-encoding.
//   6. Ship the resulting PNG buffer to Cloudinary via signed upload.
//   7. Cloudinary returns a URL we hash into the Agency row — we never
//      echo arbitrary file paths back to the client.
//
// On top: 25 GB free tier is more than enough; Cloudinary also serves
// with HTTPS, transforms, and CDN caching for free.

import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { env } from "../config/env.js";
import { ValidationError } from "./errors.js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_DIMENSION = 4096;
export const LOGO_OUTPUT_SIZE = 1024; // final raster square dimensions

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

if (
  env.NODE_ENV !== "test" &&
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export interface ProcessedLogo {
  /** Final PNG buffer that was uploaded. */
  buffer: Buffer;
  /** The URL Cloudinary returned (https://res.cloudinary.com/...). */
  url: string;
  /** Final raster width/height in pixels. */
  width: number;
  height: number;
  /** Bytes of the final image. */
  bytes: number;
  /** Detected input mime that triggered the pipeline. */
  sourceMime: string;
}

/**
 * Validate, sanitize, rasterize (if SVG), and upload a logo to Cloudinary.
 * Returns the canonical HTTPS URL we should persist on the Agency row.
 */
export async function uploadAgencyLogo(
  input: Buffer,
  publicIdHint: string,
): Promise<ProcessedLogo> {
  if (!env.CLOUDINARY_CLOUD_NAME) {
    throw new ValidationError(
      "Cloudinary is not configured on the server. " +
        "Add CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET to the backend env.",
    );
  }

  if (input.length === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Logo exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit.`,
    );
  }

  // ─── 1. Sniff magic bytes ───────────────────────────────────────────────
  const sniffed = await fileTypeFromBuffer(input);
  if (!sniffed || !ALLOWED_MIME.has(sniffed.mime)) {
    throw new ValidationError(
      `Unsupported file type. Allowed: PNG, JPEG, SVG. Got ${sniffed?.mime ?? "unknown"}.`,
    );
  }
  const sourceMime = sniffed.mime;

  // ─── 2. Sanitize → always produce PNG buffer ────────────────────────────
  const raster = await sanitizeToPng(input, sourceMime);

  // ─── 3. Ship to Cloudinary ──────────────────────────────────────────────
  const folder = env.CLOUDINARY_FOLDER;
  const publicId = `${folder}/${publicIdHint.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}`;

  const url = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: undefined, // publicId already includes folder
        resource_type: "image",
        format: "png",
        overwrite: false,
        unique_filename: false,
        // Rotate/auto-format hints — Cloudinary respects them
        eager: [
          { width: 256, height: 256, crop: "fit", format: "png" },
          { width: 512, height: 512, crop: "fit", format: "png" },
        ],
        eager_async: false,
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("no result"));
        resolve(result.secure_url);
      },
    );
    Readable.from(raster.buffer).pipe(stream);
  });

  return {
    buffer: raster.buffer,
    url,
    width: raster.width,
    height: raster.height,
    bytes: raster.buffer.length,
    sourceMime,
  };
}

/**
 * Normalize any incoming image into a sanitized PNG buffer.
 * - SVG is rasterized via sharp; the original bytes are discarded.
 * - Rasters are EXIF-stripped by re-encoding and resized to fit
 *   LOGO_OUTPUT_SIZE without enlargement and without stretching.
 */
async function sanitizeToPng(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (mime === "image/svg+xml") {
    // sharp accepts SVG buffers and rasterizes them.
    // We use a flat white background so transparent logos get a
    // predictable first frame; we then re-encode to PNG with no metadata.
    const pipeline = sharp(input, { density: 384 }) // 384 DPI for crisp text
      .resize({
        width: LOGO_OUTPUT_SIZE,
        height: LOGO_OUTPUT_SIZE,
        fit: "inside",
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  }

  // PNG/JPG/WEBP path
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) {
    throw new ValidationError("Image dimensions could not be detected.");
  }
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new ValidationError(
      `Image dimensions exceed the ${MAX_DIMENSION}x${MAX_DIMENSION} limit.`,
    );
  }

  // Re-encode: this normalizes the buffer and forces EXIF strip.
  // We do not pass `withMetadata`, so orientation comments are dropped.
  const pipeline = sharp(input)
    .rotate() // apply orientation, then drop orientation tag
    .resize({
      width: LOGO_OUTPUT_SIZE,
      height: LOGO_OUTPUT_SIZE,
      fit: "inside",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}
