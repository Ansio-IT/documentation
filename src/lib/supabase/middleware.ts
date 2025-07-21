
// Note: This file structure was provided by the user.
// A typical Supabase middleware might use createServerClient for session refresh.
// This version uses createBrowserClient, similar to the client-side utility.
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
