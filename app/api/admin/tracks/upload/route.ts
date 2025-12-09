import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

// 🔥 CORS hlavičky, ktoré budeme používať
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 🔥 OPTIONS request (preflight) — MUSÍME odpovedať 200
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    // 1) Overenie autorizácie
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = auth.replace("Bearer ", "");
    let decoded: any;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2) Prečítanie FormData z requestu
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = form.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Title missing" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3) Supabase server klient
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4) Generovanie názvu súboru
    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    // 5) File → Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 6) Upload do Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(filename, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json(
        { error: "Upload error" },
        { status: 500, headers: corsHeaders }
      );
    }

    // URL súboru
    const { data: urlData } = supabase
      .storage
      .from("tracks")
      .getPublicUrl(filename);

    // 7) Insert do DB
    await supabase.from("tracks").insert({
      title,
      filename,
      url: urlData.publicUrl,
      uploaded_by: decoded.email,
    });

    return NextResponse.json(
      { ok: true, url: urlData.publicUrl },
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
