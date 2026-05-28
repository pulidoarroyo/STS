import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase Environment Variables inside .env.local');
}

// Initialize a single, reusable Supabase client instance
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Disable session persistence to avoid stale cookies across reloads
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    }
});