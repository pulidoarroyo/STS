import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request,
    })

    // If there are no Supabase auth cookies, skip server-side auth refresh to avoid hanging
    const hasAuthCookie = request.cookies.get('sb-access-token') || request.cookies.get('sb-refresh-token');
    if (!hasAuthCookie) {
        return response;
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                // ✅ New API – correct shape
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );


    try {
        // Attempt to refresh and validate session
        await supabase.auth.getUser();
    } catch (error) {
        // On error (e.g., stale/invalid cookies), clear Supabase auth cookies to avoid hangs
        request.cookies.getAll().forEach(({ name }) => {
            response.cookies.delete(name);
        });
        console.error('Supabase auth error in proxy, cleared cookies:', error);
    }

    return response;
}

export const config = {
    matcher: [
        // Excludes static files, images, favicon, api endpoints, and auth paths
        '/((?!_next/static|_next/image|favicon.ico|auth|api).*)',
    ],
}
