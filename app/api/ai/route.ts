import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

// Simple in-memory rate limiting for development
const rateLimitMap = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase ID token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      initAdmin();
      await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 2. Simple Rate Limiting by IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const limit = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - limit.lastReset > RATE_LIMIT_WINDOW) {
      limit.count = 1;
      limit.lastReset = now;
    } else {
      limit.count++;
    }
    rateLimitMap.set(ip, limit);

    if (limit.count > MAX_REQUESTS) {
      return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 });
    }

    // 3. Process Request
    const { message, context } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const systemPrompt = `You are Money Agent, an intelligent personal finance advisor. You help users manage their money wisely.

Current Financial Context:
${context || 'No financial data provided yet.'}

Guidelines:
- Give specific, actionable financial advice
- Use the provided financial data to make personalized suggestions
- Format currency in Indian Rupees (₹)
- Be encouraging but honest about spending habits
- Suggest concrete savings strategies
- Keep responses concise and practical
- Use bullet points for clarity
- If no data is available, give general financial tips`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.text();
      console.error('Gemini API error:', errData);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not generate a response. Please try again.';

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
