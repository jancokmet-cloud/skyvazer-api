import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // nutné pre prácu s file upload

export async function POST(req: Request) {
  try {
    // validácia JWT
    const auth = req.headers.get("authorization");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = auth.replace("Bearer ", "");

    // rozparsovanie multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = `${Date.now()}-${file.name}`;

    // upload do Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(fileName, file, {
        contentType: "audio/mpeg",
      });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // create public URL
    const { data: urlData } = supabase.storage
      .from("tracks")
      .getPublicUrl(fileName);

    // uloženie metadát
    await supabase.from("tracks").insert({
      title,
      filename: fileName,
      url: urlData.publicUrl,
    });

    return NextResponse.json({ ok: true, url: urlData.publicUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
