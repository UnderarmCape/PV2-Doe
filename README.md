# PV2 John Doe Manual ChatGPT Plus Workflow

This package hosts the PV2 John Doe prompt builder as a web page and replaces the API automation panel with a manual ChatGPT Plus workflow.

This version does **not** use the OpenAI API, does **not** require OpenAI Platform credits, and does **not** require an API key.

## What changed in v4

- Removed the API-calling workflow from the HTML interface.
- Removed the OpenAI API requirement from the backend.
- Replaced the API panel with **ChatGPT Plus Manual Workflow**.
- Added buttons to:
  - Copy the final generated prompt
  - Open ChatGPT
  - Save/open an optional ChatGPT Project URL
  - Copy the reference image upload checklist
  - Copy manual generation instructions
  - Copy/download a complete scene package
  - Track result filenames and notes
  - Download a manual workflow log
- Kept the existing:
  - PV2 John Doe reference content
  - Scene Presets
  - Prompt Builder
  - Collapsible sections
  - Copy buttons
  - Reference image sections
  - Mobile-friendly layout

## How to use

1. Open the hosted page, for example:

```text
https://pv2-doe.onrender.com/
```

2. Go to **Prompt Builder**.

3. Select a Scene Preset.

4. Click **Build Full Prompt** if needed.

5. Go to **ChatGPT Plus Manual Workflow**.

6. Click **Copy Final Prompt**.

7. Click **Open ChatGPT**, or save/open your ChatGPT Project URL.

8. Upload the required reference images in ChatGPT using the checklist.

9. Paste the copied prompt into ChatGPT and generate the image using your normal ChatGPT account.

10. Save the generated image from ChatGPT and record notes or filenames in the Scene Tracking Notes area.

## Local testing

Install dependencies:

```bash
npm install
```

Start the local server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Optional health check:

```text
http://localhost:3000/health
```

## Render deployment

This package can still be deployed on Render as a Node Web Service.

Use these settings:

```text
Build Command: npm install
Start Command: npm start
```

No OpenAI API environment variables are needed for this manual workflow version.

## Important note

ChatGPT Plus and OpenAI API Platform billing are separate. This manual version avoids OpenAI API billing by preparing the prompt and workflow for you to use manually inside ChatGPT Plus.
