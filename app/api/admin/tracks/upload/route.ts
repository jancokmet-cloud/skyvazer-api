import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

// 👇 toto opraví CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// MAIN POST HANDLER
export async function POST(req: Request) {
  try {
    // CORS hlavičky pre POST odpoveď
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Autorizácia
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401, headers: corsHeaders }
      );
    }

    // MP3 PARSING
    const form = formidable({ multiples: false, maxFileSize: 30 * 1024 * 1024 });

    const data = await new Promise((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const { file } = data.files as any;
    const { title } = data.fields as any;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400, headers: corsHeaders }
      );
    }

    // UPLOAD DO SUPABASE
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const mp3Bytes = fs.readFileSync(file.filepath);

    const uploadResult = await supabase.storage
      .from("tracks")
      .upload(`tracks/${file.originalFilename}`, mp3Bytes);

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, title },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
