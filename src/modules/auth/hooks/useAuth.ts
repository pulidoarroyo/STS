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
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    return { user, profile, loading };
}