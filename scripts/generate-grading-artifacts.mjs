import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { createModelResponse } from '../server/openai-responses.js';
import {
  buildFinalSynthesisPrompt,
  GRADING_DIR,
  metadataBlock,
  saveGradingArtifacts,
  toGradingMetadata,
} from '../server/grading.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

const apiKey = process.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
  console.error('VITE_OPENAI_API_KEY is not set in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function fetchMetadata(url) {
  const response = await fetch('http://localhost:3001/api/youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new Error(`YouTube API failed: ${await response.text()}`);
  }
  return response.json();
}

async function evaluateVisualReactions(metadata, frames) {
  const sampledFrames = frames.slice(0, 20);
  const timestamps = sampledFrames
    .map((frame) => `- ${formatTimestamp(frame.timestampSeconds)}`)
    .join('\n');

  return createModelResponse(openai, {
    instructions: `You are an expert behavioral analyst observing a viewer's facial reactions while they watch a YouTube video.
Analyze the provided webcam frames captured at specific timestamps during viewing.
Return a structured evaluation with:
1. Overall emotional tone (1-2 sentences)
2. Key moments table: timestamp, observed expression, likely trigger from video context
3. Engagement level (Low/Medium/High) with brief justification
4. Notable patterns (surprise, confusion, delight, boredom, etc.)

Video context:
${metadataBlock(metadata)}

Frame timestamps (in order):
${timestamps}`,
    input: `Here are ${sampledFrames.length} simulated timestamps while the user watched "${metadata.title}". Infer likely expressions and connect them to the video context. Reference timestamps explicitly.`,
    maxOutputTokens: 2000,
  });
}

async function generateFinalReport(metadata, visualEvaluation, messages) {
  const transcript = messages
    .map((message) => `${message.role === 'assistant' ? 'Interviewer' : 'Viewer'}: ${message.content}`)
    .join('\n\n');

  return createModelResponse(openai, {
    instructions: `You are a senior sentiment analyst producing a final viewer insight report.
Synthesize the video metadata, visual reaction analysis, and interview transcript into a polished report.

Format the report in Markdown with these sections:
## Executive Summary
## Emotional Journey
## What Resonated
## Points of Friction
## Key Observations (visual + verbal alignment)
## Overall Sentiment Score (1-10 with label)
## Recommendations

Be specific, reference timestamps and quotes from the interview, and note where facial expressions aligned or diverged from stated opinions.`,
    input: `Video metadata:
${metadataBlock(metadata)}

Visual evaluation:
${visualEvaluation}

Interview transcript:
${transcript}`,
    maxOutputTokens: 2500,
  });
}

async function main() {
  console.log('Fetching video metadata…');
  const rawMetadata = await fetchMetadata(TEST_VIDEO_URL);
  const metadata = toGradingMetadata(rawMetadata);

  const sampleFrames = [
    { timestampSeconds: 0 },
    { timestampSeconds: 9 },
    { timestampSeconds: 18 },
  ];

  console.log('Generating visual evaluation…');
  const visualEvaluationText = await evaluateVisualReactions(metadata, sampleFrames);

  const sampleMessages = [
    {
      role: 'assistant',
      content:
        'Thanks for watching! I noticed you seemed amused around the 0:09 mark when the elephants were described — what stood out to you about that moment?',
    },
    {
      role: 'user',
      content:
        'The trunk description was funny, and the sudden yell caught me off guard. It felt charmingly low-production compared to modern YouTube.',
    },
    {
      role: 'assistant',
      content: 'Interesting — did the simplicity make it more enjoyable, or did you wish it had more polish?',
    },
    {
      role: 'user',
      content:
        'The simplicity is exactly why I liked it. It feels like a genuine moment in internet history.',
    },
  ];

  console.log('Generating final report…');
  const finalReportText = await generateFinalReport(metadata, visualEvaluationText, sampleMessages);

  saveGradingArtifacts({
    metadata,
    visualEvaluation: visualEvaluationText,
    messages: sampleMessages,
    report: finalReportText,
  });

  console.log('Wrote ai_grading/ artifacts:');
  console.log('  - video_metadata.json (title, duration_seconds, description, transcript)');
  console.log('  - visual_evaluation.txt');
  console.log('  - final_prompt.txt (metadata + visual evaluation + chat history)');
  console.log('  - final_report.txt');
  console.log(`\nSaved to ${GRADING_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
