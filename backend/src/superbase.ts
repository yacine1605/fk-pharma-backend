import { config } from "dotenv";

import { createClient } from "@supabase/supabase-js";
config({ path: ".env" });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
