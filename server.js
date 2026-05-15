'use strict';

/*
  PV2 John Doe prompt builder hosting server.

  Manual ChatGPT Plus workflow host with server-side Scene Output uploads.
  This version does not call the OpenAI API and does not require API credits.
*/

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Default stores inside public/scene-outputs for local use.
// For real persistence on Render, attach a Persistent Disk and set:
// SCENE_OUTPUTS_DIR=/your/render/disk/mount/scene-outputs
const OUTPUT_ROOT = path.resolve(process.env.SCENE_OUTPUTS_DIR || path.join(PUBLIC_DIR, 'scene-outputs'));
const OUTPUT_URL_BASE = '/scene-outputs';
const METADATA_PATH = path.join(OUTPUT_ROOT, 'scene-outputs.json');
const TEMP_DIR = path.join(OUTPUT_ROOT, '_tmp');
const BACKEND_VERSION = '2026-05-15-v10-scene-outputs-upload-manager';

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDirSync(OUTPUT_ROOT);
ensureDirSync(TEMP_DIR);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(OUTPUT_URL_BASE, express.static(OUTPUT_ROOT));
app.use(express.static(PUBLIC_DIR));

const upload = multer({
  dest: TEMP_DIR,
  limits: {
    fileSize: 25 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  }
});

function sanitizeText(value, fallback = '') {
  return String(value || fallback || '').trim();
}

function sanitizeFilename(value, fallback = 'scene-output.png') {
  const raw = sanitizeText(value, fallback);
  const cleaned = raw
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function normalizeSceneNumber(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 18) return null;
  return n;
}

function sceneDir(sceneNumber) {
  return path.join(OUTPUT_ROOT, `scene-${String(sceneNumber).padStart(2, '0')}`);
}

function sceneUrl(sceneNumber, filename) {
  return `${OUTPUT_URL_BASE}/scene-${String(sceneNumber).padStart(2, '0')}/${encodeURIComponent(filename)}`;
}

async function readMetadata() {
  try {
    const raw = await fsp.readFile(METADATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.outputs) ? parsed.outputs : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    console.error('Failed to read scene output metadata:', err);
    return [];
  }
}

async function writeMetadata(outputs) {
  ensureDirSync(OUTPUT_ROOT);
  const payload = {
    updatedAt: new Date().toISOString(),
    outputs
  };
  const tmpPath = METADATA_PATH + '.tmp';
  await fsp.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  await fsp.rename(tmpPath, METADATA_PATH);
}

async function removeFileIfExists(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function publicMetadata(output) {
  return {
    id: output.id,
    sceneNumber: output.sceneNumber,
    sceneTitle: output.sceneTitle,
    fileName: output.fileName,
    originalFilename: output.originalFilename,
    displayTitle: output.displayTitle,
    notes: output.notes,
    dateUploaded: output.dateUploaded,
    dateUpdated: output.dateUpdated || null,
    promptUsed: output.promptUsed || '',
    isFinal: !!output.isFinal,
    imageUrl: output.imageUrl
  };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'PV2 John Doe manual ChatGPT workflow host',
    mode: 'manual-chatgpt-plus-workflow',
    noApiRequired: true,
    sceneOutputsEnabled: true,
    sceneOutputsDir: OUTPUT_ROOT,
    time: new Date().toISOString(),
    backendVersion: BACKEND_VERSION,
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
    sceneOutputsEnabled: true,
    sceneOutputsDir: OUTPUT_ROOT,
    note: 'API automation has been removed. Use the in-page ChatGPT Plus Manual Workflow and Scene Outputs upload manager.',
    time: new Date().toISOString(),
    backendVersion: BACKEND_VERSION,
    nodeVersion: process.version
  });
});

app.get('/api/scene-outputs', async (req, res) => {
  const outputs = await readMetadata();
  res.json({
    ok: true,
    backendVersion: BACKEND_VERSION,
    storage: {
      outputUrlBase: OUTPUT_URL_BASE,
      envSceneOutputsDirConfigured: !!process.env.SCENE_OUTPUTS_DIR
    },
    outputs: outputs.map(publicMetadata)
  });
});

