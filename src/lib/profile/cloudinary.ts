// GCC - Cloudinary avatar storage (server only).
//
// The browser uploads bytes to our route; the route validates them and sends
// them to Cloudinary with the server credentials. The client never receives an
// API key, a signature or a client-supplied URL.
import "server-only";

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import { getServerEnv } from "@/lib/config/env.server";

let configured = false;

export class CloudinaryConfigError extends Error {
  readonly status = 503;

  constructor() {
    super(
      "Avatar upload is not configured. Set CLOUDINARY_CLOUD_NAME, " +
        "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the server.",
    );
    this.name = "CloudinaryConfigError";
  }
}

function getCloudinary() {
  const env = getServerEnv();

  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new CloudinaryConfigError();
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

export interface StoredAvatar {
  readonly publicId: string;
  readonly url: string;
}

/** Replaces (or creates) the avatar for a UID. */
export async function uploadAvatar(
  uid: string,
  bytes: Buffer,
  mimeType: string,
): Promise<StoredAvatar> {
  const client = getCloudinary();
  const publicId = `gcc/avatars/${uid}`;

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        format: mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg",
      },
      (error, response) => {
        if (error || !response) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve(response);
      },
    );

    stream.end(bytes);
  });

  return {
    publicId: result.public_id,
    url: client.url(result.public_id, {
      secure: true,
      transformation: [{ fetch_format: "auto", quality: "auto" }],
    }),
  };
}

/** Best-effort removal. A missing asset is treated as success. */
export async function destroyAvatar(publicId: string): Promise<void> {
  const client = getCloudinary();

  try {
    await client.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
  } catch {
    // Removing the database reference is more important than a remote cleanup
    // failure; the asset can be cleaned up later by an operator.
  }
}
