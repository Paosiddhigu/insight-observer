import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { fetchYouTubeMetadata } from './youtube.js';
import { saveGradingArtifacts } from './grading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/youtube', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required.' });
    }
    const metadata = await fetchYouTubeMetadata(url);
    res.json(metadata);
  } catch (error) {
    console.error('YouTube metadata error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch YouTube metadata.',
    });
  }
});

app.post('/api/save-grading', (req, res) => {
  try {
    const { metadata, visualEvaluation, messages, report } = req.body;
    if (!metadata || !visualEvaluation || !Array.isArray(messages) || !report) {
      return res.status(400).json({ error: 'metadata, visualEvaluation, messages, and report are required.' });
    }

    saveGradingArtifacts({ metadata, visualEvaluation, messages, report });
    res.json({ ok: true, path: 'ai_grading/' });
  } catch (error) {
    console.error('Save grading error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to save grading artifacts.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Insight Observer API running on http://localhost:${PORT}`);
});
