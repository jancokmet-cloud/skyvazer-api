export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// CORS pre preflight
export function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // 🔐 Autorizácia
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401, headers: cors }
      );
    }

    // 🔥 Native formData parsing (funguje v App Router)
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = form.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400, headers: cors }
      );
    }

    // Prevod File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const filename = `tracks/${Date.now()}-${file.name}`;

    // Upload do Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500, headers: cors }
      );
    }

    // Verejná URL
    const { data: publicUrlData } = supabase
      .storage.from("tracks")
      .getPublicUrl(filename);

    return NextResponse.json(
      {
        success: true,
        title,
        url: publicUrlData.publicUrl,
      },
      { status: 200, headers: cors }
    );
  } catch (err: any) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
