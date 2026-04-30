// Cloudflare R2 client (S3-compatible).
//
// All access happens server-side: client uploads land in a Next.js
// server action, the action runs sharp to produce variants, then
// PUTs each variant into R2. Reads happen via a Cloudflare Worker
// that JWT-verifies and streams from R2 (no Vercel function in the
// bandwidth path).
//
// Env required (Vercel):
//   R2_ACCOUNT_ID         — Cloudflare account id
//   R2_ACCESS_KEY_ID      — R2 API token Access Key
//   R2_SECRET_ACCESS_KEY  — R2 API token Secret
//   R2_BUCKET_NAME        — bucket name, e.g. tgteknikcrm-attach
//   R2_PUBLIC_URL         — public read URL (custom domain or worker)
//                          e.g. https://cdn.tgteknikcrm.com

import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

export function r2Client(): S3Client {
  if (client) return client;
  if (!r2Configured()) {
    throw new Error(
      "R2 not configured: missing R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME",
    );
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

export interface PutR2Input {
  /** Full R2 key (no leading slash). E.g. `${userId}/${convId}/${ts}_${name}` */
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /** Long-lived immutable cache for variants. */
  cacheControl?: string;
}

export async function putR2Object(input: PutR2Input): Promise<void> {
  const cmd: PutObjectCommandInput = {
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.cacheControl ?? "public, max-age=31536000, immutable",
  };
  await r2Client().send(new PutObjectCommand(cmd));
}

/**
 * Image variants we pre-encode at upload time. Naming convention:
 *  - `<base>`           → original (untouched)
 *  - `<base>__200.webp` → 200px wide thumbnail (chat list, sidebar)
 *  - `<base>__600.webp` → 600px wide (inline chat preview)
 *  - `<base>__1200.webp`→ 1200px wide (lightbox / fullscreen)
 *
 * Worker accepts `?w=600` and maps it to `<base>__600.webp`. Anything
 * else falls back to `<base>` (the original).
 */
export const R2_IMAGE_VARIANTS = [200, 600, 1200] as const;
export type R2ImageVariant = (typeof R2_IMAGE_VARIANTS)[number];

export function r2VariantKey(baseKey: string, w: R2ImageVariant): string {
  return `${baseKey}__${w}.webp`;
}

/** Public URL for a stored object (used by AttachmentPreview). */
export function r2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}
