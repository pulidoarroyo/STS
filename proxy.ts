import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
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
        await supabase.auth.getUser();
    } catch (error) {
        const sbCookies = request.cookies.getAll().filter(c => c.name.startsWith('sb-'));
        sbCookies.forEach(({ name }) => {
            response.cookies.delete(name);
        });
        console.error('Supabase auth error in proxy, cleared cookies:', error, 'Request cookies:', request.cookies.getAll());
    }

    return response;
}

export const config = {
    matcher: [
        // Excludes static files, images, favicon, api endpoints, and auth paths
        '/((?!_next/static|_next/image|favicon.ico|auth|api).*)',
    ],
}
