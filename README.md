# Insight Observer

AI-powered viewer reaction analysis. Watch a YouTube video while your webcam captures reactions, then get a live interview and final sentiment report powered by OpenAI.

## Stack

- **React + Vite** — frontend UI (`src/App.tsx`)
- **Express** — YouTube metadata/transcript API (proxied from Vite)
- **OpenAI** — visual evaluation, interview, and final report (`gpt-5.6-luna`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   **Do not commit API keys.** Create a local `.env` file (already listed in `.gitignore`) with your Vite-style key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```env
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   ```

   The app reads this via `import.meta.env.VITE_OPENAI_API_KEY` in the React frontend. Only `.env.example` (placeholder values) is tracked in git — never commit your real `.env` file.

3. **Run the development server**

   ```bash
   npm run dev
   ```

   Open **http://localhost:5173** in your browser.

   This starts:
   - Vite dev server on port **5173** (React app)
   - Express API on port **3001** (YouTube metadata; proxied via `/api`)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OPENAI_API_KEY` | Yes | OpenAI API key. Must use the `VITE_` prefix so Vite exposes it to the client via `import.meta.env`. Store in `.env` (gitignored). |
| `PORT` | No | Express API port (default: `3001`) |

## Security

- **Never commit API keys** — keep them in `.env` only
- `.env` is listed in `.gitignore` and is not pushed to GitHub
- Commit `.env.example` with placeholder values so others know which variables to set

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + API in development |
| `npm run build` | Build production frontend |
| `npm run preview` | Preview production build |

## Usage flow

1. Paste a YouTube URL and load metadata (title, duration, description, transcript)
2. Start watching — webcam captures up to 20 reaction frames
3. AI analyzes your facial expressions
4. Complete a post-viewing interview chatbot
5. Generate a final sentiment report

## AI grading artifacts

The `ai_grading/` folder must contain outputs from one test run (text and JSON only — no images or secrets):

| File | Contents |
|------|----------|
| `video_metadata.json` | `title`, `duration_seconds`, `description`, `transcript` |
| `visual_evaluation.txt` | Visual evaluation from the same test run |
| `final_prompt.txt` | Exact Final Synthesis prompt (metadata + visual evaluation + chat history) |
| `final_report.txt` | Final report shown after **End Chat** |

These files are saved automatically when you click **End Chat** in the app.

Regenerate manually:

```bash
npm run generate-grading
```
