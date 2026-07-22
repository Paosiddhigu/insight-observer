interface Props {
  report: string;
  loading: boolean;
  error: string | null;
}

function renderReport(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  function flushList() {
    if (listItems.length === 0 || !listType) return;
    const ListTag = listType;
    elements.push(
      <ListTag key={`list-${elements.length}`} className="report-list">
        {listItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListTag>,
    );
    listItems = [];
    listType = null;
  }

  lines.forEach((line, index) => {
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={index} className="report-section">
          {line.replace('## ', '')}
        </h3>,
      );
      return;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={index} className="report-title-inline">
          {line.replace('# ', '')}
        </h2>,
      );
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(line.replace(/^[-*]\s/, ''));
      return;
    }
    if (line.match(/^\d+\./)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(line.replace(/^\d+\.\s*/, ''));
      return;
    }
    flushList();
    if (line.trim()) {
      elements.push(
        <p key={index} className="report-paragraph">
          {line}
        </p>,
      );
    }
  });

  flushList();
  return elements;
}

export function FinalReport({ report, loading, error }: Props) {
  if (loading) {
    return (
      <section className="panel report-panel loading-panel">
        <div className="spinner" />
        <h3>Synthesizing final sentiment report…</h3>
        <p>Combining video metadata, visual evaluation, and interview responses.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel report-panel">
        <p className="error-banner">{error}</p>
      </section>
    );
  }

  return (
    <section className="panel report-panel">
      <div className="panel-header">
        <span className="panel-icon">📊</span>
        <div>
          <h2>Final Sentiment Report</h2>
          <p>A synthesized view of how you felt about the video.</p>
        </div>
      </div>
      <article className="report-document">{renderReport(report)}</article>
    </section>
  );
}
