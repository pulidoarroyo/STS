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
    const [metrics, setMetrics] = useState({ total: 0, open: 0, critical: 0 });
    const [role, setRole] = useState<string | null>(null);
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

                // Fetch user role from profiles
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;
                const userRole = profile?.role || 'User';
                setRole(userRole);

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
                    const critical = formattedTickets.filter(t => t.ai_risk_level?.toLowerCase() === 'critical' || t.ai_risk_level?.toLowerCase() === 'high').length;

                    setMetrics({ total, open, critical });
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
            case 'critical': return 'bg-red-100 text-red-800 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10 text-gray-900">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Panel de Soporte</h1>
                            {role && (
                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isAgentOrAdmin
                                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                                        : 'bg-blue-100 text-blue-800 border-blue-200'
                                    }`}>
                                    Vista de {role === 'Admin' ? 'Administrador' : role === 'Agent' ? 'Agente' : 'Cliente'}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            {isAgentOrAdmin
                                ? 'Monitorea todos los incidentes reportados en el sistema y el análisis de IA.'
                                : 'Monitorea tus incidentes y el análisis automatizado por IA.'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/user/tickets/new"
                            className="inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-md shadow-sm transition-all text-center"
                        >
                            + Crear Nuevo Ticket
                        </Link>
                        <button
                            onClick={handleSignOut}
                            className="inline-flex justify-center items-center px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium text-sm rounded-md shadow-sm transition-all text-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                            </svg>
                            Cerrar Sesión
                        </button>
                    </div>
                </div>

                {/* Tarjetas de Métricas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Reportados</p>
                        <p className="text-3xl font-bold text-gray-800 mt-2">{metrics.total}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">En Proceso (Abiertos)</p>
                        <p className="text-3xl font-bold text-blue-600 mt-2">{metrics.open}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-red-500">
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Prioridad Crítica / Alta (IA)</p>
                        <p className="text-3xl font-bold text-red-600 mt-2">{metrics.critical}</p>
                    </div>
                </div>

                {/* Tabla de Tickets */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-lg font-bold text-gray-800">Historial de Incidentes</h2>

                        {/* Filtros */}
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-400 font-semibold uppercase">Estado:</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="All">Todos</option>
                                    <option value="Open">Abiertos</option>
                                    <option value="Resolved">Resueltos</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-400 font-semibold uppercase">Prioridad:</label>
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="All">Todas</option>
                                    <option value="Urgent">Urgente (IA)</option>
                                    <option value="Normal">Normal</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredTickets.length === 0 ? (
                        <div className="p-10 text-center text-gray-400">
                            {tickets.length === 0
                                ? (isAgentOrAdmin ? 'No hay ningún ticket registrado en el sistema.' : 'No tienes ningún ticket registrado. ¡Crea uno nuevo para ver el análisis de IA!')
                                : 'No se encontraron tickets con los filtros seleccionados.'
                            }
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-400 uppercase text-xs font-semibold tracking-wider border-b border-gray-100">
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
                                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                    {filteredTickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-gray-50/70 transition-colors">
                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="font-semibold text-gray-900 truncate">{ticket.title}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(ticket.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </div>
                                            </td>
                                            {isAgentOrAdmin && (
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900 truncate max-w-[150px]">{ticket.profiles?.full_name || 'Desconocido'}</div>
                                                    <div className="text-xs text-gray-400 truncate max-w-[150px]">{ticket.profiles?.email || ''}</div>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-gray-500">
                                                {ticket.categories?.name || 'Sin categoría'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 italic font-medium">
                                                {ticket.ai_classification || 'Procesando...'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getRiskColor(ticket.ai_risk_level)}`}>
                                                    {ticket.ai_risk_level || 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center text-xs font-medium ${ticket.status === 'Open' ? 'text-blue-600' : 'text-gray-400'}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${ticket.status === 'Open' ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`}></span>
                                                    {ticket.status === 'Open' ? 'Abierto' : 'Resuelto'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/user/tickets/${ticket.id}`}
                                                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs"
                                                >
                                                    Ver Detalle →
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