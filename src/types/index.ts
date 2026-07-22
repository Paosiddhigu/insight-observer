export interface VideoMetadata {
  videoId: string;
  url: string;
  title: string;
  durationSeconds: number;
  description: string;
  transcript: string;
}

export interface CapturedFrame {
  timestampSeconds: number;
  image: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AppPhase =
  | 'setup'
  | 'watching'
  | 'evaluating'
  | 'interview-ready'
  | 'interviewing'
  | 'synthesizing'
  | 'complete';
