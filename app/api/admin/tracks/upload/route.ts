import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export const runtime = "nodejs"; // potrebné pre form-data a filesystem

export async function POST(req: Request) {
  try {
    // 1) Overenie autorizácie
    const auth = req.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.replace("Bearer ", "");
    let decoded: any;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 2) Prečítanie FormData z requestu
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = form.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title missing" }, { status: 400 });
    }

    // 3) Supabase client (server-side, full access)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // plné práva
    );

    // 4) Generovanie názvu súboru
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    // 5) Konverzia File → Buffer (nutné pre upload)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 6) Upload do Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("tracks")
      .upload(fileName, buffer, {
        contentType: file.type || "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("UPLOAD ERROR:", uploadError);
      return NextResponse.json(
        { error: "Upload to storage failed" },
        { status: 500 }
      );
    }

    // 7) Získanie verejnej URL
    const { data: publicUrlData } = supabase.storage
      .from("tracks")
      .getPublicUrl(fileName);

    const url = publicUrlData.publicUrl;

    // 8) Uloženie záznamu do DB
    const { error: dbError } = await supabase.from("tracks").insert({
      title,
      filename: fileName,
      url,
      uploaded_by: decoded.email,
    });

    if (dbError) {
      console.error("DB ERROR:", dbError);
      return NextResponse.json(
        { error: "Database insert failed" },
        { status: 500 }
      );
    }

    // 9) Hotovo
    return NextResponse.json({ ok: true, url, filename: fileName });
  } catch (err: any) {
    console.error("GENERAL ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
