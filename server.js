'use strict';

/*
  PV2 John Doe prompt builder hosting server.

  This version is manual-mode only. It serves the HTML/CSS/JS and image assets.
  It does not call the OpenAI API, does not require an OpenAI API key, and does
  not expose any API secrets in the browser.
*/

const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'PV2 John Doe manual ChatGPT workflow host',
    mode: 'manual-chatgpt-plus-workflow',
    noApiRequired: true,
    time: new Date().toISOString(),
    backendVersion: '2026-05-15-v4-manual-chatgpt-workflow',
    nodeVersion: process.version
  });
});

// Compatibility health route for older bookmarks/tests. This does not call OpenAI.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'PV2 John Doe manual ChatGPT workflow host',
    mode: 'manual-chatgpt-plus-workflow',
    noApiRequired: true,
    hasApiKey: false,
    note: 'API automation has been removed. Use the in-page ChatGPT Plus Manual Workflow to copy prompts and open ChatGPT manually.',
    time: new Date().toISOString(),
    backendVersion: '2026-05-15-v4-manual-chatgpt-workflow',
    nodeVersion: process.version
  });
});

app.listen(PORT, () => {
  console.log(`PV2 John Doe manual workflow site running at http://localhost:${PORT}`);
});
