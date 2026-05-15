# PV2 John Doe Manual ChatGPT Plus Workflow

This package hosts the PV2 John Doe prompt builder as a web page and replaces the API automation panel with a manual ChatGPT Plus workflow.

This version does **not** use the OpenAI API, does **not** require OpenAI Platform credits, and does **not** require an API key.

## What changed in v10

- Added a server-backed **Scene Outputs / Generated Outputs** manager.
- The output manager lets you upload images that ChatGPT generated manually.
- Uploads are assigned to the currently selected Prompt Builder scene.
- Each scene supports multiple uploaded result images.
- Each scene can have one image marked as **Primary / Final**.
- Each uploaded output stores:
  - scene number
  - scene title
  - stored filename
  - original filename
  - custom display title
  - notes
  - date uploaded
  - prompt used
  - primary/final flag
- Added an 18-scene collapsed results library.
- Added buttons to download, edit metadata, delete, and mark final.

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

10. Save the generated image from ChatGPT.

11. Return to the hosted page, open **Scene Outputs / Generated Outputs**, upload the saved image, add notes, and optionally mark it as final.

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

Optional health checks:

```text
http://localhost:3000/health
http://localhost:3000/api/health
```

Scene outputs API:

```text
GET    /api/scene-outputs
POST   /api/scene-outputs
PUT    /api/scene-outputs/:id
DELETE /api/scene-outputs/:id
```

## Storage behavior

By default, uploaded images are saved to:

```text
public/scene-outputs/
```

Metadata is saved to:

```text
public/scene-outputs/scene-outputs.json
```

You can override the storage location with:

```text
SCENE_OUTPUTS_DIR=/absolute/path/to/scene-outputs
```

The site serves that folder at:

```text
/scene-outputs
```

## Render deployment and persistent storage

This package can be deployed on Render as a Node Web Service.

Use these settings:

```text
Build Command: npm install
Start Command: npm start
```

No OpenAI API environment variables are needed for this manual workflow version.

Important: Render web services use an ephemeral filesystem by default. Files written at runtime can disappear after redeploys or restarts unless you attach a persistent disk. For permanent uploaded scene outputs on Render, attach a persistent disk and set the environment variable:

```text
SCENE_OUTPUTS_DIR=/your/persistent/disk/mount/scene-outputs
```

Then redeploy and test:

```text
https://your-render-url.onrender.com/api/health
```

Confirm the returned `sceneOutputsDir` points to your persistent disk path.

## Important note

ChatGPT Plus and OpenAI API Platform billing are separate. This manual version avoids OpenAI API billing by preparing the prompt and workflow for you to use manually inside ChatGPT Plus.
