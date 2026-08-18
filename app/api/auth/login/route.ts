import { NextResponse } from "next/server";

import { signInWithPassword } from "@/data/auth";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

const INVALID_CREDENTIALS_MESSAGE =
  "No fue posible iniciar sesión con esas credenciales.";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: INVALID_CREDENTIALS_MESSAGE },
      { status: 400 },
    );
  }

  const parsedInput = loginSchema.safeParse(payload);

  if (!parsedInput.success) {
    return NextResponse.json(
      { message: INVALID_CREDENTIALS_MESSAGE },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await signInWithPassword(supabase, parsedInput.data);

  if (error) {
    return NextResponse.json(
      { message: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 },
    );
  }

  return NextResponse.json({ redirectTo: "/dashboard" });
}
