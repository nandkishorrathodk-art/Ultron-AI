import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminPasswordHash) {
      return NextResponse.json(
        { error: "Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH in environment." },
        { status: 500 },
      );
    }

    if (email.toLowerCase() !== adminEmail.toLowerCase()) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, adminPasswordHash);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await createSession(email, "admin");

    return NextResponse.json({ success: true, email, role: "admin" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
