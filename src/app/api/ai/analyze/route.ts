import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(request: Request) {
    try {
        const { systemPrompt, userContent } = await request.json();

        if (!systemPrompt || !userContent) {
            return NextResponse.json({ error: 'Missing required prompt payloads' }, { status: 400 });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nAnalyze this content:\n${userContent}`,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            }
        });

        let rawResponseText = response.text;

        if (!rawResponseText) {
            throw new Error('Empty response from generative engine');
        }

        rawResponseText = rawResponseText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

        try {
            JSON.parse(rawResponseText);
        } catch {
            rawResponseText = JSON.stringify({
                summary: "No se pudo procesar el resumen.",
                classification: "General",
                suggestions: "- Revisar el ticket de manera manual.",
                riskLevel: "Medium"
            });
        }

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