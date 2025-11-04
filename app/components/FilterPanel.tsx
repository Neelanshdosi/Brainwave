'use client';

import { useState } from 'react';
import { Filter, Globe, X, RefreshCw } from 'lucide-react';
import { CATEGORY_COLORS } from '@/lib/neuronPosition';

interface FilterPanelProps {
  selectedCategories: string[];
  onCategoryToggle: (category: string) => void;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  showConnections: boolean;
  onConnectionsToggle: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

const CATEGORIES = [
  { id: 'tech', label: 'Technology', color: '#00d4ff' },
  { id: 'politics', label: 'Politics', color: '#ff4757' },
  { id: 'entertainment', label: 'Entertainment', color: '#ffa502' },
  { id: 'science', label: 'Science', color: '#1e90ff' },
  { id: 'sports', label: 'Sports', color: '#2ed573' },
  { id: 'other', label: 'Other', color: '#a29bfe' },
];

const REGIONS = [
  { id: 'global', label: '🌍 Global', flag: '🌍' },
  { id: 'us', label: '🇺🇸 United States', flag: '🇺🇸' },
  { id: 'india', label: '🇮🇳 India', flag: '🇮🇳' },
  { id: 'uk', label: '🇬🇧 United Kingdom', flag: '🇬🇧' },
  { id: 'europe', label: '🇪🇺 Europe', flag: '🇪🇺' },
];

export default function FilterPanel({
  selectedCategories,
  onCategoryToggle,
  selectedRegion,
  onRegionChange,
  showConnections,
  onConnectionsToggle,
  refreshing,
  onRefresh,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCategory = (categoryId: string) => {
    onCategoryToggle(categoryId);
  };

  const selectAllCategories = () => {
    CATEGORIES.forEach(cat => {
      if (!selectedCategories.includes(cat.id)) {
        onCategoryToggle(cat.id);
      }
    });
  };

  const clearAllCategories = () => {
    selectedCategories.forEach(cat => onCategoryToggle(cat));
  };

  return (
    <div className="fixed top-14 right-4 z-50 pointer-events-none">
      {/* Buttons row */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-900/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-700 hover:border-purple-500 transition-all group flex items-center gap-2"
          title="Filters"
        >
          <Filter size={22} className="text-gray-300 group-hover:text-purple-400" />
          <span className="text-sm text-gray-200">Filter</span>
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="bg-gray-900/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-gray-700 hover:border-purple-500 transition-all group flex items-center gap-2 disabled:opacity-60"
          title="Refresh data"
        >
          <RefreshCw size={22} className={`text-gray-300 group-hover:text-purple-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm text-gray-200">Refresh</span>
        </button>
      </div>

      {/* Filter Panel - anchored under Filter button */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50 bg-gray-900/95 backdrop-blur-md p-6 rounded-2xl border border-gray-700 shadow-2xl w-80 max-h-[70vh] overflow-y-auto pointer-events-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <Filter size={20} />
              Filters
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Categories Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-gray-300 font-semibold text-sm">Categories</h4>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={selectAllCategories}
                  className="text-purple-400 hover:text-purple-300"
                >
                  All
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={clearAllCategories}
                  className="text-purple-400 hover:text-purple-300"
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-gray-800 border-2 border-purple-500'
                        : 'bg-gray-800/50 border-2 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-gray-300 flex-1 text-left">
                      {category.label}
                    </span>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Region Section */}
          <div className="mb-6 pb-6 border-b border-gray-700">
            <h4 className="text-gray-300 font-semibold text-sm mb-3 flex items-center gap-2">
              <Globe size={16} />
              Region
            </h4>
            <div className="space-y-2">
              {REGIONS.map((region) => {
                const isSelected = selectedRegion === region.id;
                return (
                  <button
                    key={region.id}
                    onClick={() => onRegionChange(region.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-gray-800 border-2 border-purple-500'
                        : 'bg-gray-800/50 border-2 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{region.flag}</span>
                    <span className="text-gray-300 flex-1 text-left text-sm">
                      {region.label.replace(region.flag + ' ', '')}
                    </span>
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Neural Connections Toggle removed from Filter */}

          {/* Active Filters Count */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-gray-400 text-xs text-center">
              {selectedCategories.length} categories selected
            </p>
          </div>
        </div>
      )}
    </div>
  );
}