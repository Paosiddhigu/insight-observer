import { formatDuration } from '../utils/helpers';
import type { VideoMetadata } from '../types';

interface Props {
  url: string;
  onUrlChange: (url: string) => void;
  onFetch: () => void;
  loading: boolean;
  error: string | null;
  metadata: VideoMetadata | null;
}

export function UrlInput({ url, onUrlChange, onFetch, loading, error, metadata }: Props) {
  return (
    <section className="panel setup-panel">
      <div className="panel-header">
        <span className="panel-icon">▶</span>
        <div>
          <h2>YouTube Video</h2>
          <p>Paste a URL to load title, duration, description, and transcript.</p>
        </div>
      </div>

      <div className="url-row">
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onFetch()}
        />
        <button type="button" onClick={onFetch} disabled={loading || !url.trim()}>
          {loading ? 'Loading…' : 'Load Video'}
        </button>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {metadata && (
        <div className="metadata-card">
          <h3>{metadata.title}</h3>
          <div className="metadata-grid">
            <div>
              <span className="label">Duration</span>
              <span>{formatDuration(metadata.durationSeconds)} ({metadata.durationSeconds}s)</span>
            </div>
            <div>
              <span className="label">Video ID</span>
              <span>{metadata.videoId}</span>
            </div>
          </div>
          <div className="metadata-block">
            <span className="label">Description</span>
            <p>{metadata.description}</p>
          </div>
          <div className="metadata-block">
            <span className="label">Transcript</span>
            <p className="transcript-preview">
              {metadata.transcript.length > 600
                ? `${metadata.transcript.slice(0, 600)}…`
                : metadata.transcript}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
