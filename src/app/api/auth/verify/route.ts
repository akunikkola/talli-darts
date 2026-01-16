import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    // Get the password from environment variable
    const correctPassword = process.env.LOGIN_PASSWORD;

    if (!correctPassword) {
      console.error("LOGIN_PASSWORD environment variable not set");
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    // Simple string comparison (case-sensitive)
    const isValid = password === correctPassword;

    return NextResponse.json({ success: isValid });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
