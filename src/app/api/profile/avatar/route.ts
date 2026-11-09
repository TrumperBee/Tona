// GCC — avatar upload and removal.
//
// The browser sends bytes, never a URL. The server verifies the real file type
// by magic bytes, uploads to Cloudinary with server credentials, builds the
// delivery URL itself and writes it to both profile documents.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, requireUser } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import { CloudinaryConfigError, destroyAvatar, uploadAvatar } from "@/lib/profile/cloudinary";
import { detectImageType, MAX_AVATAR_BYTES } from "@/lib/profile/image";
import {
  clearAvatarReference,
  ProfileUpdateError,
  storeAvatarReference,
} from "@/lib/profile/update";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const AVATAR_RATE_LIMIT = { limit: 5, windowSeconds: 3600 } as const;

async function authorisedUser(
  request: NextRequest,
): Promise<
  | { readonly ok: true; readonly uid: string }
  | { readonly ok: false; readonly response: NextResponse }
> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof SameOriginError) {
      return { ok: false, response: jsonError("Cross-origin request rejected.", 403) };
    }

    throw error;
  }

  try {
    const user = await requireUser();
    await assertPlatformWritable(user);
    return { ok: true, uid: user.userId };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, response: jsonError("Sign in to change your avatar.", 401) };
    }

    if (error instanceof PlatformWriteBlockedError) {
      return { ok: false, response: jsonError(error.message, 503) };
    }

    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorisedUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy(
      "profile:avatar",
      auth.uid,
      AVATAR_RATE_LIMIT.limit,
      AVATAR_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!limit.allowed) {
    return jsonError("Too many avatar uploads. Try again later.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return jsonError("Send the image as multipart form data.", 400);
  }

  const file = form.get("avatar");

  if (!(file instanceof File)) {
    return jsonError("Choose an image to upload.", 400);
  }

  if (file.size <= 0) {
    return jsonError("That image is empty.", 400);
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return jsonError("That image is too large. Choose a smaller image.", 413);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);

  if (!detectedType) {
    return jsonError("Use a JPEG, PNG or WebP image.", 415);
  }

  try {
    const stored = await uploadAvatar(auth.uid, bytes, detectedType);
    await storeAvatarReference(auth.uid, { url: stored.url, publicId: stored.publicId });

    return NextResponse.json({ ok: true, avatarUrl: stored.url });
  } catch (error) {
    if (error instanceof CloudinaryConfigError) {
      return jsonError(error.message, 503);
    }

    if (error instanceof ProfileUpdateError) {
      return jsonError(error.message, 404);
    }

    return jsonError("We could not save that image. Try again.", 502);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await authorisedUser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy(
      "profile:avatar",
      auth.uid,
      AVATAR_RATE_LIMIT.limit,
      AVATAR_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!limit.allowed) {
    return jsonError("Too many avatar changes. Try again later.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  try {
    const publicId = await clearAvatarReference(auth.uid);

    if (publicId) {
      try {
        await destroyAvatar(publicId);
      } catch (error) {
        if (error instanceof CloudinaryConfigError) {
          // The database reference is already cleared. Report a configuration
          // problem only when Cloudinary was never usable.
          return jsonError(error.message, 503);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProfileUpdateError) {
      return jsonError(error.message, 404);
    }

    return jsonError("We could not remove your avatar. Try again.", 500);
  }
}
