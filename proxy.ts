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
                    const allCookies = request.cookies.getAll();
                    console.log('Proxy: getAll cookies - Request:', allCookies.map(c => c.name));
                    return allCookies;
                },
                setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                        console.log(`Proxy: set cookie - Name: ${name}`);
                    });
                },
            },
        }
    );

    try {
        console.log('Proxy: Attempting to get user session...');
        const { data: { user }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError) {
            throw getUserError; // Re-throw to be caught by the existing catch block
        }
        console.log('Proxy: User session obtained:', user ? user.id : 'No user');
    } catch (error) {
        const sbCookies = request.cookies.getAll().filter(c => c.name.startsWith('sb-'));
        sbCookies.forEach(({ name }) => {
            response.cookies.delete(name);
            console.log(`Proxy: delete cookie - Name: ${name}`);
        });
        console.error('Proxy: Supabase auth error in proxy, cleared cookies:', error, 'Request cookies:', request.cookies.getAll().map(c => c.name));
    }

    return response;
}

export const config = {
    matcher: [
        // Excludes static files, images, favicon, api endpoints, and auth paths
        '/((?!_next/static|_next/image|favicon.ico|auth|api).*)',
    ],
}
