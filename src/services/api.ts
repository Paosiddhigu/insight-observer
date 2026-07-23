import type { CapturedFrame, ChatMessage, VideoMetadata } from '../types';
import * as openai from './openai';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  let data: { error?: string } | null = null;

  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      throw new Error('Unexpected response from server.');
    }
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 503) {
      throw new Error('Backend API is unavailable. Run npm run dev to start both servers.');
    }
    throw new Error(data?.error ?? `Request failed (${response.status}).`);
  }

  if (!data) {
    throw new Error('Empty response from server.');
  }

  return data as T;
}

export function fetchYouTubeMetadata(url: string) {
  return request<VideoMetadata>('/youtube', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function evaluateVisualReactions(metadata: VideoMetadata, frames: CapturedFrame[]) {
  const evaluation = await openai.evaluateVisualReactions(metadata, frames);
  return { evaluation };
}

export async function startInterview(metadata: VideoMetadata, visualEvaluation: string) {
  const message = await openai.startInterview(metadata, visualEvaluation);
  return { message };
}

export async function sendInterviewMessage(
  metadata: VideoMetadata,
  visualEvaluation: string,
  messages: ChatMessage[],
  userMessage: string,
) {
  const message = await openai.runInterviewTurn(metadata, visualEvaluation, messages, userMessage);
  return { message };
}

export async function synthesizeReport(
  metadata: VideoMetadata,
  visualEvaluation: string,
  messages: ChatMessage[],
) {
  const report = await openai.generateFinalReport(metadata, visualEvaluation, messages);
  return { report };
}

export function saveGradingArtifacts(
  metadata: VideoMetadata,
  visualEvaluation: string,
  messages: ChatMessage[],
  report: string,
) {
  return request<{ ok: boolean; path: string }>('/save-grading', {
    method: 'POST',
    body: JSON.stringify({ metadata, visualEvaluation, messages, report }),
  });
}
