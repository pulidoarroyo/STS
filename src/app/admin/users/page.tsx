'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '@/modules/auth/components/ProtectedRoute';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface UserProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
}

function AdminUsersPage() {
    const { user, profile: currentUserProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Enforce Admin role
    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/auth/login');
            } else if (currentUserProfile && currentUserProfile.role !== 'Admin') {
                router.push('/dashboard');
            }
        }
    }, [user, currentUserProfile, authLoading, router]);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsersList(data || []);
        } catch (err: any) {
            console.error('Error fetching users:', err.message);
            setMessage({ type: 'error', text: 'Failed to load users: ' + err.message });
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (currentUserProfile?.role === 'Admin') {
            fetchUsers();
        }
    }, [currentUserProfile]);

    const handleRoleChange = async (targetUserId: string, newRole: string) => {
        try {
            setUpdatingId(targetUserId);
            setMessage(null);
            
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateRole',
                    targetUserId,
                    newRole,
                    callerUserId: user.id,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update user role');
            }

            setUsersList(prev =>
                prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u)
            );
            setMessage({ type: 'success', text: 'User role updated successfully!' });
        } catch (err: any) {
            console.error('Error updating role:', err.message);
            setMessage({ type: 'error', text: 'Error updating role: ' + err.message });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteUser = async (targetUserId: string) => {
        try {
            setDeletingId(targetUserId);
            setMessage(null);

            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deleteUser',
                    targetUserId,
                    callerUserId: user.id,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete user');
            }

            setUsersList(prev => prev.filter(u => u.id !== targetUserId));
            setMessage({ type: 'success', text: 'User profile deleted successfully.' });
        } catch (err: any) {
            console.error('Error deleting user:', err.message);
            setMessage({ type: 'error', text: err.message });
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    // Render loading state if auth or users are loading
    if (authLoading || (loadingUsers && currentUserProfile?.role === 'Admin')) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-surface">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    // Access protection backup check
    if (!user || currentUserProfile?.role !== 'Admin') {
        return null;
    }

    return (
        <div className="min-h-screen bg-surface p-6 sm:p-10 text-foreground">
            <div className="max-w-7xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                    <div>
                        {/* Breadcrumbs / Title */}
                        <div className="flex items-center gap-2 mb-1 text-xs text-muted font-medium uppercase tracking-wider">
                            <Link href="/dashboard" className="hover:text-accent transition-colors">Dashboard</Link>
                            <span>/</span>
                            <span className="text-secondary">Manage Users</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            User Management
                        </h1>
                        <p className="text-sm text-muted mt-1">
                            Modify user roles or delete user profiles from the system.
                        </p>
                    </div>

                    <div>
                        <Link
                            href="/dashboard"
                            className="inline-flex justify-center items-center px-4 py-2.5 bg-card hover:bg-elevated text-secondary hover:text-foreground font-medium text-sm rounded-lg border border-border hover:border-accent/30 transition-all text-center"
                        >
                            ← Back to Dashboard
                        </Link>
                    </div>
                </div>

                {/* Notifications & System Alerts */}
                {message && (
                    <div className={`p-4 rounded-xl text-sm mb-6 border transition-all ${
                        message.type === 'success'
                            ? 'bg-success-subtle text-success border-success/20'
                            : 'bg-danger-subtle text-danger border-danger/20'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold">{message.type === 'success' ? 'Success:' : 'Error:'}</span>
                                <span>{message.text}</span>
                            </div>
                            <button onClick={() => setMessage(null)} className="text-muted hover:text-foreground font-bold ml-4">×</button>
                        </div>
                    </div>
                )}

                {/* User List Table */}
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-border">
                        <h2 className="text-lg font-bold text-foreground">System Users</h2>
                    </div>

                    {usersList.length === 0 ? (
                        <div className="p-10 text-center text-muted">
                            No profiles found in the system database.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-elevated text-muted uppercase text-xs font-semibold tracking-wider border-b border-border">
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Registered On</th>
                                        <th className="px-6 py-4">System Role</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-sm text-secondary">
                                    {usersList.map((profileItem) => {
                                        const isSelf = user.id === profileItem.id;
                                        const isConfirmingDelete = confirmDeleteId === profileItem.id;

                                        return (
                                            <tr key={profileItem.id} className="hover:bg-elevated/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                                            isSelf ? 'bg-accent text-white' : 'bg-elevated text-secondary border border-border'
                                                        }`}>
                                                            {profileItem.full_name?.[0] || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-foreground">
                                                                {profileItem.full_name || 'No Name Provided'}
                                                                {isSelf && <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent-subtle text-accent border border-accent/20">You</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">
                                                    {profileItem.email}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {new Date(profileItem.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={profileItem.role || 'User'}
                                                            disabled={isSelf || updatingId === profileItem.id}
                                                            onChange={(e) => handleRoleChange(profileItem.id, e.target.value)}
                                                            className="px-2.5 py-1.5 bg-elevated border border-border rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                                        >
                                                            <option value="User">User</option>
                                                            <option value="Agent">Agent</option>
                                                            <option value="Admin">Admin</option>
                                                        </select>
                                                        {updatingId === profileItem.id && (
                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent"></div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {isSelf ? (
                                                        <span className="text-xs text-muted italic">Self management locked</span>
                                                    ) : isConfirmingDelete ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-xs text-danger font-semibold">Confirm Delete?</span>
                                                            <button
                                                                onClick={() => handleDeleteUser(profileItem.id)}
                                                                disabled={deletingId === profileItem.id}
                                                                className="px-2.5 py-1 bg-danger text-white rounded text-xs font-semibold hover:bg-critical transition-all disabled:opacity-50"
                                                            >
                                                                {deletingId === profileItem.id ? 'Deleting...' : 'Yes'}
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteId(null)}
                                                                className="px-2.5 py-1 bg-elevated text-secondary rounded text-xs font-semibold hover:bg-card border border-border transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteId(profileItem.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger hover:text-white hover:border-danger transition-all"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                            </svg>
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default function SafeAdminUsersPage() {
    return (
        <ProtectedRoute>
            <AdminUsersPage />
        </ProtectedRoute>
    );
}
