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

  const timestamp = typeof topic.timestamp === 'string' 
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
        hasRedditData: !!topic.redditData
      });
    }
  }, []);

const fetchAiSummary = async () => {
  console.log('📤 Starting AI summary request...');
  setLoadingSummary(true);
  setSummaryError(null);

  try {
    // Extract the permalink from the full URL
    const permalink = topic.url?.replace('https://reddit.com', '') || '';
    
    const payload = {
      url: permalink,
      title: topic.name,
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
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <span 
              className="text-xs px-3 py-1 rounded-full bg-opacity-20" 
              style={{ 
                backgroundColor: `${color}40`,
                color: color
              }}
            >
              {topic.category}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">{topic.name}</h2>
        
        {/* AI Summary Section */}
        <div className="mb-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">AI Summary</span>
          </div>
          
          {loadingSummary && (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Generating summary...</span>
            </div>
          )}
          
          {aiSummary && !loadingSummary && (
            <p className="text-gray-300 text-sm leading-relaxed">{aiSummary}</p>
          )}
          
          {summaryError && !loadingSummary && (
            <div>
              <p className="text-red-400 text-sm mb-2">Error: {summaryError}</p>
              <button
                onClick={fetchAiSummary}
                className="text-xs text-purple-400 hover:text-purple-300 underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Basic stats */}
        <p className="text-gray-400 text-sm mb-4">{topic.summary}</p>
        
        <div className="flex justify-between items-center text-sm text-gray-400 pt-4 border-t border-gray-700">
          <span className="font-medium">{topic.source}</span>
          <span>
            {timeAgo < 60 
              ? `${timeAgo}m ago` 
              : timeAgo < 1440 
                ? `${Math.floor(timeAgo / 60)}h ago` 
                : `${Math.floor(timeAgo / 1440)}d ago`
            }
          </span>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="h-2 flex-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${topic.intensity * 100}%` }}
              />
            </div>
            <span>{Math.round(topic.intensity * 100)}% trending</span>
          </div>
        </div>

        {topic.url && (
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition-colors"
          >
            View on Reddit
            <ExternalLink size={16} />
          </a>
        )}
      </div>
    </div>
  );
}