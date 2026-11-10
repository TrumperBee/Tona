// GCC — organiser logo upload and removal.
//
// The browser sends bytes, never a URL. The server verifies the real file type
// by magic bytes, uploads to Cloudinary with server credentials under
// gcc/organisers/{uid}, builds the delivery URL itself and writes it to the
// organiser profile document. Mirrors the avatar route.
import { NextResponse, type NextRequest } from "next/server";

import { AuthenticationError, AuthorizationError, requireRole } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http/respond";
import { ensureOrganiserProfile } from "@/lib/organiser/profile";
import {
  clearOrganiserLogoReference,
  OrganiserProfileError,
  storeOrganiserLogoReference,
} from "@/lib/organiser/profile";
import { assertPlatformWritable, PlatformWriteBlockedError } from "@/lib/platform/settings";
import {
  CloudinaryConfigError,
  destroyAvatar,
  uploadOrganiserLogo,
} from "@/lib/profile/cloudinary";
import { detectImageType, MAX_AVATAR_BYTES } from "@/lib/profile/image";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { assertSameOrigin, SameOriginError } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const LOGO_RATE_LIMIT = { limit: 5, windowSeconds: 3600 } as const;

async function authorisedOrganiser(
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
    const user = await requireRole("organiser");
    await assertPlatformWritable(user);
    return { ok: true, uid: user.userId };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, response: jsonError("Sign in to change your logo.", 401) };
    }

    if (error instanceof AuthorizationError) {
      return { ok: false, response: jsonError("Organiser access is required.", 403) };
    }

    if (error instanceof PlatformWriteBlockedError) {
      return { ok: false, response: jsonError(error.message, 503) };
    }

    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorisedOrganiser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy(
      "organiser:logo",
      auth.uid,
      LOGO_RATE_LIMIT.limit,
      LOGO_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!limit.allowed) {
    return jsonError("Too many logo uploads. Try again later.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return jsonError("Send the image as multipart form data.", 400);
  }

  const file = form.get("logo");

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

  // The profile document must exist (with an organisation name) before it can
  // carry a logo, so the public page never renders an unnamed organisation.
  const profile = await ensureOrganiserProfile(auth.uid);

  if (!profile) {
    return jsonError("Save your organisation name before uploading a logo.", 409);
  }

  try {
    const stored = await uploadOrganiserLogo(auth.uid, bytes, detectedType);
    await storeOrganiserLogoReference(auth.uid, { url: stored.url, publicId: stored.publicId });

    return NextResponse.json({ ok: true, logoUrl: stored.url });
  } catch (error) {
    if (error instanceof CloudinaryConfigError) {
      return jsonError(error.message, 503);
    }

    if (error instanceof OrganiserProfileError) {
      return jsonError(error.message, 404);
    }

    return jsonError("We could not save that image. Try again.", 502);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await authorisedOrganiser(request);

  if (!auth.ok) {
    return auth.response;
  }

  const limit = await checkRateLimit(
    rateLimitPolicy(
      "organiser:logo",
      auth.uid,
      LOGO_RATE_LIMIT.limit,
      LOGO_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!limit.allowed) {
    return jsonError("Too many logo changes. Try again later.", 429, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  try {
    const publicId = await clearOrganiserLogoReference(auth.uid);

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
    if (error instanceof OrganiserProfileError) {
      return jsonError(error.message, 404);
    }

    return jsonError("We could not remove your logo. Try again.", 500);
  }
}
