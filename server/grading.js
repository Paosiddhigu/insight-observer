import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GRADING_DIR = path.resolve(__dirname, '../ai_grading');

export function metadataBlock(metadata) {
  return [
    `Title: ${metadata.title}`,
    `Duration: ${metadata.duration_seconds ?? metadata.durationSeconds} seconds`,
    `Description: ${metadata.description}`,
    `Transcript excerpt: ${metadata.transcript.slice(0, 4000)}`,
  ].join('\n');
}

export function toGradingMetadata(metadata) {
  return {
    title: metadata.title,
    duration_seconds: metadata.duration_seconds ?? metadata.durationSeconds,
    description: metadata.description,
    transcript: metadata.transcript,
  };
}

export function buildFinalSynthesisPrompt(metadata, visualEvaluation, messages) {
  const transcript = messages
    .map((message) => `${message.role === 'assistant' ? 'Interviewer' : 'Viewer'}: ${message.content}`)
    .join('\n\n');

  const systemPrompt = `You are a senior sentiment analyst producing a final viewer insight report.
Synthesize the video metadata, visual reaction analysis, and interview transcript into a polished report.

Format the report in Markdown with these sections:
## Executive Summary
## Emotional Journey
## What Resonated
## Points of Friction
## Key Observations (visual + verbal alignment)
## Overall Sentiment Score (1-10 with label)
## Recommendations

Be specific, reference timestamps and quotes from the interview, and note where facial expressions aligned or diverged from stated opinions.`;

  const userPrompt = `Video metadata:
${metadataBlock(metadata)}

Visual evaluation:
${visualEvaluation}

Interview transcript:
${transcript}`;

  return `[SYSTEM]
${systemPrompt}

[USER]
${userPrompt}`;
}

export function saveGradingArtifacts({ metadata, visualEvaluation, messages, report }) {
  const gradingMetadata = toGradingMetadata(metadata);
  const finalPrompt = buildFinalSynthesisPrompt(metadata, visualEvaluation, messages);

  fs.mkdirSync(GRADING_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(GRADING_DIR, 'video_metadata.json'),
    JSON.stringify(gradingMetadata, null, 2),
  );
  fs.writeFileSync(path.join(GRADING_DIR, 'visual_evaluation.txt'), visualEvaluation);
  fs.writeFileSync(path.join(GRADING_DIR, 'final_prompt.txt'), finalPrompt);
  fs.writeFileSync(path.join(GRADING_DIR, 'final_report.txt'), report);
}
