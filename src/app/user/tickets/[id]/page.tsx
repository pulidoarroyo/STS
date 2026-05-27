'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface TicketDetail {
    id: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
    ai_summary: string | null;
    ai_classification: string | null;
    ai_suggestions: string | null;
    ai_risk_level: string | null;
    categories: { name: string } | null;
    profiles: { full_name: string; email: string } | null;
    assigned_to: string | null;
    assignees: { full_name: string; email: string; role: string } | null;
}

interface Comment {
    id: string;
    content: string;
    created_at: string;
    profiles: { full_name: string; email: string; role: string } | null;
}

function TicketDetailPage() {
    const { user, profile: currentUserProfile } = useAuth();
    const { id } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingAssignee, setUpdatingAssignee] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(true);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [isEditingAI, setIsEditingAI] = useState(false);
    const [editClassification, setEditClassification] = useState('');
    const [editRiskLevel, setEditRiskLevel] = useState('Medium');
    const [editSummary, setEditSummary] = useState('');
    const [editSuggestions, setEditSuggestions] = useState('');
    const [savingAI, setSavingAI] = useState(false);

    const isAgentOrAdmin = currentUserProfile?.role === 'Admin' || currentUserProfile?.role === 'Agent';

    const handleStatusChange = async (newStatus: string) => {
        if (!ticket) return;
        try {
            setUpdatingStatus(true);
            const { error } = await supabase
                .from('tickets')
                .update({ status: newStatus })
                .eq('id', ticket.id);

            if (error) throw error;
            setTicket(prev => prev ? { ...prev, status: newStatus } : null);
        } catch (err: any) {
            console.error('Error al cambiar el estado:', err.message);
            alert('Error al actualizar el estado: ' + err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleClaimTicket = async () => {
        if (!ticket || !user) return;
        try {
            setUpdatingAssignee(true);
            const { error } = await supabase
                .from('tickets')
                .update({ assigned_to: user.id })
                .eq('id', ticket.id);

            if (error) throw error;

            const { data: updatedProfile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, email, role')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            setTicket(prev => prev ? {
                ...prev,
                assigned_to: user.id,
                assignees: updatedProfile
            } : null);
        } catch (err: any) {
            console.error('Error al asignar el ticket:', err.message);
            alert('Error al asignar el ticket: ' + err.message);
        } finally {
            setUpdatingAssignee(false);
        }
    };

    const handleStartEditAI = () => {
        if (!ticket) return;
        setEditClassification(ticket.ai_classification || '');
        setEditRiskLevel(ticket.ai_risk_level || 'Medium');
        setEditSummary(ticket.ai_summary || '');
        setEditSuggestions(ticket.ai_suggestions || '');
        setIsEditingAI(true);
    };

    const handleSaveAI = async () => {
        if (!ticket) return;
        try {
            setSavingAI(true);
            const { error } = await supabase
                .from('tickets')
                .update({
                    ai_classification: editClassification,
                    ai_risk_level: editRiskLevel,
                    ai_summary: editSummary,
                    ai_suggestions: editSuggestions
                })
                .eq('id', ticket.id);

            if (error) throw error;

            setTicket(prev => prev ? {
                ...prev,
                ai_classification: editClassification,
                ai_risk_level: editRiskLevel,
                ai_summary: editSummary,
                ai_suggestions: editSuggestions
            } : null);
            setIsEditingAI(false);
        } catch (err: any) {
            console.error('Error al guardar overrides de IA:', err.message);
            alert('Error al guardar overrides de IA: ' + err.message);
        } finally {
            setSavingAI(false);
        }
    };

    const fetchComments = async () => {
        if (!id) return;
        try {
            setLoadingComments(true);
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    id,
                    content,
                    created_at,
                    profiles ! comments_user_id_fkey ( full_name, email, role )
                `)
                .eq('ticket_id', id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setComments(data as any[] || []);
        } catch (err: any) {
            console.error('Error al cargar comentarios:', err.message);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || !id || !user) return;

        try {
            setSubmittingComment(true);
            const { error } = await supabase
                .from('comments')
                .insert({
                    ticket_id: id,
                    user_id: user.id,
                    content: newComment.trim()
                });

            if (error) throw error;
            setNewComment('');
            await fetchComments();
        } catch (err: any) {
            console.error('Error al enviar el comentario:', err.message);
            alert('Error al enviar el comentario: ' + err.message);
        } finally {
            setSubmittingComment(false);
        }
    };

    useEffect(() => {
        if (!id) return;

        async function fetchTicketDetails() {
            try {
                setLoading(true);

                // Hacemos un join triple: traemos el ticket, el nombre de su categoría 
                // y los datos del perfil que lo creó.
                const { data, error } = await supabase
                    .from('tickets')
                    .select(`
                        id, title, description, status, created_at,
                        ai_summary, ai_classification, ai_suggestions, ai_risk_level,
                        categories ( name ),
                        profiles ! tickets_user_id_fkey ( full_name, email ),
                        assigned_to,
                        assignees:profiles ! tickets_assigned_to_fkey ( full_name, email, role )
                    `)
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setTicket(data as any);
            } catch (err: any) {
                console.error('Error al cargar el detalle:', err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchTicketDetails();
        fetchComments();
    }, [id]);

    const getRiskBadge = (level: string) => {
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

    if (!ticket) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center text-gray-900">
                <p className="text-lg font-medium text-gray-500">No se encontró el ticket solicitado.</p>
                <Link href="/dashboard" className="mt-4 text-blue-600 hover:underline">Volver al panel</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10 text-gray-900">
            <div className="max-w-5xl mx-auto">

                {/* Botón de Retorno */}
                <div className="mb-6">
                    <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors">
                        ← Volver al Panel de Soporte
                    </Link>
                </div>

                {/* Título Principal */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6 mb-8 gap-4">
                    <div>
                        <span className="text-xs uppercase tracking-wider font-semibold text-gray-400">Detalle del Incidente</span>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{ticket.title}</h1>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>Registrado el: <strong>{new Date(ticket.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                            <span>•</span>
                            <span>Categoría: <strong>{ticket.categories?.name || 'General'}</strong></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getRiskBadge(ticket.ai_risk_level || '')}`}>
                            Riesgo IA: {ticket.ai_risk_level || 'Pendiente'}
                        </span>
                        {isAgentOrAdmin ? (
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1">
                                <label htmlFor="status-select" className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estado</label>
                                <select
                                    id="status-select"
                                    value={ticket.status}
                                    disabled={updatingStatus}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    className="text-xs font-bold bg-transparent text-gray-700 border-none focus:outline-none focus:ring-0 cursor-pointer pr-1"
                                >
                                    <option value="Open">Abierto</option>
                                    <option value="In Progress">En Proceso</option>
                                    <option value="Resolved">Resuelto</option>
                                </select>
                                {updatingStatus && (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                )}
                            </div>
                        ) : (
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                                ticket.status === 'Open'
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : ticket.status === 'In Progress'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                    : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                                Estado: {ticket.status === 'Open' ? 'Abierto' : ticket.status === 'In Progress' ? 'En Proceso' : 'Resuelto'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Columna Izquierda: Información del Usuario */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Descripción del Reporte</h3>
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                        </div>

                        {/* Datos de contacto del creador */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Usuario Afectado</h3>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold uppercase">
                                    {ticket.profiles?.full_name?.[0] || 'U'}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{ticket.profiles?.full_name || 'Usuario del Sistema'}</p>
                                    <p className="text-xs text-gray-500">{ticket.profiles?.email || 'Sin correo registrado'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Agente Asignado */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Agente Asignado</h3>
                            {ticket.assignees ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold uppercase">
                                            {ticket.assignees.full_name?.[0] || 'A'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{ticket.assignees.full_name || 'Agente de Soporte'}</p>
                                            <p className="text-xs text-gray-500">{ticket.assignees.email || 'Sin correo registrado'}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                        {ticket.assignees.role === 'Admin' ? 'Administrador' : 'Agente'}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-gray-50 border border-dashed border-gray-200">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">Este ticket no tiene un agente asignado todavía.</p>
                                        <p className="text-xs text-gray-400 mt-0.5">Los agentes de soporte pueden tomar el control del caso.</p>
                                    </div>
                                    {isAgentOrAdmin && (
                                        <button
                                            onClick={handleClaimTicket}
                                            disabled={updatingAssignee}
                                            className="inline-flex justify-center items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-sm transition-all disabled:bg-blue-400 whitespace-nowrap"
                                        >
                                            {updatingAssignee ? (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5 animate-infinite"></div>
                                            ) : null}
                                            Asignarme este Ticket
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Conversación y Bitácora */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <span>💬</span> Conversación y Historial
                                </h3>
                                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
                                </span>
                            </div>

                            {/* Timeline de Comentarios */}
                            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                                {loadingComments ? (
                                    <div className="flex justify-center items-center py-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-100">
                                        <p className="text-sm">No hay mensajes en este ticket aún.</p>
                                        <p className="text-xs mt-0.5">Escribe un comentario abajo para iniciar la conversación.</p>
                                    </div>
                                ) : (
                                    comments.map((comment) => {
                                        const isAuthorSupport = comment.profiles?.role === 'Admin' || comment.profiles?.role === 'Agent';
                                        return (
                                            <div
                                                key={comment.id}
                                                className={`p-4 rounded-xl border transition-all ${
                                                    isAuthorSupport
                                                        ? 'bg-purple-50/50 border-purple-100 ml-6 sm:ml-12'
                                                        : 'bg-slate-50/50 border-slate-100 mr-6 sm:mr-12'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                                            isAuthorSupport
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {comment.profiles?.full_name?.[0] || 'U'}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-800">
                                                                {comment.profiles?.full_name || 'Usuario del Sistema'}
                                                            </span>
                                                            <span className={`ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                                                                comment.profiles?.role === 'Admin'
                                                                    ? 'bg-purple-100 text-purple-800'
                                                                    : comment.profiles?.role === 'Agent'
                                                                    ? 'bg-purple-50 text-purple-700'
                                                                    : 'bg-blue-50 text-blue-700'
                                                            }`}>
                                                                {comment.profiles?.role === 'Admin' ? 'Admin' : comment.profiles?.role === 'Agent' ? 'Agente' : 'Cliente'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(comment.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pl-9">
                                                    {comment.content}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Formulario para agregar comentario */}
                            <form onSubmit={handleSubmitComment} className="border-t border-gray-100 pt-4 space-y-3">
                                <div>
                                    <label htmlFor="comment-textarea" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        Escribir un Comentario
                                    </label>
                                    <textarea
                                        id="comment-textarea"
                                        rows={3}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        required
                                        placeholder="Escribe una respuesta, nota o aclaración..."
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-800 placeholder-gray-400"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submittingComment || !newComment.trim()}
                                        className="inline-flex justify-center items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-sm transition-all disabled:bg-blue-400"
                                    >
                                        {submittingComment ? (
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-1.5"></div>
                                        ) : null}
                                        Enviar Comentario
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Columna Derecha: Diagnóstico Automatizado de la IA */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 text-slate-100 p-6 rounded-xl shadow-md border border-slate-800 relative overflow-hidden">
                            {/* Detalle estético de fondo */}
                            <div className="absolute top-0 right-0 p-3 text-slate-800 opacity-20 font-mono text-xs select-none">GEMINI_CORE</div>

                            <div className="flex items-center justify-between mb-4 gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🧠</span>
                                    <h2 className="text-md font-bold tracking-tight text-white">Análisis de Automatización IA</h2>
                                </div>
                                {isAgentOrAdmin && !isEditingAI && (
                                    <button
                                        onClick={handleStartEditAI}
                                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 bg-slate-800/60 hover:bg-slate-850 px-2 py-1 rounded border border-slate-800/80"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                        Editar
                                    </button>
                                )}
                            </div>

                            <hr className="border-slate-800 mb-4" />

                            {isEditingAI ? (
                                <div className="space-y-4 text-xs">
                                    <div>
                                        <label htmlFor="edit-classification" className="block font-semibold text-blue-400 uppercase tracking-wider mb-1">Clasificación Técnica</label>
                                        <input
                                            id="edit-classification"
                                            type="text"
                                            value={editClassification}
                                            onChange={(e) => setEditClassification(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                            placeholder="Ej. Network, Hardware, Software"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit-risk-level" className="block font-semibold text-blue-400 uppercase tracking-wider mb-1">Nivel de Riesgo</label>
                                        <select
                                            id="edit-risk-level"
                                            value={editRiskLevel}
                                            onChange={(e) => setEditRiskLevel(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                        >
                                            <option value="Low">Low (Bajo)</option>
                                            <option value="Medium">Medium (Medio)</option>
                                            <option value="High">High (Alto)</option>
                                            <option value="Critical">Critical (Crítico)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="edit-summary" className="block font-semibold text-blue-400 uppercase tracking-wider mb-1">Resumen de Diagnóstico</label>
                                        <textarea
                                            id="edit-summary"
                                            rows={3}
                                            value={editSummary}
                                            onChange={(e) => setEditSummary(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs leading-relaxed"
                                            placeholder="Resumen del problema..."
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit-suggestions" className="block font-semibold text-blue-400 uppercase tracking-wider mb-1">Sugerencias de Resolución (Playbook)</label>
                                        <textarea
                                            id="edit-suggestions"
                                            rows={5}
                                            value={editSuggestions}
                                            onChange={(e) => setEditSuggestions(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs leading-relaxed font-mono"
                                            placeholder="Sugerencias paso a paso..."
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingAI(false)}
                                            className="px-3 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-slate-300 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={savingAI}
                                            onClick={handleSaveAI}
                                            className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1 disabled:bg-blue-400"
                                        >
                                            {savingAI && (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                            )}
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Clasificación Técnica</h4>
                                        <p className="mt-1 font-medium text-slate-200">{ticket.ai_classification || 'No clasificado'}</p>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Resumen de Diagnóstico</h4>
                                        <p className="mt-1 text-slate-300 leading-relaxed text-xs">{ticket.ai_summary || 'Sin resumen analítico disponible.'}</p>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1.5">Sugerencias de Resolución (Playbook)</h4>
                                        <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                                            {ticket.ai_suggestions || 'No se generaron recomendaciones automáticas.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}

export default function SafeTicketDetailPage() {
    return (
        <ProtectedRoute>
            <TicketDetailPage />
        </ProtectedRoute>
    );
}