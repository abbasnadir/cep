import { createClient } from '@supabase/supabase-js';

// Create a supabase client to connect with database
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANONKEY!
)