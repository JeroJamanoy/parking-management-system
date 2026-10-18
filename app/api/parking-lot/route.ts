import { NextResponse } from "next/server";

import { configureParkingLot, getParkingLot } from "@/data/parking-lot";
import { getUserProfile } from "@/data/users";
import { canConfigureParking } from "@/domain/authorization";
import { createClient } from "@/lib/supabase/server";
import { parkingLotConfigurationSchema } from "@/lib/validation/parking-lot";

const UNAUTHORIZED_MESSAGE = "Debes iniciar sesión para realizar esta acción.";
const FORBIDDEN_MESSAGE = "No tienes permisos para realizar esta acción.";

async function getActiveProfile() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) {
    return { profile: null, supabase, unauthenticated: true };
  }

  const profile = await getUserProfile(supabase, userId);

  return { profile, supabase, unauthenticated: false };
}

export async function GET() {
  const { profile, supabase, unauthenticated } = await getActiveProfile();

  if (unauthenticated) {
    return NextResponse.json({ message: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }

  if (!profile || !profile.isActive) {
    return NextResponse.json({ message: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  const parkingLot = await getParkingLot(supabase);

  return NextResponse.json({ parkingLot, role: profile.role });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "La configuración enviada no es válida." },
      { status: 400 },
    );
  }

  const parsedInput = parkingLotConfigurationSchema.safeParse(payload);

  if (!parsedInput.success) {
    return NextResponse.json(
      { message: "Revisa los datos de configuración e inténtalo de nuevo." },
      { status: 400 },
    );
  }

  const { profile, supabase, unauthenticated } = await getActiveProfile();

  if (unauthenticated) {
    return NextResponse.json({ message: UNAUTHORIZED_MESSAGE }, { status: 401 });
  }

  if (!profile || !profile.isActive || !canConfigureParking(profile.role)) {
    return NextResponse.json({ message: FORBIDDEN_MESSAGE }, { status: 403 });
  }

  const { errorCode, parkingLot } = await configureParkingLot(
    supabase,
    parsedInput.data,
  );

  if (errorCode === "PARKING_LOT_GRID_DIMENSIONS_IMMUTABLE") {
    return NextResponse.json(
      {
        message:
          "La cuadrícula ya está creada. Sus dimensiones no se pueden cambiar.",
      },
      { status: 409 },
    );
  }

  if (errorCode) {
    return NextResponse.json(
      { message: "No fue posible guardar la configuración." },
      { status: 500 },
    );
  }

  return NextResponse.json({ parkingLot });
}
