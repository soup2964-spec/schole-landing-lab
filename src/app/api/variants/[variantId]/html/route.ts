import { NextResponse } from "next/server";
import { findVariant } from "@/lib/registry";
import { renderVariantHtml } from "@/lib/replica/render-variant-html";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const { variantId } = await params;
  const variant = await findVariant(variantId);
  if (!variant) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const html = renderVariantHtml(variant);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=0, must-revalidate",
    },
  });
}
