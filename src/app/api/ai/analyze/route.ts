import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize with the empty options wrapper to keep TypeScript happy
const ai = new GoogleGenAI({});

export async function POST(request: Request) {
    try {
        const { systemPrompt, userContent } = await request.json();

        if (!systemPrompt || !userContent) {
            return NextResponse.json({ error: 'Missing required prompt payloads' }, { status: 400 });
        }

        // Force strict JSON mode using standard text processing
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nAnalyze this content:\n${userContent}`,
            config: {
                // This tells Gemini to output valid JSON text string natively
                responseMimeType: 'application/json',
                temperature: 0.1, // Locked low for predictive results
            }
        });

        let rawResponseText = response.text;

        if (!rawResponseText) {
            throw new Error('Empty response from generative engine');
        }

        // Clean up markdown code blocks if the model accidentally includes them (e.g., ```json ... ```)
        rawResponseText = rawResponseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

        // Validate that it is indeed a parseable JSON structure before passing it forward
        try {
            JSON.parse(rawResponseText);
        } catch {
            // Fallback object structure if validation fails
            rawResponseText = JSON.stringify({
                summary: "No se pudo procesar el resumen.",
                classification: "General",
                suggestions: "- Revisar el ticket de manera manual.",
                riskLevel: "Medium"
            });
        }

        // Standardize payload format to match what modules/ai/aiService.ts expects
        const normalizedPayload = {
            choices: [
                {
                    message: {
                        content: rawResponseText
                    }
                }
            ]
        };

        return NextResponse.json(normalizedPayload);

    } catch (error: any) {
        console.error('Gemini Route Error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}