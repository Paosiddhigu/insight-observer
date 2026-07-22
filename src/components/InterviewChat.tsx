import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  onEndChat: () => void;
  loading: boolean;
  sending: boolean;
  error: string | null;
}

export function InterviewChat({ messages, onSend, onEndChat, loading, sending, error }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    await onSend(trimmed);
  }

  if (loading) {
    return (
      <section className="panel chat-panel loading-panel">
        <div className="spinner" />
        <h3>Starting interview…</h3>
      </section>
    );
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <span className="panel-icon">💬</span>
        <div>
          <h2>Post-Viewing Interview</h2>
          <p>The AI references your reactions and asks about your experience.</p>
        </div>
        <button type="button" className="end-chat-btn" onClick={onEndChat}>
          End Chat
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`chat-bubble ${message.role}`}>
            <span className="chat-role">{message.role === 'assistant' ? 'Interviewer' : 'You'}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {sending && (
          <div className="chat-bubble assistant typing">
            <span className="chat-role">Interviewer</span>
            <p>Thinking…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error-banner">{error}</p>}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Share your thoughts…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
