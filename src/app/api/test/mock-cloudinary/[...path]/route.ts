import { NextResponse, type NextRequest } from "next/server";

import { isE2EHarness } from "@/lib/test-harness";
import { getMockImage } from "@/lib/test-harness/mock-cloudinary";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (process.env.GCC_E2E !== "1" || !isE2EHarness()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { path } = await context.params;
  const publicId = decodeURIComponent(path.join("/"));
  const image = getMockImage(publicId);
  if (!image) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const bytes = new Uint8Array(image.bytes);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "no-store",
    },
  });
}
