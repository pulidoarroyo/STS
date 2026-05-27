'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/modules/auth/hooks/useAuth';

export default function LoginPage() {
    const { user, loading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && user) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (user) {
        return null;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("🛠️ 1. Iniciando autenticación...");

            // Test A: Does Supabase Auth work?
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                console.error("❌ Auth Error:", authError);
                throw new Error(`Auth Error: ${authError.message}`);
            }

            console.log("✅ 2. Auth exitosa. ID de usuario:", authData.user?.id);

            if (authData?.user) {
                console.log("🛠️ 3. Buscando perfil en la base de datos...");

                // Test B: Fetching strictly as an array to expose duplicates
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', authData.user.id);

                if (profileError) {
                    console.error("❌ Profile DB Error:", profileError);
                    throw new Error(`Database Error: ${profileError.message}`);
                }

                console.log("✅ 4. Datos de perfil recibidos:", profileData);

                if (!profileData || profileData.length === 0) {
                    throw new Error("El login funcionó, pero no existe un perfil en la tabla 'profiles'.");
                }

                if (profileData.length > 1) {
                    console.warn("⚠️ ADVERTENCIA: ¡Se encontraron perfiles duplicados para este usuario!");
                }

                const userRole = profileData[0].role;
                console.log("🚀 5. Redirigiendo según el rol:", userRole);

                // Redirect all roles to the dashboard
                router.push('/dashboard');
            }
        } catch (err: any) {
            console.error("🔥 Error capturado:", err);
            setError(err.message || 'Error desconocido al iniciar sesión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md border border-gray-100">
                <div>
                    <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                        Iniciar Sesión
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Ingresa a tu panel de control de soporte
                    </p>
                </div>

                {error && (
                    <div className="p-4 rounded-md text-sm bg-red-50 text-red-700 border border-red-200">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="usuario@empresa.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                                }`}
                        >
                            {loading ? 'Autenticando...' : 'Ingresar'}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                            ¿No tienes una cuenta? Regístrate aquí
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}