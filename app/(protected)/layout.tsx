import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getUserProfile } from "@/data/users";
import { createClient } from "@/lib/supabase/server";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const supabase = await createClient();
  const {
    data: claimsData,
    error,
  } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (error || !userId) {
    redirect("/login");
  }

  const profile = await getUserProfile(supabase, userId);

  if (!profile || !profile.isActive) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-medium">Parking Management System</p>
            <p className="text-xs text-muted-foreground">
              {profile.fullName ?? "Usuario"} · {profile.role}
            </p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
              type="submit"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
