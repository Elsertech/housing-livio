
import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// LIVIO Supabase connection
const SUPABASE_URL = "https://kmaelcrwqdymhnecjnjl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aMqKABzxZG-0E4uVBtdkig_-4d8FJm0";

// Create Supabase client
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
