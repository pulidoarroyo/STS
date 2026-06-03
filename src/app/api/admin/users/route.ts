import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { action, targetUserId, newRole, callerUserId } = await req.json();

        if (!action || !targetUserId || !callerUserId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        // Initialize standard client to verify the caller's role in the DB
        const client = createClient(supabaseUrl, supabaseAnonKey);
        const { data: callerProfile, error: callerError } = await client
            .from('profiles')
            .select('role')
            .eq('id', callerUserId)
            .single();

        if (callerError || !callerProfile || callerProfile.role !== 'Admin') {
            return NextResponse.json({ error: 'Access denied: Caller is not an Administrator' }, { status: 403 });
        }

        // Initialize the admin client with the service role key to bypass RLS
        if (!serviceRoleKey) {
            return NextResponse.json({
                error: 'SUPABASE_SERVICE_ROLE_KEY is not defined in the server environment variables. Please add it to your .env file.'
            }, { status: 500 });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });

        if (action === 'updateRole') {
            if (targetUserId === callerUserId) {
                return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
            }

            const { data, error } = await adminClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', targetUserId)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                return NextResponse.json({ error: 'User profile not found or role was not modified' }, { status: 404 });
            }

            return NextResponse.json({ success: true, profile: data[0] });

        } else if (action === 'deleteUser') {
            if (targetUserId === callerUserId) {
                return NextResponse.json({ error: 'You cannot delete yourself' }, { status: 400 });
            }

            // Delete user profile first (triggers/constraints will be checked)
            const { error: profileDeleteError } = await adminClient
                .from('profiles')
                .delete()
                .eq('id', targetUserId);

            if (profileDeleteError) {
                if (profileDeleteError.code === '23503') {
                    return NextResponse.json({
                        error: 'This user cannot be deleted because they have registered tickets or comments in the system. Reassign or delete their incidents first.'
                    }, { status: 400 });
                }
                throw profileDeleteError;
            }

            // Delete user from Supabase Auth so they can no longer login
            const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
            if (authDeleteError) {
                console.warn('Profile deleted, but auth user deletion warning:', authDeleteError.message);
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (err: any) {
        console.error('Admin API error:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
