const express = require('express');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = 'HS256';

if (!JWT_SECRET) {
  console.error('Missing JWT_SECRET environment variable. Set JWT_SECRET before starting the server.');
  process.exit(1);
}

app.use(express.json());

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
    return res.status(401).json({ error: 'Missing API token', details: 'Use Authorization: Bearer <token> or X-API-Key header.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.apiToken = payload;
    next();
  } catch (err) {
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

    const sendError = (payload) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeout);
      return res.status(500).json(payload);
    };

    child.on('close', (code) => {
      if (responded) return;
      clearTimeout(timeout);

      if (code !== 0) {
        return sendError({
          error: 'gemini CLI execution failed',
          details: stderr.trim() || `Exit code ${code}`,
        });
      }

      const assistantText = stdout.trim();

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
      return sendError({
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

app.listen(PORT, () => {
  console.log(`Gemini OpenAI bridge listening on http://localhost:${PORT}`);
});
