import http from 'http';
import fs from 'fs';
import path from 'path';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

loadEnvFiles();

const PORT = Number(process.env.ADVISOR_SERVER_PORT || process.env.PORT || 8788);
const API_ROUTE = '/api/advisor';
const allowedOrigins = (process.env.ADVISOR_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? createGroq({ apiKey: groqApiKey }) : null;

if (!groqApiKey) {
    console.warn('[advisor-server] GROQ_API_KEY is missing. Set it in .env or your environment before starting the server.');
}

const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
        return handleOptions(req, res);
    }

    if (req.method === 'POST' && requestUrl.pathname === API_ROUTE) {
        return handleAdvisorRequest(req, res);
    }

    if (req.method === 'GET' && requestUrl.pathname === `${API_ROUTE}/health`) {
        const origin = resolveOrigin(req);
        if (origin === null) {
            return sendJson(res, 403, { error: 'Origin not allowed' });
        }
        return sendJson(res, 200, { status: 'ok' }, origin);
    }

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
        return sendJson(res, 200, { status: 'ok' });
    }

    sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
    console.log(`[advisor-server] listening on http://localhost:${PORT}${API_ROUTE}`);
});

function loadEnvFiles() {
    const envFiles = [
        { file: path.resolve(process.cwd(), '.env'), override: false },
        { file: path.resolve(process.cwd(), '.env.local'), override: true },
    ];

    envFiles.forEach(({ file, override }) => {
        if (!fs.existsSync(file)) {
            return;
        }

        const content = fs.readFileSync(file, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                return;
            }

            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex === -1) {
                return;
            }

            const key = trimmed.slice(0, separatorIndex).trim();
            let value = trimmed.slice(separatorIndex + 1).trim();

            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            if (!key) {
                return;
            }

            if (override || typeof process.env[key] === 'undefined') {
                process.env[key] = value;
            }
        });
    });
}

function handleOptions(req, res) {
    const origin = resolveOrigin(req);
    if (origin === null) {
        res.writeHead(403);
        return res.end();
    }

    res.writeHead(204, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    });
    res.end();
}

async function handleAdvisorRequest(req, res) {
    const origin = resolveOrigin(req);
    if (origin === null) {
        return sendJson(res, 403, { error: 'Origin not allowed' });
    }

    if (!groq) {
        return sendJson(res, 500, { error: 'GROQ_API_KEY is not configured on the server.' }, origin);
    }

    let bodyString = '';
    try {
        bodyString = await readRequestBody(req);
    } catch (error) {
        console.error('[advisor-server] Failed to read request body', error);
        return sendJson(res, 413, { error: 'Request body too large' }, origin);
    }

    let payload;
    try {
        payload = JSON.parse(bodyString || '{}');
    } catch (error) {
        return sendJson(res, 400, { error: 'Invalid JSON payload' }, origin);
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
        console.error('[advisor-server] Groq request failed', error);
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

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
            data += chunk;
            if (data.length > 1_000_000) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
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

    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
}
