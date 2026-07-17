/* Supabase project settings — used only for sign-in and cross-device
   progress sync. The whole map, Log Book, and local progress work without
   it; leaving these as placeholders just disables auth/sync (the app falls
   back to localStorage-only, and the sign-in buttons no-op gracefully).

   The anon key is meant to be public — Supabase's security model is
   row-level security policies (see supabase/schema.sql), not key secrecy.

   Fill these in after creating a free project at supabase.com (Settings →
   API) and running supabase/schema.sql. */
export const SUPABASE_URL = 'https://reitaosjsouvmxaqbwmy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_xnHv_nopKpCd9ETrdYBxXQ_li4qNgps';

export const supabaseConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');
