import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParkingLotConfigurationInput } from "@/lib/validation/parking-lot";

export type ParkingSpot = {
  id: string;
  outOfServiceReason: string | null;
  spotNumber: string;
  status: "available" | "occupied" | "out_of_service";
  vehicleType: string | null;
};

export type ParkingLot = {
  address: string | null;
  columns: number;
  id: string;
  name: string;
  rows: number;
  spots: ParkingSpot[];
};

type ParkingLotRow = {
  address: string | null;
  columns: number;
  id: string;
  name: string;
  parking_spots: ParkingSpotRow[] | null;
  rows: number;
};

type ParkingSpotRow = {
  id: string;
  out_of_service_reason: string | null;
  spot_number: string;
  status: ParkingSpot["status"];
  vehicle_type: string | null;
};

type ConfiguredParkingLotRow = Omit<ParkingLotRow, "parking_spots">;

function compareSpotNumbers(left: ParkingSpot, right: ParkingSpot): number {
  return left.spotNumber.localeCompare(right.spotNumber, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function toParkingLot(row: ParkingLotRow): ParkingLot {
  return {
    address: row.address,
    columns: row.columns,
    id: row.id,
    name: row.name,
    rows: row.rows,
    spots: (row.parking_spots ?? [])
      .map((spot) => ({
        id: spot.id,
        outOfServiceReason: spot.out_of_service_reason,
        spotNumber: spot.spot_number,
        status: spot.status,
        vehicleType: spot.vehicle_type,
      }))
      .sort(compareSpotNumbers),
  };
}

export async function getParkingLot(
  client: SupabaseClient,
): Promise<ParkingLot | null> {
  const { data, error } = await client
    .from("parking_lots")
    .select(
      "id, name, address, rows, columns, parking_spots(id, spot_number, vehicle_type, status, out_of_service_reason)",
    )
    .limit(1)
    .maybeSingle<ParkingLotRow>();

  if (error || !data) {
    return null;
  }

  return toParkingLot(data);
}

export async function configureParkingLot(
  client: SupabaseClient,
  input: ParkingLotConfigurationInput,
): Promise<{ errorCode: string | null; parkingLot: ParkingLot | null }> {
  const { data, error } = await client
    .rpc("configure_parking_lot", {
      grid_columns: input.columns,
      grid_rows: input.rows,
      parking_lot_address: input.address,
      parking_lot_name: input.name,
    })
    .single<ConfiguredParkingLotRow>();

  if (error || !data) {
    return { errorCode: error?.message ?? null, parkingLot: null };
  }

  const parkingLot = await getParkingLot(client);

  return { errorCode: null, parkingLot };
}
