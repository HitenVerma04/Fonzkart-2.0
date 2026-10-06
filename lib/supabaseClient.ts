import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Used only for live notification updates (components/NotificationProvider.tsx). Optional: without the two
// variables (e.g. a deployment with plain PostgreSQL and no Supabase) this is null and the bell polls instead.
export const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
