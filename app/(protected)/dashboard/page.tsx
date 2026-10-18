import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        La autenticación y autorización base están activas. Las métricas se
        implementarán en una fase posterior.
      </p>
      <Link
        className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        href="/spots"
      >
        Configurar parqueadero
      </Link>
    </main>
  );
}
