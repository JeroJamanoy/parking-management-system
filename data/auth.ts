import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginCredentials = {
  email: string;
  password: string;
};

export async function signInWithPassword(
  client: SupabaseClient,
  credentials: LoginCredentials,
) {
  return client.auth.signInWithPassword(credentials);
}
