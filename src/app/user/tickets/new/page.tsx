'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute';
import { analyzeTicketWithAI } from '@/modules/ai/aiService';

// Definimos la estructura de la categoría para TypeScript
interface Category {
    id: string | number;
    name: string;
}

function NewTicketPage() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // 1. Cargar las categorías reales de Supabase al montar el componente
    useEffect(() => {
        async function fetchCategories() {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name')
                    .order('name', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0) {
                    setCategories(data);
                    setCategoryId(String(data[0].id)); // Inicializa con el ID de la primera categoría real
                }
            } catch (err: any) {
                console.error('Error cargando categorías:', err.message);
                setMessage({ type: 'error', text: 'No se pudieron cargar las categorías del sistema.' });
            }
        }
        fetchCategories();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (title.length < 5) {
            setMessage({ type: 'error', text: 'El título debe tener al menos 5 caracteres.' });
            setLoading(false);
            return;
        }

        if (!categoryId) {
            setMessage({ type: 'error', text: 'Por favor, selecciona una categoría válida.' });
            setLoading(false);
            return;
        }

        try {
            // 2. Obtener sesión activa del usuario y su perfil
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('No se encontró una sesión activa.');

            // Resolver nombre del perfil del usuario (best-effort, no bloquea si falla)
            let reporterName = user.email ?? 'Unknown';
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();
            if (userProfile?.full_name) reporterName = userProfile.full_name;

            // Evaluamos si el ID es numérico o UUID antes de mandarlo a Postgres
            const parsedCategoryId = isNaN(Number(categoryId)) ? categoryId : parseInt(categoryId);

            // 3. Insertar el ticket en la base de datos relacional
            const { data: ticket, error: dbError } = await supabase
                .from('tickets')
                .insert({
                    title,
                    description,
                    category_id: parsedCategoryId, // Se adapta dinámicamente al tipo correcto
                    user_id: user.id,
                    status: 'Open',
                })
                .select()
                .single();

            if (dbError) throw dbError;

            setMessage({ type: 'success', text: '¡Ticket creado con éxito! Ejecutando análisis de IA...' });

            // 4. Disparar el flujo analítico de Gemini (Observabilidad y Auditoría)
            const aiData = await analyzeTicketWithAI(ticket.id, title, description);

            if (aiData) {
                // 5. Guardar el análisis directamente en el ticket recién creado
                const { error: updateError } = await supabase
                    .from('tickets')
                    .update({
                        ai_summary: aiData.summary,
                        ai_classification: aiData.classification,
                        ai_suggestions: aiData.suggestions,
                        ai_risk_level: aiData.riskLevel
                    })
                    .eq('id', ticket.id);

                if (updateError) throw updateError;

                setMessage({ type: 'success', text: '¡Ticket creado y analizado por la IA de forma exitosa!' });
                setTitle('');
                setDescription('');

                // 6. Disparar notificación a n8n (fire-and-forget — no bloquea ni rompe la UX)
                // El cliente ya tiene todos los datos, así evitamos que el servidor re-consulte Supabase
                const selectedCategory = categories.find(c => String(c.id) === categoryId);
                fetch('/api/tickets/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket: {
                            id: ticket.id,
                            title: ticket.title,
                            description: ticket.description,
                            status: ticket.status,
                            created_at: ticket.created_at,
                            category: selectedCategory?.name ?? 'General',
                            reporter: {
                                full_name: reporterName,
                                email: user.email ?? '',
                            },
                        },
                        ai: {
                            classification: aiData.classification,
                            risk_level: aiData.riskLevel,
                            summary: aiData.summary,
                            suggestions: aiData.suggestions,
                            is_critical: aiData.riskLevel?.toLowerCase() === 'critical',
                        },
                    }),
                }).catch((err) => {
                    console.warn('[n8n] Webhook dispatch failed silently:', err.message);
                });
            } else {
                setMessage({ type: 'success', text: 'Ticket creado, pero el análisis de IA falló. Revisar logs.' });
            }

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Ocurrió un error inesperado.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-10 p-8 bg-card rounded-xl shadow-lg border border-border">
            <div className="mb-6">
                <Link href="/dashboard" className="text-sm font-medium text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                    ← Volver al Panel de Soporte
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-6">Crear Nuevo Ticket de Soporte</h1>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm border ${message.type === 'success' ? 'bg-success-subtle text-success border-success/20' : 'bg-danger-subtle text-danger border-danger/20'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-secondary mb-1.5">Título del Incidente</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="Ej. Mi laptop no conecta al WiFi corporativo"
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground placeholder-muted transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-secondary mb-1.5">Categoría</label>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground transition-all"
                    >
                        {categories.length === 0 ? (
                            <option value="">Cargando categorías...</option>
                        ) : (
                            categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-secondary mb-1.5">Descripción Detallada</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={5}
                        placeholder="Describe detalladamente lo que sucede..."
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground placeholder-muted transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || categories.length === 0}
                    className={`w-full py-2.5 px-4 font-semibold text-white rounded-lg transition-all ${loading ? 'bg-accent/50 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20'
                        }`}
                >
                    {loading ? 'Procesando...' : 'Enviar Ticket'}
                </button>
            </form>
        </div>
    );
}

export default function SafeNewTicketPage() {
    return (
        <ProtectedRoute>
            <NewTicketPage />
        </ProtectedRoute>
    );
}