'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute';
import { analyzeTicketWithAI } from '@/modules/ai/aiService';

interface Category {
    id: string | number;
    name: string;
}

function NewTicketPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
                    setCategoryId(String(data[0].id));
                }
            } catch (err: any) {
                console.error('Error loading categories:', err.message);
                setMessage({ type: 'error', text: 'Could not load system categories.' });
            }
        }
        fetchCategories();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (title.length < 5) {
            setMessage({ type: 'error', text: 'The title must be at least 5 characters long.' });
            setLoading(false);
            return;
        }

        if (!categoryId) {
            setMessage({ type: 'error', text: 'Please select a valid category.' });
            setLoading(false);
            return;
        }

        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('No active session found.');

            let reporterName = user.email ?? 'Unknown';
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();
            if (userProfile?.full_name) reporterName = userProfile.full_name;

            const parsedCategoryId = isNaN(Number(categoryId)) ? categoryId : parseInt(categoryId);
            const { data: ticket, error: dbError } = await supabase
                .from('tickets')
                .insert({
                    title,
                    description,
                    category_id: parsedCategoryId,
                    user_id: user.id,
                    status: 'Open',
                })
                .select()
                .single();

            if (dbError) throw dbError;

            setMessage({ type: 'success', text: 'Ticket created successfully! Running AI analysis...' });
            const aiData = await analyzeTicketWithAI(ticket.id, title, description);

            if (aiData) {
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

                setMessage({ type: 'success', text: 'Ticket created and successfully analyzed by AI! Redirecting to dashboard...' });
                setTitle('');
                setDescription('');

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

                setTimeout(() => {
                    router.push('/dashboard');
                }, 3000);
            } else {
                setMessage({ type: 'success', text: 'Ticket created, but AI analysis failed. Redirecting to dashboard...' });
                setTimeout(() => {
                    router.push('/dashboard');
                }, 3000);
            }

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto mt-10 p-8 bg-card rounded-xl shadow-lg border border-border">
            <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="white" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                        </svg>
                    </div>
                    <span className="text-lg font-bold tracking-tight"
                        style={{ background: 'linear-gradient(90deg, #818cf8 0%, #c7d2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Navi
                    </span>
                </div>
                <Link href="/dashboard" className="text-sm font-medium text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors">
                    ← Back to Support Dashboard
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-6">Create New Support Ticket</h1>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm border ${message.type === 'success' ? 'bg-success-subtle text-success border-success/20' : 'bg-danger-subtle text-danger border-danger/20'
                    }`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-secondary mb-1.5">Incident Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="e.g. My laptop won't connect to corporate WiFi"
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground placeholder-muted transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-secondary mb-1.5">Category</label>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground transition-all"
                    >
                        {categories.length === 0 ? (
                            <option value="">Loading categories...</option>
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
                    <label className="block text-sm font-medium text-secondary mb-1.5">Detailed Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={5}
                        placeholder="Describe in detail what is happening..."
                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-foreground placeholder-muted transition-all"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || categories.length === 0}
                    className={`w-full py-2.5 px-4 font-semibold text-white rounded-lg transition-all ${loading ? 'bg-accent/50 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover shadow-lg shadow-accent/20'
                        }`}
                >
                    {loading ? 'Processing...' : 'Submit Ticket'}
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