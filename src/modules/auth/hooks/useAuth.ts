// src/modules/auth/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAuth() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    // Fetch profile without blocking the loading state
                    supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()
                        .then(({ data, error }) => {
                            if (!error && data) setProfile(data);
                        });
                } else {
                    setUser(null);
                    setProfile(null);
                }
                // Always set loading false after the first event fires
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    return { user, profile, loading };
}