import { Innertube } from 'youtubei.js';
import { YoutubeTranscript } from 'youtube-transcript';

const yt = await Innertube.create();

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid YouTube URL. Please provide a valid watch link.');
}

async function fetchTranscript(videoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map((segment) => segment.text).join(' ');
  } catch {
    try {
      const info = await yt.getInfo(videoId);
      const transcriptData = await info.getTranscript();
      if (!transcriptData?.transcript?.content?.body?.initial_segments) {
        return 'Transcript unavailable for this video.';
      }
      return transcriptData.transcript.content.body.initial_segments
        .map((segment) => segment.snippet?.text ?? '')
        .join(' ')
        .trim();
    } catch {
      return 'Transcript unavailable for this video.';
    }
  }
}

export async function fetchYouTubeMetadata(url) {
  const videoId = extractVideoId(url);
  const info = await yt.getInfo(videoId);
  const basic = info.basic_info;

  const title = basic.title ?? 'Unknown title';
  const durationSeconds = basic.duration ?? 0;
  const description = basic.short_description ?? basic.description ?? 'No description available.';
  const transcript = await fetchTranscript(videoId);

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title,
    durationSeconds,
    description,
    transcript,
  };
}
