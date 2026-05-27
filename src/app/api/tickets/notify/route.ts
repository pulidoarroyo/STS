import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ticket, ai } = body;

        // Validate minimum required fields
        if (!ticket?.id || !ai) {
            return NextResponse.json(
                { error: 'Missing required fields: ticket.id and ai block are required' },
                { status: 400 }
            );
        }

        // Check if n8n is configured before doing any work
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            console.warn('[n8n] N8N_WEBHOOK_URL is not set — skipping webhook dispatch.');
            return NextResponse.json({ skipped: true, reason: 'N8N_WEBHOOK_URL not configured' });
        }

        // Build the normalized payload for n8n to route on
        // Data comes directly from the client — no Supabase re-query needed (avoids RLS issues)
        const payload = {
            ticket: {
                id: ticket.id,
                title: ticket.title ?? '',
                description: ticket.description ?? '',
                status: ticket.status ?? 'Open',
                created_at: ticket.created_at ?? new Date().toISOString(),
                category: ticket.category ?? 'General',
                reporter: {
                    full_name: ticket.reporter?.full_name ?? 'Unknown',
                    email: ticket.reporter?.email ?? '',
                },
            },
            ai: {
                classification: ai.classification ?? 'Unclassified',
                risk_level: ai.risk_level ?? 'Unknown',
                summary: ai.summary ?? '',
                suggestions: ai.suggestions ?? '',
                is_critical: ai.is_critical === true || ai.risk_level?.toLowerCase() === 'critical',
            },
            meta: {
                source: 'stickets-api',
                dispatched_at: new Date().toISOString(),
            },
        };

        // Fire the webhook — 8-second timeout so it never blocks the client
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            const webhookResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!webhookResponse.ok) {
                console.warn(`[n8n] Webhook responded with status ${webhookResponse.status} for ticket ${ticket.id}`);
            } else {
                console.log(`[n8n] ✅ Webhook dispatched for ticket ${ticket.id} (critical=${payload.ai.is_critical})`);
            }

            return NextResponse.json({
                dispatched: true,
                webhook_status: webhookResponse.status,
                ticket_id: ticket.id,
                is_critical: payload.ai.is_critical,
            });

        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.warn('[n8n] Webhook request timed out after 8 seconds.');
                return NextResponse.json({ dispatched: false, reason: 'webhook_timeout' });
            }
            throw fetchError;
        }

    } catch (error: any) {
        console.error('[n8n] Unexpected error in notify route:', error.message || error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
