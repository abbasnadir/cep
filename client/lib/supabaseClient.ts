import { createClient } from "@supabase/supabase-js";

import { ENV } from "@/lib/env";

export const supabase = createClient(
  ENV.NEXT_PUBLIC_SUPABASE_URL,
  ENV.NEXT_PUBLIC_SUPABASE_ANONKEY,
);
