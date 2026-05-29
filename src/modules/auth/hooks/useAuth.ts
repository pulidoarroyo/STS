import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useAuth() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session active status
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error getting initial session:', err);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        // 2. Listen to dynamic auth state adjustments (Login / Logout events)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                try {
                    if (session) {
                        setUser(session.user);
                        await fetchProfile(session.user.id);
                    } else {
                        setUser(null);
                        setProfile(null);
                        setLoading(false);
                    }
                } catch (err) {
                    console.error('Error handling auth state change:', err);
                    setLoading(false);
                } finally {
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Fetch the extended business data profile from public.profiles
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error.message);
                return;
            }

            if (data) {
                setProfile(data);
            }
        } catch (err) {
            console.error('Exception fetching profile:', err);
        }
    };

    return { user, profile, loading };
}