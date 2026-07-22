export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

export function computeSampleTimes(durationSeconds: number, maxSamples = 20): number[] {
  if (durationSeconds <= 0) return [0];
  if (maxSamples === 1) return [0];

  return Array.from({ length: maxSamples }, (_, i) =>
    Math.min(
      Math.max(0, durationSeconds - 0.25),
      Math.round(((i * durationSeconds) / (maxSamples - 1)) * 10) / 10,
    ),
  );
}

export function captureWebcamFrame(videoEl: HTMLVideoElement): string | null {
  const width = videoEl.videoWidth || videoEl.clientWidth;
  const height = videoEl.videoHeight || videoEl.clientHeight;
  if (width === 0 || height === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(videoEl, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    origin: window.location.origin,
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export const YT_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId?: string;
  width?: string | number;
  height?: string | number;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number; target: YTPlayer }) => void;
  };
  playerVars?: Record<string, number | string>;
}

interface YTPlayerConstructor {
  new (elementId: string, options?: YTPlayerOptions): YTPlayer;
}

declare global {
  interface Window {
    YT?: { Player: YTPlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoaded = false;
let apiLoading: Promise<void> | null = null;

function waitForYouTubeApi(resolve: () => void) {
  if (window.YT?.Player) {
    apiLoaded = true;
    resolve();
    return;
  }

  const interval = window.setInterval(() => {
    if (window.YT?.Player) {
      window.clearInterval(interval);
      apiLoaded = true;
      resolve();
    }
  }, 50);
}

export function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded && window.YT?.Player) return Promise.resolve();
  if (apiLoading) return apiLoading;

  apiLoading = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
    };

    if (window.YT?.Player) {
      apiLoaded = true;
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      waitForYouTubeApi(resolve);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
    waitForYouTubeApi(resolve);
  });

  return apiLoading;
}

export function attachYouTubePlayer(
  elementId: string,
  handlers: {
    onReady?: (player: YTPlayer) => void;
    onStateChange?: (state: number, player: YTPlayer) => void;
    onError?: (code: number) => void;
  },
): Promise<YTPlayer> {
  return loadYouTubeAPI().then(
    () =>
      new Promise((resolve) => {
        const player = new window.YT!.Player(elementId, {
          events: {
            onReady: (event) => {
              handlers.onReady?.(event.target);
              resolve(event.target);
            },
            onStateChange: (event) => {
              handlers.onStateChange?.(event.data, event.target);
            },
            onError: (event) => {
              handlers.onError?.(event.data);
            },
          },
        });
        void player;
      }),
  );
}
