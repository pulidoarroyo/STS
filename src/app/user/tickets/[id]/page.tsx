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

    const parseSuggestions = (raw: string | null) => {
        if (!raw) return <span className="text-muted">No se generaron recomendaciones automáticas.</span>;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return (
                    <ul className="space-y-1.5 list-none">
                        {parsed.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="mt-0.5 text-accent font-bold flex-shrink-0">–</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                );
            }
        } catch {
            // not JSON, fall through to plain text
        }
        return <span className="whitespace-pre-wrap">{raw}</span>;
    };

    const getRiskBadge = (level: string) => {
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

    if (!ticket) {
        return (
            <div className="min-h-screen bg-surface flex flex-col justify-center items-center text-foreground">
                <p className="text-lg font-medium text-muted">No se encontró el ticket solicitado.</p>
                <Link href="/dashboard" className="mt-4 text-accent hover:underline">Volver al panel</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface p-6 sm:p-10 text-foreground">
            <div className="max-w-5xl mx-auto">

                {/* Top bar: Navi wordmark + Back link */}
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
                        ← Volver al Panel de Soporte
                    </Link>
                </div>

                {/* Título Principal */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6 mb-8 gap-4">
                    <div>
                        <span className="text-xs uppercase tracking-wider font-semibold text-muted">Detalle del Incidente</span>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{ticket.title}</h1>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                            <span>Registrado el: <strong className="text-secondary">{new Date(ticket.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                            <span>•</span>
                            <span>Categoría: <strong className="text-secondary">{ticket.categories?.name || 'General'}</strong></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getRiskBadge(ticket.ai_risk_level || '')}`}>
                            Riesgo IA: {ticket.ai_risk_level || 'Pendiente'}
                        </span>
                        {isAgentOrAdmin ? (
                            <div className="flex items-center gap-2 bg-elevated border border-border rounded-lg px-2.5 py-1">
                                <label htmlFor="status-select" className="text-[10px] font-bold text-muted uppercase tracking-wider">Estado</label>
                                <select
                                    id="status-select"
                                    value={ticket.status}
                                    disabled={updatingStatus}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    className="text-xs font-bold bg-transparent text-secondary border-none focus:outline-none focus:ring-0 cursor-pointer pr-1"
                                >
                                    <option value="Open">Abierto</option>
                                    <option value="In Progress">En Proceso</option>
                                    <option value="Resolved">Resuelto</option>
                                </select>
                                {updatingStatus && (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent"></div>
                                )}
                            </div>
                        ) : (
                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                                ticket.status === 'Open'
                                    ? 'bg-accent-subtle text-accent border-accent/30'
                                    : ticket.status === 'In Progress'
                                    ? 'bg-warning-subtle text-warning border-warning/30'
                                    : 'bg-success-subtle text-success border-success/30'
                            }`}>
                                {ticket.status === 'Open' ? 'Abierto' : ticket.status === 'In Progress' ? 'En Proceso' : 'Resuelto'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Columna Izquierda: Información del Usuario */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Descripción del Reporte</h3>
                            <p className="text-secondary whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                        </div>

                        {/* Datos de contacto del creador */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Usuario Afectado</h3>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-elevated flex items-center justify-center text-secondary font-bold uppercase">
                                    {ticket.profiles?.full_name?.[0] || 'U'}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{ticket.profiles?.full_name || 'Usuario del Sistema'}</p>
                                    <p className="text-xs text-muted">{ticket.profiles?.email || 'Sin correo registrado'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Agente Asignado */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Agente Asignado</h3>
                            {ticket.assignees ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-accent-subtle flex items-center justify-center text-accent font-bold uppercase">
                                            {ticket.assignees.full_name?.[0] || 'A'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{ticket.assignees.full_name || 'Agente de Soporte'}</p>
                                            <p className="text-xs text-muted">{ticket.assignees.email || 'Sin correo registrado'}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-accent-subtle text-accent border border-accent/30">
                                        {ticket.assignees.role === 'Admin' ? 'Administrador' : 'Agente'}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-elevated border border-dashed border-border">
                                    <div>
                                        <p className="text-sm font-medium text-muted">Este ticket no tiene un agente asignado todavía.</p>
                                        <p className="text-xs text-muted mt-0.5">Los agentes de soporte pueden tomar el control del caso.</p>
                                    </div>
                                    {isAgentOrAdmin && (
                                        <button
                                            onClick={handleClaimTicket}
                                            disabled={updatingAssignee}
                                            className="inline-flex justify-center items-center px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg shadow-sm transition-all disabled:bg-accent/50 whitespace-nowrap"
                                        >
                                            {updatingAssignee ? (
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1.5"></div>
                                            ) : null}
                                            Asignarme este Ticket
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Conversación y Bitácora */}
                        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-border pb-4">
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-accent">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                                    </svg>
                                    Conversación y Historial
                                </h3>
                                <span className="text-xs font-semibold text-muted bg-elevated px-2.5 py-0.5 rounded-full">
                                    {comments.length} {comments.length === 1 ? 'comentario' : 'comentarios'}
                                </span>
                            </div>

                            {/* Timeline de Comentarios */}
                            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                                {loadingComments ? (
                                    <div className="flex justify-center items-center py-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                                    </div>
                                ) : comments.length === 0 ? (
                                    <div className="text-center py-10 text-muted bg-elevated rounded-lg border border-dashed border-border">
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
                                                        ? 'bg-accent-subtle border-accent/20 ml-6 sm:ml-12'
                                                        : 'bg-elevated border-border mr-6 sm:mr-12'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                                            isAuthorSupport
                                                                ? 'bg-accent text-white'
                                                                : 'bg-elevated text-secondary border border-border'
                                                        }`}>
                                                            {comment.profiles?.full_name?.[0] || 'U'}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-foreground">
                                                                {comment.profiles?.full_name || 'Usuario del Sistema'}
                                                            </span>
                                                            <span className={`ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                                                                comment.profiles?.role === 'Admin'
                                                                    ? 'bg-accent-subtle text-accent'
                                                                    : comment.profiles?.role === 'Agent'
                                                                    ? 'bg-accent-subtle text-accent'
                                                                    : 'bg-elevated text-muted'
                                                            }`}>
                                                                {comment.profiles?.role === 'Admin' ? 'Admin' : comment.profiles?.role === 'Agent' ? 'Agente' : 'Cliente'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-muted font-medium">
                                                        {new Date(comment.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-secondary whitespace-pre-wrap leading-relaxed pl-9">
                                                    {comment.content}
                                                </p>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Formulario para agregar comentario */}
                            <form onSubmit={handleSubmitComment} className="border-t border-border pt-4 space-y-3">
                                <div>
                                    <label htmlFor="comment-textarea" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
                                        Escribir un Comentario
                                    </label>
                                    <textarea
                                        id="comment-textarea"
                                        rows={3}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        required
                                        placeholder="Escribe una respuesta, nota o aclaración..."
                                        className="w-full px-3.5 py-2.5 border border-border bg-elevated rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm text-foreground placeholder-muted transition-all"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submittingComment || !newComment.trim()}
                                        className="inline-flex justify-center items-center px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg shadow-sm transition-all disabled:bg-accent/50"
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
                        <div className="bg-elevated text-foreground p-6 rounded-xl shadow-sm border border-border relative overflow-hidden">

                            <div className="flex items-center justify-between mb-4 gap-2">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-accent">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                    </svg>
                                    <h2 className="text-md font-bold tracking-tight text-foreground">Análisis de IA</h2>
                                </div>
                                {isAgentOrAdmin && !isEditingAI && (
                                    <button
                                        onClick={handleStartEditAI}
                                        className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1 bg-card hover:bg-elevated px-2 py-1 rounded border border-border"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                        Editar
                                    </button>
                                )}
                            </div>

                            <hr className="border-border mb-4" />

                            {isEditingAI ? (
                                <div className="space-y-4 text-xs">
                                    <div>
                                        <label htmlFor="edit-classification" className="block font-semibold text-accent uppercase tracking-wider mb-1">Clasificación Técnica</label>
                                        <input
                                            id="edit-classification"
                                            type="text"
                                            value={editClassification}
                                            onChange={(e) => setEditClassification(e.target.value)}
                                            className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent text-xs placeholder-muted"
                                            placeholder="Ej. Network, Hardware, Software"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit-risk-level" className="block font-semibold text-accent uppercase tracking-wider mb-1">Nivel de Riesgo</label>
                                        <select
                                            id="edit-risk-level"
                                            value={editRiskLevel}
                                            onChange={(e) => setEditRiskLevel(e.target.value)}
                                            className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent text-xs"
                                        >
                                            <option value="Low">Low (Bajo)</option>
                                            <option value="Medium">Medium (Medio)</option>
                                            <option value="High">High (Alto)</option>
                                            <option value="Critical">Critical (Crítico)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="edit-summary" className="block font-semibold text-accent uppercase tracking-wider mb-1">Resumen de Diagnóstico</label>
                                        <textarea
                                            id="edit-summary"
                                            rows={3}
                                            value={editSummary}
                                            onChange={(e) => setEditSummary(e.target.value)}
                                            className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent text-xs leading-relaxed placeholder-muted"
                                            placeholder="Resumen del problema..."
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="edit-suggestions" className="block font-semibold text-accent uppercase tracking-wider mb-1">Sugerencias de Resolución (Playbook)</label>
                                        <textarea
                                            id="edit-suggestions"
                                            rows={5}
                                            value={editSuggestions}
                                            onChange={(e) => setEditSuggestions(e.target.value)}
                                            className="w-full bg-card border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent text-xs leading-relaxed font-mono placeholder-muted"
                                            placeholder="Sugerencias paso a paso..."
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingAI(false)}
                                            className="px-3 py-1.5 rounded text-xs font-semibold text-muted hover:text-secondary transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={savingAI}
                                            onClick={handleSaveAI}
                                            className="px-3 py-1.5 rounded text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-all flex items-center gap-1 disabled:bg-accent/50"
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
                                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider">Clasificación Técnica</h4>
                                        <p className="mt-1 font-medium text-foreground">{ticket.ai_classification || 'No clasificado'}</p>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider">Resumen de Diagnóstico</h4>
                                        <p className="mt-1 text-secondary leading-relaxed text-xs">{ticket.ai_summary || 'Sin resumen analítico disponible.'}</p>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">Sugerencias de Resolución (Playbook)</h4>
                                        <div className="text-secondary leading-relaxed text-xs bg-card/50 p-3 rounded-lg border border-border">
                                            {parseSuggestions(ticket.ai_suggestions)}
                                        </div>
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