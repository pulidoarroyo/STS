import { supabase } from '@/lib/supabaseClient';

export interface AIAnaLysisResult {
    summary: string;
    classification: string;
    suggestions: string;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

/**
 * Sends ticket content to our local Gemini API route,
 * and records the full execution trace context to Supabase.
 */
export async function analyzeTicketWithAI(
    ticketId: string,
    title: string,
    description: string
): Promise<AIAnaLysisResult | null> {
    const startTime = Date.now();
    const modelVersion = 'gemini-2.5-flash';

    const systemPrompt = `
    You are an advanced IT Support AI. Analyze the following support ticket.
    You MUST respond with a valid, single JSON object. Do not include markdown codeblocks (like \`\`\`json) or conversational text.
    
    The JSON object must contain exactly these four keys:
    1. "summary": A concise 1-sentence summary of the core technical issue.
    2. "classification": The specific IT domain (e.g., Network, Database, Hardware, Auth).
    3. "suggestions": Brief, bulleted initial troubleshooting steps for the agent.
    4. "riskLevel": Must be exactly one of these strings: "Low", "Medium", "High", or "Critical".
  `;

    const userContent = `Ticket Title: ${title}\nDescription: ${description}`;

    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userContent }),
        });

        if (!response.ok) throw new Error('AI Engine fetch failed');

        const result = await response.json();

        //  Updated line to map perfectly to our Gemini route's normalized payload!
        const rawResponseText = result.choices[0].message.content;

        // Parse the structural JSON payload
        const parsedData: AIAnaLysisResult = JSON.parse(rawResponseText);
        const latencyMs = Date.now() - startTime;

        // Log tracking metrics to your database table
        const { error: logError } = await supabase
            .from('ai_audit_logs')
            .insert({
                ticket_id: ticketId,
                model_version: modelVersion,
                prompt_context: `${systemPrompt}\n\n${userContent}`,
                raw_response_json: parsedData,
                latency_ms: latencyMs
            });

        if (logError) console.error('Auditing failed to record:', logError.message);

        return parsedData;

    } catch (error) {
        console.error('CRITICAL: AI Automation error:', error);
        return null;
    }
}