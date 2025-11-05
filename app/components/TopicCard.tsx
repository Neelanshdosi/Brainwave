'use client';

import { Topic } from '@/types/topic';
import { X, ExternalLink, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TopicCardProps {
  topic: Topic;
  onClose: () => void;
}

export default function TopicCard({ topic, onClose }: TopicCardProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(topic.aiSummary || null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const timestamp =
    typeof topic.timestamp === 'string'
      ? new Date(topic.timestamp)
      : topic.timestamp;
  const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / 60000);

  const getCategoryColor = (category: string) => {
    const colors = {
      tech: '#00d4ff',
      politics: '#ff4757',
      entertainment: '#ffa502',
      science: '#1e90ff',
      sports: '#2ed573',
      other: '#a29bfe',
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const color = getCategoryColor(topic.category);

  useEffect(() => {
    console.log('🎯 TopicCard mounted for:', topic.name);
    console.log('📊 Reddit data available:', !!topic.redditData);

    if (!aiSummary && !loadingSummary && !summaryError && topic.redditData) {
      console.log('🚀 Triggering AI summary fetch...');
      fetchAiSummary();
    } else {
      console.log('⏭️ Skipping fetch:', {
        hasAiSummary: !!aiSummary,
        isLoading: loadingSummary,
        hasError: !!summaryError,
        hasRedditData: !!topic.redditData,
      });
    }
  }, []);

  // ✅ Updated fetchAiSummary function
  const fetchAiSummary = async () => {
    console.log('📤 Starting AI summary request...');
    setLoadingSummary(true);
    setSummaryError(null);

    try {
      const payload = {
        url: topic.url || '',
        title: topic.name,
        description: topic.summary, // Use the summary field as description
      };

      console.log('📦 Payload:', payload);

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch summary');
      }

      const data = await response.json();
      console.log('✅ Received data:', data);

      if (data.success && data.summary) {
        console.log('✨ Setting AI summary');
        setAiSummary(data.summary);
      } else {
        console.warn('⚠️ Invalid response format');
        setSummaryError('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error fetching AI summary:', error);
      setSummaryError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="relative bg-[#0f0f0f] text-white p-6 rounded-2xl shadow-xl w-[90%] max-w-lg border border-neutral-800">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2 className="text-2xl font-semibold mb-2" style={{ color }}>
          {topic.name}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`}
        </p>

        {/* Summary */}
        {loadingSummary ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Sparkles className="animate-spin" size={16} /> Generating summary...
          </div>
        ) : summaryError ? (
          <p className="text-red-400 text-sm">Error: {summaryError}</p>
        ) : aiSummary ? (
          <p className="text-gray-200 mb-4">{aiSummary}</p>
        ) : (
          <p className="text-gray-400 text-sm italic">
            No summary available.
          </p>
        )}

        {/* Link */}
        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-3"
          >
            <ExternalLink size={14} /> View Source
          </a>
        )}
      </div>
    </div>
  );
}
