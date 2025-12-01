import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

// Allow multiple origins: "https://app1.com,https://app2.com"
const allowedOrigins = (process.env.ADVISOR_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? createGroq({ apiKey: groqApiKey }) : null;

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        const origin = resolveOrigin(req);
        return sendJson(res, origin === null ? 403 : 204, {}, origin);
    }

    const origin = resolveOrigin(req);
    if (origin === null) {
        return sendJson(res, 403, { error: 'Origin not allowed' });
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' }, origin);
    }

    if (!groq) {
        return sendJson(res, 500, { error: 'GROQ_API_KEY is not configured on the server.' }, origin);
    }

    let payload = req.body || {};
    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch {
            return sendJson(res, 400, { error: 'Invalid JSON payload' }, origin);
        }
    }

    const { history, userMessage, contextData } = payload;

    if (!Array.isArray(history) || typeof userMessage !== 'string' || typeof contextData !== 'string') {
        return sendJson(
            res,
            400,
            { error: 'Missing or invalid history, userMessage, or contextData fields.' },
            origin,
        );
    }

    const conversationHistory = history
        .map(message => {
            if (!message || typeof message !== 'object') {
                return null;
            }
            const role = message.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${message.content}`;
        })
        .filter(Boolean)
        .join('\n');

    const systemPrompt = [
        'You are a helpful financial assistant.',
        '',
        'Use the CONTEXT_JSON to reason about the user’s finances.',
        'Instructions:',
        '1. For questions about “current” or “this month”, rely on summary.current_month.',
        '2. For specific months mentioned by name, inspect monthly_trends entries with matching month_simple.',
        '3. When a user asks about category spending, pull from the relevant breakdown for that month.',
        '4. Keep answers short, friendly, and focused on actionable insight.',
    ].join('\n');

    const fullPrompt = `${systemPrompt}

CONTEXT_JSON:
\`\`\`json
${contextData}
\`\`\`

Conversation History:
${conversationHistory}

User: ${userMessage}

Assistant:`;

    try {
        const { text } = await generateText({
            model: groq('llama-3.1-70b-versatile'),
            prompt: fullPrompt,
            temperature: 0.7,
            maxTokens: 1024,
        });

        return sendJson(res, 200, { text }, origin);
    } catch (error) {
        const message = error?.message || 'Unknown Groq error';
        return sendJson(
            res,
            502,
            {
                error: 'Unable to generate advice. Please verify your Groq API key and try again.',
                details: message,
            },
            origin,
        );
    }
}

function resolveOrigin(req) {
    if (!allowedOrigins.length) {
        return '*';
    }

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }

    return null;
}

function sendJson(res, statusCode, data, originOverride) {
    const headers = {
        'Content-Type': 'application/json',
    };

    const originHeader = originOverride || (allowedOrigins.length ? undefined : '*');
    if (originHeader) {
        headers['Access-Control-Allow-Origin'] = originHeader;
    }

    // Minimal CORS headers for preflight
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';

    res.writeHead(statusCode, headers);
    res.end(statusCode === 204 ? '' : JSON.stringify(data));
}
