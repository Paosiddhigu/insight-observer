import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attachYouTubePlayer,
  buildYouTubeEmbedUrl,
  captureWebcamFrame,
  computeSampleTimes,
  formatDuration,
  YT_PLAYER_STATE,
  type YTPlayer,
} from '../utils/helpers';
import type { CapturedFrame, VideoMetadata } from '../types';

interface Props {
  metadata: VideoMetadata;
  onComplete: (frames: CapturedFrame[]) => void;
}

const MAX_FRAMES = 20;

const YT_ERROR_MESSAGES: Record<number, string> = {
  2: 'Invalid video parameter.',
  5: 'HTML5 playback error.',
  100: 'Video not found or is private.',
  101: 'Embedding disabled by the video owner.',
  150: 'Embedding disabled by the video owner.',
};

export function WatchSession({ metadata, onComplete }: Props) {
  const iframeId = `youtube-player-${metadata.videoId}`;
  const webcamRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  const nextSampleIndexRef = useRef(0);
  const sampleTimesRef = useRef<number[]>(computeSampleTimes(metadata.durationSeconds, MAX_FRAMES));
  const pollRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  const [webcamReady, setWebcamReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  onCompleteRef.current = onComplete;

  const tryCaptureAt = useCallback((timestampSeconds: number) => {
    const webcam = webcamRef.current;
    if (!webcam || framesRef.current.length >= MAX_FRAMES) return false;

    const image = captureWebcamFrame(webcam);
    if (!image) return false;

    framesRef.current.push({ timestampSeconds, image });
    setFrameCount(framesRef.current.length);
    return true;
  }, []);

  const captureDueSamples = useCallback(
    (time: number) => {
      const sampleTimes = sampleTimesRef.current;

      while (
        nextSampleIndexRef.current < sampleTimes.length &&
        time >= sampleTimes[nextSampleIndexRef.current] - 0.15 &&
        framesRef.current.length < MAX_FRAMES
      ) {
        const sampleTime = sampleTimes[nextSampleIndexRef.current];
        if (tryCaptureAt(sampleTime)) {
          nextSampleIndexRef.current += 1;
        } else {
          break;
        }
      }
    },
    [tryCaptureAt],
  );

  const finishSession = useCallback(
    (player: YTPlayer) => {
      if (pollRef.current) window.clearInterval(pollRef.current);

      captureDueSamples(player.getCurrentTime());

      if (framesRef.current.length === 0) {
        tryCaptureAt(player.getCurrentTime());
      }

      onCompleteRef.current(framesRef.current.slice(0, MAX_FRAMES));
    },
    [captureDueSamples, tryCaptureAt],
  );

  useEffect(() => {
    let cancelled = false;
    framesRef.current = [];
    nextSampleIndexRef.current = 0;
    setFrameCount(0);
    setPlayerReady(false);
    setPlayerError(null);

    async function initWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const webcam = webcamRef.current;
        if (!webcam) return;

        webcam.srcObject = stream;
        await webcam.play();
        if (!cancelled) setWebcamReady(true);
      } catch {
        setCameraError('Camera access denied. Please allow webcam access to continue.');
      }
    }

    initWebcam();

    attachYouTubePlayer(iframeId, {
      onReady: (player) => {
        if (cancelled) return;
        playerRef.current = player;

        const duration = player.getDuration();
        sampleTimesRef.current =
          duration > 0
            ? computeSampleTimes(duration, MAX_FRAMES)
            : computeSampleTimes(metadata.durationSeconds, MAX_FRAMES);

        setPlayerReady(true);
      },
      onStateChange: (state, player) => {
        if (cancelled) return;

        if (state === YT_PLAYER_STATE.PLAYING) {
          setIsPlaying(true);
          captureDueSamples(player.getCurrentTime());
        } else if (state === YT_PLAYER_STATE.PAUSED) {
          setIsPlaying(false);
        } else if (state === YT_PLAYER_STATE.ENDED) {
          setIsPlaying(false);
          finishSession(player);
        }
      },
      onError: (code) => {
        if (cancelled) return;
        setPlayerError(YT_ERROR_MESSAGES[code] ?? `YouTube player error (${code}).`);
        setPlayerReady(false);
      },
    }).catch(() => {
      if (!cancelled) {
        setPlayerError('Failed to initialize the YouTube player.');
      }
    });

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      try {
        playerRef.current?.destroy();
      } catch {
        // Player may already be destroyed if the iframe was removed.
      }
      playerRef.current = null;
    };
  }, [metadata.videoId, metadata.durationSeconds, iframeId, captureDueSamples, finishSession]);

  useEffect(() => {
    if (!webcamReady || !playerReady) return;

    pollRef.current = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const time = player.getCurrentTime();
      setCurrentTime(time);

      if (player.getPlayerState() === YT_PLAYER_STATE.PLAYING) {
        captureDueSamples(time);
      }
    }, 250);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [webcamReady, playerReady, captureDueSamples]);

  const progress = Math.min(100, (frameCount / MAX_FRAMES) * 100);

  return (
    <section className="panel watch-panel">
      <div className="panel-header">
        <span className="panel-icon live">●</span>
        <div>
          <h2>Watching Session</h2>
          <p>The AI is observing your reactions via webcam while you watch.</p>
        </div>
      </div>

      {cameraError ? (
        <p className="error-banner">{cameraError}</p>
      ) : (
        <>
          <div className="watch-grid">
            <div className="video-container">
              <iframe
                id={iframeId}
                className="youtube-embed"
                src={buildYouTubeEmbedUrl(metadata.videoId)}
                title={metadata.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <div className="video-overlay">
                <span>
                  {formatDuration(currentTime)} / {formatDuration(metadata.durationSeconds)}
                </span>
              </div>
            </div>
            <div className="webcam-container">
              <video ref={webcamRef} muted playsInline autoPlay className="webcam-feed" />
              <div className="webcam-label">Live Reaction Feed</div>
            </div>
          </div>

          {playerError && <p className="error-banner">{playerError}</p>}

          <div className="capture-status">
            <div className="capture-header">
              <span>
                Frames captured: {frameCount} / {MAX_FRAMES}
              </span>
              <span>
                {!webcamReady
                  ? 'Starting webcam…'
                  : !playerReady
                    ? 'Loading video player…'
                    : isPlaying
                      ? 'Recording reactions'
                      : 'Press play on the video to start capturing'}
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
