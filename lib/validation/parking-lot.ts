import { z } from "zod";

const optionalAddressSchema = z
  .string()
  .trim()
  .max(255, "La dirección no puede superar 255 caracteres.")
  .transform((value) => value || null);

export const parkingLotConfigurationSchema = z.object({
  address: optionalAddressSchema,
  columns: z
    .number()
    .int("Las columnas deben ser un número entero.")
    .min(1, "Debe haber al menos una columna.")
    .max(100, "No se admiten más de 100 columnas."),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "El nombre no puede superar 120 caracteres."),
  rows: z
    .number()
    .int("Las filas deben ser un número entero.")
    .min(1, "Debe haber al menos una fila.")
    .max(26, "No se admiten más de 26 filas."),
});

export type ParkingLotConfigurationInput = z.infer<
  typeof parkingLotConfigurationSchema
>;
