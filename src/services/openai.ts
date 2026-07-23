import OpenAI from 'openai';
import type { CapturedFrame, ChatMessage, VideoMetadata } from '../types';

const MODEL = 'gpt-5.6-luna';

function getOpenAI() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function metadataBlock(metadata: VideoMetadata) {
  return [
    `Title: ${metadata.title}`,
    `Duration: ${metadata.durationSeconds} seconds`,
    `Description: ${metadata.description}`,
    `Transcript excerpt: ${metadata.transcript.slice(0, 4000)}`,
  ].join('\n');
}

export async function evaluateVisualReactions(metadata: VideoMetadata, frames: CapturedFrame[]) {
  const sampledFrames = frames.slice(0, 20);

  const imageContent = sampledFrames.map((frame) => ({
    type: 'image_url' as const,
    image_url: {
      url: frame.image,
      detail: 'low' as const,
    },
  }));

  const timestamps = sampledFrames
    .map((frame) => `- ${formatTimestamp(frame.timestampSeconds)}`)
    .join('\n');

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an expert behavioral analyst observing a viewer's facial reactions while they watch a YouTube video.
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
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Here are ${sampledFrames.length} webcam frames captured while the user watched "${metadata.title}". For each frame, infer the expression and connect it to what was likely happening in the video at that moment. Reference timestamps explicitly.`,
          },
          ...imageContent,
        ],
      },
    ],
    max_completion_tokens: 2000,
  });

  return response.choices[0]?.message?.content ?? 'Unable to generate visual evaluation.';
}

function interviewSystemPrompt(metadata: VideoMetadata, visualEvaluation: string) {
  return `You are a warm, insightful interviewer conducting a post-viewing debrief.
The user just finished watching a YouTube video while being observed via webcam.

Your goals:
- Ask what they liked and disliked about the video
- Reference specific facial expressions from the visual evaluation (e.g. "I noticed you smiled at 1:23 — what caused that?")
- Connect their verbal feedback to observed reactions and video content
- Ask one focused question at a time
- Be conversational, not robotic
- Keep responses concise (2-4 sentences)

Video metadata:
${metadataBlock(metadata)}

Visual evaluation of their reactions:
${visualEvaluation}`;
}

export async function startInterview(metadata: VideoMetadata, visualEvaluation: string) {
  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: interviewSystemPrompt(metadata, visualEvaluation),
      },
      {
        role: 'user',
        content:
          'The video just ended. Begin the interview with a friendly opening and your first question. Reference at least one specific moment from the visual evaluation.',
      },
    ],
    max_completion_tokens: 500,
  });

  return response.choices[0]?.message?.content ?? 'Thanks for watching! What stood out to you most?';
}

export async function runInterviewTurn(
  metadata: VideoMetadata,
  visualEvaluation: string,
  messages: ChatMessage[],
  userMessage: string,
) {
  const chatMessages = [
    {
      role: 'system' as const,
      content: interviewSystemPrompt(metadata, visualEvaluation),
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: chatMessages,
    max_completion_tokens: 500,
  });

  return response.choices[0]?.message?.content ?? 'Could you tell me more about that?';
}

export async function generateFinalReport(
  metadata: VideoMetadata,
  visualEvaluation: string,
  messages: ChatMessage[],
) {
  const transcript = messages
    .map((message) => `${message.role === 'assistant' ? 'Interviewer' : 'Viewer'}: ${message.content}`)
    .join('\n\n');

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a senior sentiment analyst producing a final viewer insight report.
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
      },
      {
        role: 'user',
        content: `Video metadata:
${metadataBlock(metadata)}

Visual evaluation:
${visualEvaluation}

Interview transcript:
${transcript}`,
      },
    ],
    max_completion_tokens: 2500,
  });

  return response.choices[0]?.message?.content ?? 'Unable to generate final report.';
}
