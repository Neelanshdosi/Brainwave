'use client';

import { Topic } from '@/types/topic';
import { X, ExternalLink, Sparkles, CheckCircle2, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BriefingData } from '@/lib/server/verifyCitations';

interface TopicCardProps {
  topic: Topic;
  onClose: () => void;
}

export default function TopicCard({ topic, onClose }: TopicCardProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const timestamp =
    typeof topic.timestamp === 'string'
      ? new Date(topic.timestamp)
      : topic.timestamp;
  const timeAgo = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 60000));

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tech: '#00d4ff',
      politics: '#ff4757',
      entertainment: '#ffa502',
      science: '#1e90ff',
      sports: '#2ed573',
      other: '#a29bfe',
    };
    return colors[category] || colors.other;
  };

  const color = getCategoryColor(topic.category);

  // Manual trigger for event briefing (to save quota)
  const handleGenerateBriefing = async () => {
    setLoadingBriefing(true);
    setBriefingError(null);

    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: topic.id,
          event: topic,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.briefing) {
        setBriefing(data.briefing);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      setBriefingError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setLoadingBriefing(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div className="relative bg-[#0f0f13] text-white p-6 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-neutral-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Category & Momentum Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {topic.category}
          </span>
          {topic.trend && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-300 border border-purple-700/50">
              {topic.trend.label} • {Math.round(topic.trend.finalScore * 100)}% Momentum
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold mb-1 leading-snug" style={{ color }}>
          {topic.name || topic.title}
        </h2>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
          <span>{topic.source}</span>
          <span>•</span>
          <span>{timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}</span>
          {topic.articles && topic.articles.length > 1 && (
            <>
              <span>•</span>
              <span className="text-gray-300">{topic.articles.length} cluster articles</span>
            </>
          )}
        </div>

        {/* Summary */}
        <p className="text-gray-300 text-sm leading-relaxed mb-5 bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800">
          {topic.summary}
        </p>

        {/* Grounded Briefing Section */}
        <div className="border-t border-neutral-800 pt-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <FileText size={16} className="text-purple-400" /> Grounded Intelligence Briefing
            </h3>

            {!briefing && !loadingBriefing && (
              <button
                onClick={handleGenerateBriefing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-medium rounded-lg transition-all shadow-md hover:shadow-purple-500/20"
              >
                <Sparkles size={13} /> Generate Briefing
              </button>
            )}
          </div>

          {loadingBriefing && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-sm text-purple-300 bg-purple-950/20 rounded-xl border border-purple-900/40">
              <Sparkles className="animate-spin text-purple-400" size={18} />
              Gathering multi-source article intelligence & verifying citations...
            </div>
          )}

          {briefingError && (
            <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
              <AlertCircle size={15} />
              {briefingError}
            </div>
          )}

          {briefing && (
            <div className="space-y-4 bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 text-xs">
              {/* Verification Ratio Header */}
              {briefing.verified_ratio !== undefined && (
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs">
                  <span className="text-gray-400 font-medium">Fact Verification Score</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-xs ${
                      briefing.verified_ratio >= 0.7
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {Math.round(briefing.verified_ratio * 100)}% Verified
                  </span>
                </div>
              )}

              {/* Briefing Headline & Summary */}
              <div>
                <h4 className="font-semibold text-sm text-white mb-1">{briefing.headline}</h4>
                <p className="text-gray-300 leading-relaxed">{briefing.summary}</p>
              </div>

              {/* Framing Differences */}
              {briefing.framing_differences && (
                <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
                  <span className="text-gray-400 font-semibold block mb-1">Outlet Framing:</span>
                  <p className="text-gray-300 italic">{briefing.framing_differences}</p>
                </div>
              )}

              {/* Claims with Verification Badges */}
              {briefing.claims && briefing.claims.length > 0 && (
                <div>
                  <span className="text-gray-400 font-semibold block mb-2">Verified Claims:</span>
                  <div className="space-y-2">
                    {briefing.claims.map((claim, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border text-xs transition-opacity ${
                          claim.verified
                            ? 'bg-neutral-950/70 border-emerald-900/50 text-gray-200'
                            : 'bg-neutral-950/30 border-neutral-800/60 text-gray-500 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p>{claim.text}</p>
                          {claim.verified ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                              <CheckCircle2 size={11} /> Verified
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-gray-500 bg-neutral-900 px-1.5 py-0.5 rounded">
                              Unverified
                            </span>
                          )}
                        </div>

                        {claim.sources && claim.sources.length > 0 && claim.verified && (
                          <div className="mt-1.5 text-[11px] text-gray-400 font-mono">
                            {claim.sources.map((s, sIdx) => (
                              <span key={sIdx} className="block truncate">
                                ❝{s.quote}❞
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {briefing.timeline && briefing.timeline.length > 0 && (
                <div>
                  <span className="text-gray-400 font-semibold block mb-1.5">Timeline:</span>
                  <ul className="space-y-1">
                    {briefing.timeline.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-gray-300">
                        <ChevronRight size={12} className="text-purple-400 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Source Link */}
        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ExternalLink size={13} /> Open primary source article
          </a>
        )}
      </div>
    </div>
  );
}
