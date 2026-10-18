"use client";

import { useEffect, useState } from "react";

import type { ParkingLot } from "@/data/parking-lot";

type ParkingLotResponse = {
  parkingLot: ParkingLot | null;
  role: "admin" | "operator";
};

type ParkingConfigurationProps = {
  initialRole: "admin" | "operator";
};

type FormValues = {
  address: string;
  columns: string;
  name: string;
  rows: string;
};

const EMPTY_FORM: FormValues = {
  address: "",
  columns: "",
  name: "",
  rows: "",
};

function createFormValues(parkingLot: ParkingLot | null): FormValues {
  if (!parkingLot) {
    return EMPTY_FORM;
  }

  return {
    address: parkingLot.address ?? "",
    columns: String(parkingLot.columns),
    name: parkingLot.name,
    rows: String(parkingLot.rows),
  };
}

function statusLabel(status: ParkingLot["spots"][number]["status"]): string {
  const labels = {
    available: "Disponible",
    occupied: "Ocupado",
    out_of_service: "Fuera de servicio",
  };

  return labels[status];
}

function statusClassName(status: ParkingLot["spots"][number]["status"]): string {
  const styles = {
    available: "border-emerald-300 bg-emerald-50 text-emerald-900",
    occupied: "border-amber-300 bg-amber-50 text-amber-900",
    out_of_service: "border-slate-300 bg-slate-100 text-slate-700",
  };

  return styles[status];
}

export function ParkingConfiguration({
  initialRole,
}: ParkingConfigurationProps) {
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [parkingLot, setParkingLot] = useState<ParkingLot | null>(null);
  const [role, setRole] = useState(initialRole);

  async function loadParkingLot() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/parking-lot", { cache: "no-store" });
      const payload: unknown = await response.json();

      if (!response.ok || !isParkingLotResponse(payload)) {
        throw new Error("No fue posible cargar la configuración.");
      }

      setParkingLot(payload.parkingLot);
      setFormValues(createFormValues(payload.parkingLot));
      setRole(payload.role);
    } catch {
      setMessage("No fue posible cargar la configuración. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadParkingLot();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const rows = Number(formValues.rows);
    const columns = Number(formValues.columns);

    try {
      const response = await fetch("/api/parking-lot", {
        body: JSON.stringify({
          address: formValues.address,
          columns,
          name: formValues.name,
          rows,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isParkingLotMutationResponse(payload)) {
        const errorMessage = isMessageResponse(payload)
          ? payload.message
          : "No fue posible guardar la configuración.";
        throw new Error(errorMessage);
      }

      setParkingLot(payload.parkingLot);
      setFormValues(createFormValues(payload.parkingLot));
      setMessage("Configuración guardada correctamente.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la configuración.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando configuración…</p>;
  }

  const canConfigure = role === "admin";
  const hasGrid = parkingLot !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Configuración del parqueadero</h2>
        {canConfigure ? (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium">
              Nombre
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                maxLength={120}
                onChange={(event) => updateField("name", event.target.value)}
                required
                value={formValues.name}
              />
            </label>
            <label className="block text-sm font-medium">
              Dirección <span className="text-muted-foreground">(opcional)</span>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                maxLength={255}
                onChange={(event) => updateField("address", event.target.value)}
                value={formValues.address}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Filas
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted"
                  disabled={hasGrid}
                  max="26"
                  min="1"
                  onChange={(event) => updateField("rows", event.target.value)}
                  required
                  type="number"
                  value={formValues.rows}
                />
              </label>
              <label className="block text-sm font-medium">
                Columnas
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:bg-muted"
                  disabled={hasGrid}
                  max="100"
                  min="1"
                  onChange={(event) => updateField("columns", event.target.value)}
                  required
                  type="number"
                  value={formValues.columns}
                />
              </label>
            </div>
            {hasGrid ? (
              <p className="text-xs text-muted-foreground">
                Las dimensiones se bloquean al crear los puestos para conservar
                la integridad de las sesiones futuras.
              </p>
            ) : null}
            <button
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Guardando…" : hasGrid ? "Actualizar datos" : "Crear cuadrícula"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Solo un administrador puede configurar el parqueadero.
          </p>
        )}
        {message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}
      </section>

      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Puestos</h2>
        {!parkingLot ? (
          <p className="mt-3 text-muted-foreground">
            Aún no hay una cuadrícula configurada.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {parkingLot.name} · {parkingLot.rows} filas × {parkingLot.columns} columnas
            </p>
            <div
              aria-label="Cuadrícula de puestos"
              className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-3"
            >
              {parkingLot.spots.map((spot) => (
                <article
                  className={`rounded-md border p-3 text-sm ${statusClassName(spot.status)}`}
                  key={spot.id}
                >
                  <p className="font-semibold">{spot.spotNumber}</p>
                  <p className="mt-1 text-xs">{statusLabel(spot.status)}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function isMessageResponse(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function isParkingLotMutationResponse(
  value: unknown,
): value is { parkingLot: ParkingLot } {
  return (
    typeof value === "object" &&
    value !== null &&
    "parkingLot" in value &&
    value.parkingLot !== null
  );
}

function isParkingLotResponse(value: unknown): value is ParkingLotResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "parkingLot" in value &&
    "role" in value &&
    (value.role === "admin" || value.role === "operator")
  );
}
