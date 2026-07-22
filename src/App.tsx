import { useCallback, useState } from 'react';
import { FinalReport } from './components/FinalReport';
import { InterviewChat } from './components/InterviewChat';
import { StepIndicator } from './components/StepIndicator';
import { UrlInput } from './components/UrlInput';
import { VisualEvaluation } from './components/VisualEvaluation';
import { WatchSession } from './components/WatchSession';
import * as api from './services/api';
import type { AppPhase, CapturedFrame, ChatMessage, VideoMetadata } from './types';
import './App.css';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('setup');
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [visualEvaluation, setVisualEvaluation] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [finalReport, setFinalReport] = useState('');

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingEval, setLoadingEval] = useState(false);
  const [loadingInterview, setLoadingInterview] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const handleFetchMetadata = useCallback(async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const data = await api.fetchYouTubeMetadata(url);
      setMetadata(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video.');
      setMetadata(null);
    } finally {
      setLoadingMeta(false);
    }
  }, [url]);

  const handleStartWatching = () => {
    setPhase('watching');
    setVisualEvaluation('');
    setMessages([]);
    setFinalReport('');
    setError(null);
  };

  const handleWatchComplete = useCallback(
    async (capturedFrames: CapturedFrame[]) => {
      if (!metadata) return;
      setPhase('evaluating');
      setLoadingEval(true);
      setError(null);

      try {
        const { evaluation } = await api.evaluateVisualReactions(metadata, capturedFrames);
        setVisualEvaluation(evaluation);
        setPhase('interview-ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Visual evaluation failed.');
        setPhase('interview-ready');
      } finally {
        setLoadingEval(false);
      }
    },
    [metadata],
  );

  const handleStartInterview = useCallback(async () => {
    if (!metadata || !visualEvaluation) return;
    setPhase('interviewing');
    setLoadingInterview(true);
    setChatError(null);

    try {
      const { message } = await api.startInterview(metadata, visualEvaluation);
      setMessages([{ role: 'assistant', content: message }]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to start interview.');
    } finally {
      setLoadingInterview(false);
    }
  }, [metadata, visualEvaluation]);

  const handleSendMessage = useCallback(
    async (userMessage: string) => {
      if (!metadata || !visualEvaluation) return;
      const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
      setMessages(updatedMessages);
      setSendingMessage(true);
      setChatError(null);

      try {
        const { message } = await api.sendInterviewMessage(
          metadata,
          visualEvaluation,
          messages,
          userMessage,
        );
        setMessages([...updatedMessages, { role: 'assistant', content: message }]);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : 'Failed to send message.');
        setMessages(messages);
      } finally {
        setSendingMessage(false);
      }
    },
    [metadata, visualEvaluation, messages],
  );

  const handleEndChat = useCallback(async () => {
    if (!metadata || !visualEvaluation) return;
    setPhase('synthesizing');
    setLoadingReport(true);
    setError(null);

    try {
      const { report } = await api.synthesizeReport(metadata, visualEvaluation, messages);
      setFinalReport(report);
      await api.saveGradingArtifacts(metadata, visualEvaluation, messages, report);
      setPhase('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report synthesis failed.');
      setPhase('interviewing');
    } finally {
      setLoadingReport(false);
    }
  }, [metadata, visualEvaluation, messages]);

  const handleReset = () => {
    setPhase('setup');
    setMetadata(null);
    setUrl('');
    setVisualEvaluation('');
    setMessages([]);
    setFinalReport('');
    setError(null);
    setChatError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">IO</span>
          <div>
            <h1>Insight Observer</h1>
            <p>AI-powered viewer reaction analysis</p>
          </div>
        </div>
        {phase !== 'setup' && (
          <button type="button" className="ghost-btn" onClick={handleReset}>
            Start Over
          </button>
        )}
      </header>

      <StepIndicator phase={phase} />

      <main className="app-main">
        {(phase === 'setup' || metadata) && phase !== 'watching' && phase !== 'complete' && (
          <UrlInput
            url={url}
            onUrlChange={setUrl}
            onFetch={handleFetchMetadata}
            loading={loadingMeta}
            error={phase === 'setup' ? error : null}
            metadata={metadata}
          />
        )}

        {metadata && phase === 'setup' && (
          <div className="action-row">
            <button type="button" className="primary-btn" onClick={handleStartWatching}>
              Start Watching
            </button>
          </div>
        )}

        {phase === 'watching' && metadata && (
          <WatchSession metadata={metadata} onComplete={handleWatchComplete} />
        )}

        {(phase === 'evaluating' || phase === 'interview-ready') && (
          <>
            <VisualEvaluation
              evaluation={visualEvaluation}
              loading={loadingEval}
              error={phase === 'interview-ready' ? error : null}
            />
            {phase === 'interview-ready' && visualEvaluation && !loadingEval && (
              <div className="action-row">
                <button type="button" className="primary-btn" onClick={handleStartInterview}>
                  Start Interview
                </button>
              </div>
            )}
          </>
        )}

        {(phase === 'interviewing' || phase === 'synthesizing') && (
          <InterviewChat
            messages={messages}
            onSend={handleSendMessage}
            onEndChat={handleEndChat}
            loading={loadingInterview}
            sending={sendingMessage}
            error={chatError}
          />
        )}

        {(phase === 'synthesizing' || phase === 'complete') && (
          <FinalReport report={finalReport} loading={loadingReport} error={error} />
        )}
      </main>

      <footer className="app-footer">
        <span>Model: gpt-5.6</span>
        <span>Max 20 webcam frames per session</span>
      </footer>
    </div>
  );
}
