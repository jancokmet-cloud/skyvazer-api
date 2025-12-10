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

export const runtime = "nodejs"; // DÔLEŽITÉ! bez tohto upload NEFUNGUJE

export async function POST(req: Request) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Autorizácia
  const auth = req.headers.get("authorization");
  if (!auth) {
    return NextResponse.json(
      { error: "Missing Authorization header" },
      { status: 401, headers: cors }
    );
  }

  try {
    // ⬅️ NATÍVNE PARSOVANIE MULTIPART FORM DATA
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const title = form.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400, headers: cors }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Upload do Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await supabase.storage
      .from("tracks")
      .upload(`tracks/${file.name}`, fileBuffer, {
        contentType: file.type,
      });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500, headers: cors }
      );
    }

    return NextResponse.json(
      {
        success: true,
        path: result.data.path,
        title,
      },
      { status: 200, headers: cors }
    );
  } catch (err) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json(
      { error: "Upload failed", detail: String(err) },
      { status: 500, headers: cors }
    );
  }
}
