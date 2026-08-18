import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserRole } from "@/domain/authorization";

export type UserProfile = {
  fullName: string | null;
  id: string;
  isActive: boolean;
  role: UserRole;
};

type UserProfileRow = {
  full_name: string | null;
  id: string;
  is_active: boolean;
  role: UserRole;
};

export async function getUserProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await client
    .from("users")
    .select("id, role, full_name, is_active")
    .eq("id", userId)
    .maybeSingle<UserProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    fullName: data.full_name,
    id: data.id,
    isActive: data.is_active,
    role: data.role,
  };
}
