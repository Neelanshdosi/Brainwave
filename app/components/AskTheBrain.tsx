'use client';

import { useState } from 'react';
import { Search, Sparkles, X, AlertCircle } from 'lucide-react';
import { Topic } from '@/types/topic';

interface AskTheBrainProps {
  onCitedEventsChange: (citedIds: string[]) => void;
  onSelectEventById: (eventId: string) => void;
  activeCitedIds: string[];
  onClear: () => void;
  retrievedEvents?: Topic[];
}

export default function AskTheBrain({
  onCitedEventsChange,
  onSelectEventById,
  activeCitedIds,
  onClear,
}: AskTheBrainProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrieved, setRetrieved] = useState<Topic[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setAnswer(data.answer);
      setRetrieved(data.retrievedEvents || []);
      onCitedEventsChange(data.citedEventIds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuestion('');
    setAnswer(null);
    setError(null);
    setRetrieved([]);
    onClear();
  };

  // Render clickable [E#] citation tags
  const renderFormattedAnswer = (text: string) => {
    const parts = text.split(/(\[E\d+\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[E(\d+)\]/);
      if (match) {
        const num = parseInt(match[1], 10);
        const event = retrieved[num - 1];

        return (
          <button
            key={index}
            onClick={() => event && onSelectEventById(event.id)}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-600 transition-colors shadow-sm cursor-pointer"
            title={event ? `Open: ${event.title || event.name}` : undefined}
          >
            <span>[E{num}]</span>
            {event && <span className="max-w-[120px] truncate text-[11px] font-normal">{event.title || event.name}</span>}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 w-[92%] max-w-2xl">
      {/* Answer Box */}
      {answer && (
        <div className="mb-3 bg-gray-900/90 backdrop-blur-md p-4 rounded-2xl border border-purple-500/40 shadow-2xl animate-fade-in text-xs md:text-sm text-gray-200">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <Sparkles size={16} />
              <span>Brain Intelligence Response</span>
              {activeCitedIds.length > 0 && (
                <span className="text-[11px] text-yellow-400 font-normal">
                  ({activeCitedIds.length} neural nodes illuminated)
                </span>
              )}
            </div>
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
              title="Clear question and reset neural highlights"
            >
              <X size={16} />
            </button>
          </div>

          <p className="leading-relaxed mb-2 text-gray-100">{renderFormattedAnswer(answer)}</p>

          <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
            <span>Click any [E#] tag to open that news event.</span>
            <button
              onClick={handleClear}
              className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded text-[11px] transition-colors"
            >
              Clear Highlights
            </button>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="mb-2 bg-red-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-red-800 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Bar Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center bg-gray-900/85 backdrop-blur-md rounded-2xl border border-gray-700/80 shadow-2xl focus-within:border-purple-500 transition-all px-3 py-2 gap-2"
      >
        <Search className="text-gray-400 shrink-0 ml-1" size={18} />
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 300))}
          placeholder="Ask the Brain... (e.g. What is happening in AI and quantum computing?)"
          maxLength={300}
          className="w-full bg-transparent text-white placeholder-gray-400 text-xs md:text-sm focus:outline-none"
        />

        {question.length > 0 && (
          <span className="text-[10px] text-gray-500 font-mono shrink-0">
            {300 - question.length}
          </span>
        )}

        {activeCitedIds.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1 text-xs text-gray-300 bg-neutral-800 hover:bg-neutral-700 rounded-lg shrink-0 transition-colors"
          >
            Clear
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 text-white text-xs md:text-sm font-medium rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <Sparkles className="animate-spin" size={14} />
              Thinking...
            </>
          ) : (
            'Ask'
          )}
        </button>
      </form>
    </div>
  );
}

