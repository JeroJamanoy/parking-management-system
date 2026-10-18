import { ParkingConfiguration } from "@/components/domain/ParkingConfiguration";
import { getUserProfile } from "@/data/users";
import { createClient } from "@/lib/supabase/server";

export default async function SpotsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const profile = userId ? await getUserProfile(supabase, userId) : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Parqueadero</h1>
      <p className="mt-2 text-muted-foreground">
        Configura la cuadrícula inicial y consulta el estado de los puestos.
      </p>
      <div className="mt-8">
        <ParkingConfiguration initialRole={profile?.role ?? "operator"} />
      </div>
    </main>
  );
}
