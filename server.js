'use strict';

/*
  Secure local backend for the PV2 John Doe HTML Prompt Builder.

  This server keeps the OpenAI API key out of the browser. The HTML calls:
  - GET  /api/health
  - POST /api/chat
  - POST /api/generate-image

  Configure the API key and model names in a server-side .env file.
*/

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3000);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.5';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1536x1024';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'high';
const OPENAI_IMAGE_FORMAT = process.env.OPENAI_IMAGE_FORMAT || 'png';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function requireApiKey(res) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sk-your-api-key-here') {
    res.status(500).json({
      error: 'OPENAI_API_KEY is not configured on the backend.',
      fix: 'Copy .env.example to .env, paste your OpenAI API key in .env, then restart the server.'
    });
    return false;
  }
  return true;
}

function normalizeReasoningEffort(value) {
  const allowed = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
  const requested = String(value || 'xhigh').toLowerCase();
  return allowed.has(requested) ? requested : 'xhigh';
}

function safeErrorText(text) {
  const value = String(text || '');
  return value.length > 4000 ? value.slice(0, 4000) + '… [truncated]' : value;
}

function extractTextFromResponsesApi(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string') return data.output_text;
  if (typeof data.text === 'string') return data.text;

  const output = Array.isArray(data.output) ? data.output : [];
  const parts = [];
  for (const item of output) {
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const block of content) {
      if (typeof block.text === 'string') parts.push(block.text);
      if (typeof block.output_text === 'string') parts.push(block.output_text);
    }
  }
  return parts.join('');
}

function createRequestId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logBackendEvent(eventType, details) {
  const safeDetails = Object.assign({}, details || {});
  delete safeDetails.apiKey;
  delete safeDetails.authorization;
  console.log(JSON.stringify({
    time: new Date().toISOString(),
    eventType,
    details: safeDetails
  }));
}

function logBackendError(eventType, error, details) {
  const safeDetails = Object.assign({}, details || {});
  delete safeDetails.apiKey;
  delete safeDetails.authorization;
  console.error(JSON.stringify({
    time: new Date().toISOString(),
    eventType,
    error: {
      name: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? safeErrorText(error.stack) : ''
    },
    details: safeDetails
  }));
}

async function fetchOpenAI(url, options, timeoutMs) {
  /*
    Do not attach this to req.on('close'). In Node/Express, request close can
    fire after the inbound body is read, which can accidentally abort the
    outbound OpenAI request and cause fast HTTP 500 failures.
  */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 240000);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'PV2 John Doe local API backend',
    time: new Date().toISOString(),
    hasApiKey: !!OPENAI_API_KEY && OPENAI_API_KEY !== 'sk-your-api-key-here',
    textModel: OPENAI_TEXT_MODEL,
    imageModel: OPENAI_IMAGE_MODEL,
    imageSize: OPENAI_IMAGE_SIZE,
    imageQuality: OPENAI_IMAGE_QUALITY,
    imageFormat: OPENAI_IMAGE_FORMAT,
    backendVersion: '2026-05-15-v2-openai-fetch-timeout-fix',
    nodeVersion: process.version
  });
});

