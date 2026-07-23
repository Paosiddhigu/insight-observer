import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { createModelResponse, MODEL } from '../server/openai-responses.js';
import { saveGradingArtifacts, toGradingMetadata, metadataBlock } from '../server/grading.js';

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
  if (!response.ok) throw new Error(`YouTube API failed: ${await response.text()}`);
  return response.json();
}

function loadTestFrameImage() {
  const candidates = [
    path.join(root, 'test-assets/webcam-face.png'),
    path.join(root, 'test-assets/webcam-crop.png'),
    path.join(root, 'test-assets/webcam-frame.png'),
    path.join(root, 'test-assets/webcam-frame.jpg'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const buffer = fs.readFileSync(candidate);
      const mime = candidate.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
  }

  throw new Error('No test webcam frame found. Add test-assets/webcam-frame.jpg');
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
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Here are ${sampledFrames.length} webcam frames captured while the user watched "${metadata.title}". For each frame, infer the expression and connect it to what was likely happening in the video at that moment. Reference timestamps explicitly.`,
          },
          ...sampledFrames.map((frame) => ({
            type: 'input_image',
            image_url: frame.image,
            detail: 'low',
          })),
        ],
      },
    ],
    maxOutputTokens: 2000,
  });
}

async function startInterview(metadata, visualEvaluation) {
  return createModelResponse(openai, {
    instructions: `You are a warm, insightful interviewer conducting a post-viewing debrief.
The user just finished watching a YouTube video while being observed via webcam.

Your goals:
- Ask what they liked and disliked about the video
- Reference specific facial expressions from the visual evaluation
- Connect their verbal feedback to observed reactions and video content
- Ask one focused question at a time
- Be conversational, not robotic
- Keep responses concise (2-4 sentences)

Video metadata:
${metadataBlock(metadata)}

Visual evaluation of their reactions:
${visualEvaluation}`,
    input: [
      {
        role: 'user',
        content:
          'The video just ended. Begin the interview with a friendly opening and your first question. Reference at least one specific moment from the visual evaluation.',
      },
    ],
    maxOutputTokens: 500,
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
  console.log(`=== Full test session (${MODEL}, Responses API) ===\n`);

  console.log('1. Fetching YouTube metadata…');
  const rawMetadata = await fetchMetadata(TEST_VIDEO_URL);
  const metadata = toGradingMetadata(rawMetadata);
  console.log(`   Video: ${metadata.title} (${metadata.duration_seconds}s)\n`);

  console.log('2. Loading webcam test frame…');
  const frameImage = loadTestFrameImage();
  const frames = [0, 5, 10, 15, 18].map((timestampSeconds) => ({
    timestampSeconds,
    image: frameImage,
  }));
  console.log(`   Using ${frames.length} frames\n`);

  console.log('3. Running visual evaluation…');
  const visualEvaluation = await evaluateVisualReactions(metadata, frames);
  console.log('   Done.\n');

  console.log('4. Running interview…');
  const opening = await startInterview(metadata, visualEvaluation);
  const messages = [
    { role: 'assistant', content: opening },
    {
      role: 'user',
      content:
        'I liked how simple and genuine it felt. The trunk comment made me smile, and the yell at the end surprised me in a fun way.',
    },
    {
      role: 'assistant',
      content:
        'That smile during the trunk moment is interesting — was it the humor of stating something obvious, or something about how he delivered it?',
    },
    {
      role: 'user',
      content:
        'Both, really. The deadpan delivery made it funnier. It feels like a piece of internet history.',
    },
  ];
  console.log('   Done.\n');

  console.log('5. Generating final report…');
  const report = await generateFinalReport(metadata, visualEvaluation, messages);
  console.log('   Done.\n');

  console.log('6. Saving ai_grading/ artifacts…');
  saveGradingArtifacts({ metadata, visualEvaluation, messages, report });
  console.log('   Saved all 4 files.\n');

  console.log('=== Test session complete ===');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
