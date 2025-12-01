const allowedOrigins = (process.env.ADVISOR_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

export default function handler(req, res) {
    const origin = resolveOrigin(req);
    if (origin === null) {
        return sendJson(res, 403, { error: 'Origin not allowed' });
    }

    if (req.method === 'OPTIONS') {
        return sendJson(res, 204, {}, origin);
    }

    if (req.method !== 'GET') {
        return sendJson(res, 405, { error: 'Method not allowed' }, origin);
    }

    return sendJson(res, 200, { status: 'ok' }, origin);
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

    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';

    res.writeHead(statusCode, headers);
    res.end(statusCode === 204 ? '' : JSON.stringify(data));
}
