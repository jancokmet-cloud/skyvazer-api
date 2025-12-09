import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// COMMON HEADERS FOR ALL RESPONSES
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // môžeš neskôr zúžiť na localhost / vercel web
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase env vars missing");
  }

  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: "admin" },
      process.env.JWT_SECRET!,
      { expiresIn: "2h" }
    );

    return NextResponse.json(
      { token },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
}
