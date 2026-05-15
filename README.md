# PV2 John Doe HTML + Local API Backend

This package includes your updated PV2 John Doe HTML project and a small local backend so the API buttons can actually work.

The HTML does **not** contain an OpenAI API key. The API key is stored only on the backend in a local `.env` file.

## What changed

- Added a **Backend Base URL** field to the API panel.
- Added a **Test Backend** button that checks `/api/health`.
- Updated the HTML so it calls full backend URLs such as:
  - `http://localhost:3000/api/chat`
  - `http://localhost:3000/api/generate-image`
- Added a Node.js/Express backend with:
  - `GET /api/health`
  - `POST /api/chat`
  - `POST /api/generate-image`
- Kept diagnostics logging in the HTML.
- Kept API keys out of the browser.

## Setup

1. Install Node.js 18 or newer.

2. Open a terminal in this folder.

3. Install dependencies:

```bash
npm install
```

4. Create your environment file:

```bash
copy .env.example .env
```

On macOS/Linux, use:

```bash
cp .env.example .env
```

5. Open `.env` and replace this line:

```text
OPENAI_API_KEY=sk-your-api-key-here
```

with your actual OpenAI API key.

6. Start the backend:

```bash
npm start
```

7. Open this address in your browser:

```text
http://localhost:3000
```

8. In the HTML API panel, keep Backend Base URL set to:

```text
http://localhost:3000
```

9. Click **Test Backend** first. Then try **Send Prompt to ChatGPT**.

## Model settings

The `.env.example` file uses these defaults:

```text
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1536x1024
OPENAI_IMAGE_QUALITY=high
OPENAI_IMAGE_FORMAT=png
```

If your OpenAI account does not have access to those exact models, change the model names in `.env` to models available to your account and restart the server.

## Troubleshooting

### Error: Failed to fetch

Usually means one of these is true:

- the backend is not running
- Backend Base URL is wrong
- the route does not exist
- a firewall/browser/CORS issue blocked the request

Try:

```text
http://localhost:3000/api/health
```

If that page does not load, the backend is not running correctly.

### Error: OPENAI_API_KEY is not configured

Copy `.env.example` to `.env`, add your key, then restart the server.

### Text works but image generation fails

Check that your selected image model is available to your account. You can change `OPENAI_IMAGE_MODEL` in `.env`.

## Security note

Do not paste your OpenAI API key into the HTML file. Do not share your `.env` file. The HTML should only talk to this backend.
