'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute';

interface Ticket {
    id: string;
    title: string;
    status: string;
    created_at: string;
    ai_classification: string;
    ai_risk_level: string;
    categories: { name: string } | null;
    profiles: { full_name: string; email: string } | null;
}

function DashboardPage() {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({ total: 0, open: 0, critical: 0, resolved: 0 });
    const [role, setRole] = useState<string | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterPriority, setFilterPriority] = useState<string>('All');

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            router.push('/auth/login');
        } catch (err: any) {
            console.error('Error al cerrar sesión:', err.message);
        }
    };

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                setLoading(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Fetch user role and name from profiles
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, full_name')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;
                const userRole = profile?.role || 'User';
                setRole(userRole);
                setUserName(profile?.full_name || user.email || 'Usuario');

                // Fetch tickets based on role (Admins/Agents see all, standard users see only their own)
                let query = supabase
                    .from('tickets')
                    .select(`
                        id, title, status, created_at, ai_classification, ai_risk_level,
                        categories ( name ),
                        profiles ! tickets_user_id_fkey ( full_name, email )
                    `);

                if (userRole !== 'Admin' && userRole !== 'Agent') {
                    query = query.eq('user_id', user.id);
                }

                const { data, error } = await query.order('created_at', { ascending: false });

                if (error) throw error;

                if (data) {
                    const formattedTickets = data as any[];
                    setTickets(formattedTickets);

                    // Calcular métricas rápidas para las tarjetas
                    const total = formattedTickets.length;
                    const open = formattedTickets.filter(t => t.status === 'Open').length;
                    const resolved = formattedTickets.filter(t => t.status === 'Resolved').length;
                    const critical = formattedTickets.filter(t => t.ai_risk_level?.toLowerCase() === 'critical' || t.ai_risk_level?.toLowerCase() === 'high').length;

                    setMetrics({ total, open, critical, resolved });
                }
            } catch (error: any) {
                console.error('Error en el dashboard:', error.message);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    // Funciones helper para pintar los badges de colores según la IA
    const getRiskColor = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'critical': return 'bg-critical-subtle text-critical border-critical/30';
            case 'high': return 'bg-high-subtle text-high border-high/30';
            case 'medium': return 'bg-medium-subtle text-medium border-medium/30';
            case 'low': return 'bg-low-subtle text-low border-low/30';
            default: return 'bg-elevated text-muted border-border';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-surface">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    const filteredTickets = tickets.filter(ticket => {
        // Status filter
        if (filterStatus === 'Open' && ticket.status !== 'Open') return false;
        if (filterStatus === 'Resolved' && ticket.status !== 'Resolved') return false;

        // Priority filter
        const isUrgent = ticket.ai_risk_level?.toLowerCase() === 'critical' || ticket.ai_risk_level?.toLowerCase() === 'high';
        if (filterPriority === 'Urgent' && !isUrgent) return false;
        if (filterPriority === 'Normal' && isUrgent) return false;

        return true;
    });

    const isAgentOrAdmin = role === 'Admin' || role === 'Agent';

    return (
        <div className="min-h-screen bg-surface p-6 sm:p-10 text-foreground">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                    <div>
                        {/* Navi Wordmark */}
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="white" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold tracking-tight"
                                style={{ background: 'linear-gradient(90deg, #818cf8 0%, #c7d2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                Navi
                            </span>
                            {role && (
                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isAgentOrAdmin
                                    ? 'bg-accent-subtle text-accent border-accent/30'
                                    : 'bg-accent-subtle text-accent border-accent/30'
                                    }`}>
                                    {role === 'Admin' ? 'Administrador' : role === 'Agent' ? 'Agente' : 'Cliente'}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted mt-1">
                            {isAgentOrAdmin
                                ? 'Monitorea todos los incidentes reportados en el sistema y el análisis de IA.'
                                : 'Monitorea tus incidentes y el análisis automatizado por IA.'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/user/tickets/new"
                            className="inline-flex justify-center items-center px-4 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium text-sm rounded-lg shadow-lg shadow-accent/20 transition-all text-center"
                        >
                            + Crear Nuevo Ticket
                        </Link>

                        {/* User info + logout */}
                        <div className="flex items-center gap-2 pl-3 border-l border-border">
                            {/* Avatar with initials */}
                            <div
                                className="flex-shrink-0 w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold select-none"
                                title={userName || ''}
                            >
                                {userName
                                    ? userName.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                    : '?'}
                            </div>
                            <span className="text-sm font-medium text-secondary max-w-[120px] truncate hidden sm:block">
                                {userName}
                            </span>
                            <button
                                onClick={handleSignOut}
                                title="Cerrar Sesión"
                                className="inline-flex justify-center items-center px-3 py-2 bg-card hover:bg-danger-subtle text-muted hover:text-danger border border-border hover:border-danger/30 font-medium text-sm rounded-lg transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                </svg>
                                <span className="ml-2 hidden sm:inline">Cerrar Sesión</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tarjetas de Métricas */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Reportados</p>
                        <p className="text-3xl font-bold text-foreground mt-2">{metrics.total}</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm border-l-[3px] border-l-accent">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider">En Proceso (Abiertos)</p>
                        <p className="text-3xl font-bold text-accent mt-2">{metrics.open}</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm border-l-[3px] border-l-success">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Resueltos</p>
                        <p className="text-3xl font-bold text-success mt-2">{metrics.resolved}</p>
                    </div>
                    <div className="bg-card p-6 rounded-xl border border-border shadow-sm border-l-[3px] border-l-danger">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Prioridad Crítica / Alta (IA)</p>
                        <p className="text-3xl font-bold text-danger mt-2">{metrics.critical}</p>
                    </div>
                </div>

                {/* Tabla de Tickets */}
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-lg font-bold text-foreground">Historial de Incidentes</h2>

                        {/* Filtros */}
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted font-semibold uppercase">Estado:</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-2.5 py-1.5 bg-elevated border border-border rounded-lg text-xs font-medium text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                                >
                                    <option value="All">Todos</option>
                                    <option value="Open">Abiertos</option>
                                    <option value="Resolved">Resueltos</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted font-semibold uppercase">Prioridad:</label>
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="px-2.5 py-1.5 bg-elevated border border-border rounded-lg text-xs font-medium text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                                >
                                    <option value="All">Todas</option>
                                    <option value="Urgent">Urgente (IA)</option>
                                    <option value="Normal">Normal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredTickets.length === 0 ? (
                        <div className="p-10 text-center text-muted">
                            {tickets.length === 0
                                ? (isAgentOrAdmin ? 'No hay ningún ticket registrado en el sistema.' : 'No tienes ningún ticket registrado. ¡Crea uno nuevo para ver el análisis de IA!')
                                : 'No se encontraron tickets con los filtros seleccionados.'
                            }
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-elevated text-muted uppercase text-xs font-semibold tracking-wider border-b border-border">
                                        <th className="px-6 py-4">Incidente</th>
                                        {isAgentOrAdmin && (
                                            <th className="px-6 py-4">Reportero</th>
                                        )}
                                        <th className="px-6 py-4">Categoría Original</th>
                                        <th className="px-6 py-4">Clasificación IA</th>
                                        <th className="px-6 py-4">Riesgo (IA)</th>
                                        <th className="px-6 py-4">Estado</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-sm text-secondary">
                                    {filteredTickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-elevated/50 transition-colors">
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="font-semibold text-foreground truncate">{ticket.title}</div>
                                                <div className="text-xs text-muted mt-0.5">
                                                    {new Date(ticket.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </div>
                                            </td>
                                            {isAgentOrAdmin && (
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-foreground truncate max-w-[150px]">{ticket.profiles?.full_name || 'Desconocido'}</div>
                                                    <div className="text-xs text-muted truncate max-w-[150px]">{ticket.profiles?.email || ''}</div>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-secondary">
                                                {ticket.categories?.name || 'Sin categoría'}
                                            </td>
                                            <td className="px-6 py-4 text-secondary italic font-medium">
                                                {ticket.ai_classification || 'Procesando...'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getRiskColor(ticket.ai_risk_level)}`}>
                                                    {ticket.ai_risk_level || 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center text-xs font-medium ${ticket.status === 'Open' ? 'text-accent' : 'text-muted'}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${ticket.status === 'Open' ? 'bg-accent animate-pulse' : 'bg-muted'}`}></span>
                                                    {ticket.status === 'Open' ? 'Abierto' : 'Resuelto'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/user/tickets/${ticket.id}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent/30 text-accent hover:bg-accent hover:text-white hover:border-accent transition-all"
                                                >
                                                    Ver Detalle
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                                    </svg>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default function SafeDashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardPage />
        </ProtectedRoute>
    );
}