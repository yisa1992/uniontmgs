import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserByUsername, verifyPassword } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { password } = await req.json();
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await getUserByUsername(session.username);
    if (!user || !user.active) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    if (!verifyPassword(user, password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
