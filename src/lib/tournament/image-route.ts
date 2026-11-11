// GCC - shared tournament image upload handling.
//
// The cover and logo routes are thin wrappers around this module: guard,
// validate the uploaded bytes (type by magic bytes, size by the platform
// limit), push them to Cloudinary with server credentials under
// gcc/tournaments/{id}/{kind} and persist the reference through the
// editable-fields matrix. The browser never supplies a URL.
import { NextResponse, type NextRequest } from "next/server";

import { guardOrganiserMutation } from "@/lib/organiser/route-guard";
import {
  CloudinaryConfigError,
  uploadTournamentCover,
  uploadTournamentLogo,
} from "@/lib/profile/cloudinary";
import { detectImageType, MAX_AVATAR_BYTES } from "@/lib/profile/image";
import { checkRateLimit, rateLimitPolicy } from "@/lib/rate-limit";
import { TournamentMutationError } from "@/lib/tournament/errors";
import { storeTournamentImage, type TournamentImageKind } from "@/lib/tournament/images";

const IMAGE_RATE_LIMIT = { limit: 10, windowSeconds: 3600 } as const;

/** Shared POST body for both tournament image routes. */
export async function handleTournamentImageUpload(
  request: NextRequest,
  context: { readonly params: Promise<{ id: string }> },
  kind: TournamentImageKind,
): Promise<NextResponse> {
  const guard = await guardOrganiserMutation(request, `tournament-${kind}`, 10, 3600);

  if (!guard.ok) {
    return guard.response;
  }

  const rate = await checkRateLimit(
    rateLimitPolicy(
      `organiser:tournament-${kind}`,
      guard.user.userId,
      IMAGE_RATE_LIMIT.limit,
      IMAGE_RATE_LIMIT.windowSeconds,
    ),
  );

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many image uploads. Try again later.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const { id } = await context.params;

  if (!id || id.includes("/")) {
    return NextResponse.json({ error: "Invalid tournament." }, { status: 400 });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the image as multipart form data." }, { status: 400 });
  }

  const file = form.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "That image is empty." }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Choose a smaller image." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detectedType = detectImageType(bytes);

  if (!detectedType) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 415 });
  }

  try {
    const stored =
      kind === "cover"
        ? await uploadTournamentCover(id, bytes, detectedType)
        : await uploadTournamentLogo(id, bytes, detectedType);

    await storeTournamentImage(id, kind, { url: stored.url, publicId: stored.publicId });

    return NextResponse.json({ ok: true, url: stored.url });
  } catch (error) {
    if (error instanceof CloudinaryConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof TournamentMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "We could not save that image. Try again." },
      { status: 502 },
    );
  }
}
