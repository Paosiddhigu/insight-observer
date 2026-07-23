interface Props {
  evaluation: string;
  loading: boolean;
  error: string | null;
}

function renderMarkdownish(text: string) {
  return text.split('\n').map((line, index) => {
    if (line.startsWith('## ')) {
      return (
        <h4 key={index} className="eval-heading">
          {line.replace('## ', '')}
        </h4>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h3 key={index} className="eval-title">
          {line.replace('# ', '')}
        </h3>
      );
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={index} className="eval-bullet">
          {line.replace(/^[-*]\s/, '')}
        </li>
      );
    }
    if (line.match(/^\d+\./)) {
      return (
        <li key={index} className="eval-numbered">
          {line.replace(/^\d+\.\s*/, '')}
        </li>
      );
    }
    if (line.trim() === '') {
      return <br key={index} />;
    }
    return (
      <p key={index} className="eval-paragraph">
        {line}
      </p>
    );
  });
}

export function VisualEvaluation({ evaluation, loading, error }: Props) {
  if (loading) {
    return (
      <section className="panel evaluation-panel loading-panel">
        <div className="spinner" />
        <h3>Analyzing your reactions…</h3>
        <p>GPT-5.6 Luna is reviewing up to 20 webcam frames captured during viewing.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel evaluation-panel">
        <p className="error-banner">{error}</p>
      </section>
    );
  }

  return (
    <section className="panel evaluation-panel">
      <div className="panel-header">
        <span className="panel-icon">👁</span>
        <div>
          <h2>Visual Evaluation</h2>
          <p>AI analysis of your facial expressions throughout the video.</p>
        </div>
      </div>
      <div className="evaluation-content">{renderMarkdownish(evaluation)}</div>
    </section>
  );
}