app.post('/api/chat', async (req, res) => {
  const requestId = createRequestId('chat');
  if (!requireApiKey(res)) return;

  const prompt = String(req.body && req.body.prompt ? req.body.prompt : '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt.' });
    return;
  }

  const reasoningEffort = normalizeReasoningEffort(req.body.reasoningEffort);
  const stream = req.body.stream !== false;

  logBackendEvent('chat_request_received', { requestId, model: OPENAI_TEXT_MODEL, promptLength: prompt.length, reasoningEffort });

  const requestBody = {
    model: OPENAI_TEXT_MODEL,
    input: prompt,
    reasoning: {
      effort: reasoningEffort
    },
    stream
  };

  try {
    const openaiResponse = await fetchOpenAI('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 240000);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      logBackendEvent('chat_openai_error_response', { requestId, status: openaiResponse.status, details: safeErrorText(errorText) });
      res.status(openaiResponse.status).json({
        error: 'OpenAI text request failed.',
        requestId,
        status: openaiResponse.status,
        details: safeErrorText(errorText)
      });
      return;
    }

    if (!stream) {
      const data = await openaiResponse.json();
      logBackendEvent('chat_response_completed', { requestId, stream: false });
      res.json({ text: extractTextFromResponsesApi(data), rawType: data && data.object ? data.object : 'response', requestId });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const reader = openaiResponse.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
      logBackendEvent('chat_stream_completed', { requestId });
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || String(error) })}\n\n`);
      res.end();
      return;
    }
    logBackendError('chat_route_failed', error, { requestId, model: OPENAI_TEXT_MODEL });
    res.status(500).json({
      error: 'Backend chat route failed.',
      requestId,
      message: error.message || String(error),
      hint: 'Check Render logs for this requestId. If the message mentions abort, update server.js to the timeout-fix version.'
    });
  }
});

app.post('/api/generate-image', async (req, res) => {
  const requestId = createRequestId('image');
  if (!requireApiKey(res)) return;

  const prompt = String(req.body && req.body.prompt ? req.body.prompt : '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt.' });
    return;
  }

  logBackendEvent('image_request_received', { requestId, model: OPENAI_IMAGE_MODEL, promptLength: prompt.length, size: OPENAI_IMAGE_SIZE, quality: OPENAI_IMAGE_QUALITY, format: OPENAI_IMAGE_FORMAT });

  const requestBody = {
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: OPENAI_IMAGE_SIZE,
    quality: OPENAI_IMAGE_QUALITY,
    output_format: OPENAI_IMAGE_FORMAT
  };

  try {
    const openaiResponse = await fetchOpenAI('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 240000);

    const data = await openaiResponse.json().catch(async () => ({ raw: await openaiResponse.text() }));

    if (!openaiResponse.ok) {
      logBackendEvent('image_openai_error_response', { requestId, status: openaiResponse.status, details: safeErrorText(JSON.stringify(data)) });
      res.status(openaiResponse.status).json({
        error: 'OpenAI image request failed.',
        requestId,
        status: openaiResponse.status,
        details: data
      });
      return;
    }

    const first = data && Array.isArray(data.data) ? data.data[0] : null;
    if (!first) {
      res.status(502).json({ error: 'OpenAI image response did not include image data.', requestId, details: data });
      return;
    }

    if (first.b64_json) {
      res.json({
        requestId,
        imageBase64: `data:image/${OPENAI_IMAGE_FORMAT};base64,${first.b64_json}`,
        revisedPrompt: first.revised_prompt || '',
        model: OPENAI_IMAGE_MODEL,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        format: OPENAI_IMAGE_FORMAT
      });
      return;
    }

    if (first.url) {
      res.json({
        requestId,
        imageUrl: first.url,
        revisedPrompt: first.revised_prompt || '',
        model: OPENAI_IMAGE_MODEL,
        size: OPENAI_IMAGE_SIZE,
        quality: OPENAI_IMAGE_QUALITY,
        format: OPENAI_IMAGE_FORMAT
      });
      return;
    }

    res.status(502).json({
      error: 'OpenAI image response did not include b64_json or url.',
      requestId,
      details: data
    });
  } catch (error) {
    logBackendError('image_route_failed', error, { requestId, model: OPENAI_IMAGE_MODEL, size: OPENAI_IMAGE_SIZE });
    res.status(500).json({
      error: 'Backend image route failed.',
      requestId,
      message: error.message || String(error),
      hint: 'Check Render logs for this requestId. If the message mentions abort, update server.js to the timeout-fix version.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found.',
    path: req.path,
    availableRoutes: ['GET /api/health', 'POST /api/chat', 'POST /api/generate-image']
  });
});

app.listen(PORT, () => {
  console.log(`PV2 John Doe local backend running at http://localhost:${PORT}`);
  console.log(`Open the HTML at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
