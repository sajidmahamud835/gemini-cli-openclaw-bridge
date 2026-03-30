require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

const app = express();
const randomPort = () => Math.floor(Math.random() * (9000 - 4000 + 1)) + 4000;
const PORT = process.env.PORT || randomPort();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = 'HS256';

function logEvent(event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  console.log(JSON.stringify(payload));
}

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET environment variable. Set JWT_SECRET before starting the server.');
  process.exit(1);
}

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  logEvent('request.start', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return req.headers['x-api-key'] || req.headers['api-key'];
}

function authenticate(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    logEvent('auth.failure', { requestId: req.requestId, reason: 'missing_token' });
    return res.status(401).json({ error: 'Missing API token', details: 'Use Authorization: Bearer <token> or X-API-Key header.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.apiToken = payload;
    logEvent('auth.success', { requestId: req.requestId, sub: payload.sub || 'unknown' });
    next();
  } catch (err) {
    logEvent('auth.failure', { requestId: req.requestId, reason: 'invalid_token', details: err.message });
    return res.status(401).json({ error: 'Invalid API token', details: err.message });
  }
}

app.use(authenticate);

function sanitizeMessageContent(content) {
  if (typeof content !== 'string') {
    return '';
  }

  // Strong sanitization: remove control characters and limit length.
  const cleaned = content
    .replace(/\u0000|\u0001|\u0002|\u0003|\u0004|\u0005|\u0006|\u0007|\u0008|\u0009|\u000b|\u000c|\u000e|\u000f|\u0010|\u0011|\u0012|\u0013|\u0014|\u0015|\u0016|\u0017|\u0018|\u0019|\u001a|\u001b|\u001c|\u001d|\u001e|\u001f/g, '')
    .trim();

  return cleaned.slice(0, 2000);
}

function parseGeminiError(stderr) {
  const message = stderr.trim();
  const lower = message.toLowerCase();

  if (lower.includes('exhausted your capacity') || lower.includes('quota') || lower.includes('rate limit') || lower.includes('rate-limited')) {
    return {
      status: 429,
      payload: {
        error: 'Gemini rate-limited',
        details: message || 'Gemini has hit a temporary rate/usage limit.',
      },
    };
  }

  if (lower.includes('timeout')) {
    return {
      status: 504,
      payload: {
        error: 'Gemini timed out',
        details: message || 'Gemini CLI timed out while generating the response.',
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: 'gemini CLI execution failed',
      details: message || 'Exit code indicates an unknown Gemini failure.',
    },
  };
}

function buildPrompt(messages) {
  return messages
    .map((message) => {
      const role = message.role || 'user';
      const content = sanitizeMessageContent(message.content);
      return `${role}: ${content}`;
    })
    .join('\n');
}

app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    const prompt = buildPrompt(messages);

    if (!prompt) {
      return res.status(400).json({ error: 'messages must contain valid text content' });
    }

    logEvent('provider.request', {
      requestId: req.requestId,
      model: 'cli-bridge/gemini-local',
      messageCount: messages.length,
      promptLength: prompt.length,
      authSub: req.apiToken?.sub || 'unknown',
    });

    const useShell = process.platform === 'win32';
    const command = useShell ? `gemini --prompt ${JSON.stringify(prompt)}` : 'gemini';
    const args = useShell ? [] : ['--prompt', prompt];

    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell,
    });

    let stdout = '';
    let stderr = '';
    let responded = false;
    const timeoutMs = 30000;
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const sendError = (status, payload) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);
      return res.status(status).json(payload);
    };

    child.on('close', (code) => {
      if (responded) return;
      clearTimeout(timeout);

      if (code !== 0) {
        const errorInfo = parseGeminiError(stderr);
        logEvent('provider.error', {
          requestId: req.requestId,
          code,
          stderr: stderr.trim(),
          status: errorInfo.status,
        });
        return sendError(errorInfo.status, errorInfo.payload);
      }

      const assistantText = stdout.trim();
      logEvent('provider.response', {
        requestId: req.requestId,
        responseLength: assistantText.length,
      });

      responded = true;
      return res.json({
        id: 'local-gemini-response',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gemini-local',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: assistantText,
            },
            finish_reason: 'stop',
          },
        ],
      });
    });

    child.on('error', (err) => {
      logEvent('provider.spawn_error', {
        requestId: req.requestId,
        error: err.message,
      });
      return sendError(500, {
        error: 'Failed to start gemini CLI',
        details: err.message,
      });
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      details: 'The request body exceeded the server limit. Increase server limit or reduce OpenClaw context size.',
    });
  }

  if (err) {
    return res.status(400).json({
      error: 'Invalid JSON payload',
      details: err.message,
    });
  }

  next();
});

app.listen(PORT, () => {
  console.log(`Gemini OpenAI bridge listening on http://localhost:${PORT}`);
});