app.post('/api/scene-outputs', upload.single('image'), async (req, res) => {
  let tempPath = req.file && req.file.path;
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No image file was uploaded.' });
    }

    const sceneNumber = normalizeSceneNumber(req.body.sceneNumber);
    if (!sceneNumber) {
      await removeFileIfExists(tempPath);
      return res.status(400).json({ ok: false, error: 'Scene number must be an integer from 1 to 18.' });
    }

    const targetDir = sceneDir(sceneNumber);
    ensureDirSync(targetDir);

    const originalFilename = sanitizeFilename(req.file.originalname || 'scene-output.png');
    const requestedFilename = sanitizeFilename(req.body.fileName || originalFilename);
    const extFromOriginal = path.extname(originalFilename);
    const extFromRequested = path.extname(requestedFilename);
    const ext = (extFromRequested || extFromOriginal || '.png').toLowerCase();
    const base = sanitizeFilename(path.basename(requestedFilename, extFromRequested || extFromOriginal || ext), 'scene-output');
    const unique = crypto.randomBytes(5).toString('hex');
    const finalFilename = `${base}-${unique}${ext}`;
    const finalPath = path.join(targetDir, finalFilename);

    await fsp.rename(tempPath, finalPath);
    tempPath = null;

    const now = new Date().toISOString();
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const output = {
      id,
      sceneNumber,
      sceneTitle: sanitizeText(req.body.sceneTitle, `Scene ${sceneNumber}`),
      fileName: finalFilename,
      originalFilename,
      displayTitle: sanitizeText(req.body.displayTitle, path.basename(originalFilename, path.extname(originalFilename))),
      notes: sanitizeText(req.body.notes, ''),
      dateUploaded: now,
      dateUpdated: null,
      promptUsed: sanitizeText(req.body.promptUsed, ''),
      isFinal: String(req.body.isFinal || '').toLowerCase() === 'true',
      imageUrl: sceneUrl(sceneNumber, finalFilename),
      diskPath: finalPath
    };

    const outputs = await readMetadata();
    if (output.isFinal) {
      outputs.forEach(item => {
        if (item.sceneNumber === sceneNumber) item.isFinal = false;
      });
    }
    outputs.push(output);
    await writeMetadata(outputs);

    res.status(201).json({ ok: true, output: publicMetadata(output) });
  } catch (err) {
    if (tempPath) await removeFileIfExists(tempPath).catch(() => {});
    console.error('Scene output upload failed:', err);
    res.status(500).json({
      ok: false,
      error: 'Scene output upload failed.',
      details: err.message
    });
  }
});

app.put('/api/scene-outputs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const outputs = await readMetadata();
    const idx = outputs.findIndex(item => item.id === id);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'Scene output not found.' });
    }

    const item = outputs[idx];
    if (typeof req.body.displayTitle === 'string') item.displayTitle = sanitizeText(req.body.displayTitle, item.displayTitle);
    if (typeof req.body.notes === 'string') item.notes = sanitizeText(req.body.notes, '');
    if (typeof req.body.sceneTitle === 'string') item.sceneTitle = sanitizeText(req.body.sceneTitle, item.sceneTitle);
    if (typeof req.body.promptUsed === 'string') item.promptUsed = sanitizeText(req.body.promptUsed, item.promptUsed || '');

    if (typeof req.body.isFinal !== 'undefined') {
      const finalValue = !!req.body.isFinal;
      if (finalValue) {
        outputs.forEach(other => {
          if (other.sceneNumber === item.sceneNumber) other.isFinal = false;
        });
      }
      item.isFinal = finalValue;
    }

    item.dateUpdated = new Date().toISOString();
    outputs[idx] = item;
    await writeMetadata(outputs);

    res.json({ ok: true, output: publicMetadata(item) });
  } catch (err) {
    console.error('Scene output update failed:', err);
    res.status(500).json({ ok: false, error: 'Scene output update failed.', details: err.message });
  }
});

app.delete('/api/scene-outputs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const outputs = await readMetadata();
    const idx = outputs.findIndex(item => item.id === id);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: 'Scene output not found.' });
    }

    const [item] = outputs.splice(idx, 1);
    const filePath = item.diskPath || path.join(sceneDir(item.sceneNumber), item.fileName);
    await removeFileIfExists(filePath);
    await writeMetadata(outputs);

    res.json({ ok: true, deleted: publicMetadata(item) });
  } catch (err) {
    console.error('Scene output delete failed:', err);
    res.status(500).json({ ok: false, error: 'Scene output delete failed.', details: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (err && err.message && err.message.includes('Only image uploads')) {
    return res.status(400).json({ ok: false, error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ ok: false, error: 'Image upload is too large. Maximum size is 25 MB.' });
  }
  res.status(500).json({ ok: false, error: 'Unexpected server error.', details: err.message });
});

app.listen(PORT, () => {
  console.log(`PV2 John Doe manual workflow site running at http://localhost:${PORT}`);
  console.log(`Scene outputs directory: ${OUTPUT_ROOT}`);
});
