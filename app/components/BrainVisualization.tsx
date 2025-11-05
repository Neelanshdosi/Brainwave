'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, ContactShadows } from '@react-three/drei';
import { Suspense, useState, useMemo } from 'react';
import Neuron from './NeuronCluster';
import TopicCard from './TopicCard';
import LoadingScreen from './LoadingScreen';
import FilterPanel from './FilterPanel';
import NeuralConnections from './NeuralConnections';
import { Topic } from '@/types/topic';
import { useTrendingTopics } from '@/lib/useTrendingTopics';
import { CATEGORY_COLORS } from '@/lib/neuronPosition';
import BrainBoundary from './BrainBoundary';

export default function BrainVisualization() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'tech', 'politics', 'entertainment', 'science', 'sports', 'other'
  ]);
  const [showConnections, setShowConnections] = useState(false);
  
  const { topics, loading, error, lastUpdate, refetch } = useTrendingTopics();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [hoveredTopic, setHoveredTopic] = useState<Topic | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredTopics = useMemo(() => {
    return topics.filter(topic => selectedCategories.includes(topic.category));
  }, [topics, selectedCategories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Region removed (Global only)

  const toggleConnections = () => {
    setShowConnections(prev => !prev);
  };

  if (loading && topics.length === 0) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Failed to load trends</p>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Tooltip */}
      {hoveredTopic && !selectedTopic && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700 z-10 max-w-md">
          <p className="text-white font-medium truncate">{hoveredTopic.name}</p>
          <p className="text-gray-400 text-xs">{hoveredTopic.source}</p>
        </div>
      )}

      {/* Topic Card */}
      {selectedTopic && (
        <TopicCard topic={selectedTopic} onClose={() => setSelectedTopic(null)} />
      )}

      {/* Filter Panel */}
      <FilterPanel
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
        showConnections={showConnections}
        onConnectionsToggle={toggleConnections}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[5, 6, 4]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-near={0.5}
            shadow-camera-far={25}
          />
          <pointLight position={[8, -6, 6]} intensity={0.6} color="#4444ff" castShadow />
          
          <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
          <BrainBoundary />
          {showConnections && <NeuralConnections topics={filteredTopics} />}

          {filteredTopics.map((topic) => (
            <Neuron
              key={topic.id}
              position={topic.position}
              topic={topic}
              onClick={setSelectedTopic}
              onHover={setHoveredTopic}
            />
          ))}

          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            autoRotate={true}
            autoRotateSpeed={0.5}
            minDistance={5}
            maxDistance={15}
          />

          <ContactShadows
            position={[0, -0.6, 0]}
            opacity={0.35}
            scale={20}
            blur={2.5}
            far={6}
            resolution={1024}
            frames={1}
          />
        </Suspense>
      </Canvas>

      {/* ✅ Updated Header */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-4xl font-bold text-white mb-1">Brainwave</h1>
        <p className="text-gray-400">Global news, visualized in real-time.</p>
        {lastUpdate && (
          <p className="text-gray-500 text-xs mt-1">
            Updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
        <p className="text-purple-400 text-sm mt-1">
          {filteredTopics.length} / {topics.length} stories active
        </p>
      </div>

      {/* Neural Connections Toggle */}
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={toggleConnections}
          className={`w-[260px] flex items-center justify-between px-4 py-3 rounded-xl transition-all bg-gray-900/80 border ${
            showConnections ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="text-xl">🔗</div>
            <div className="text-left">
              <div className="text-gray-200 font-medium text-sm">Neural Connections</div>
              <div className="text-gray-500 text-xs">Show topic relationships</div>
            </div>
          </div>
          <div
            className={`w-14 h-7 rounded-full transition-colors relative ${
              showConnections ? 'bg-purple-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                showConnections ? 'translate-x-7' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm p-4 rounded-lg border border-gray-700 z-10 max-w-xs">
        <p className="text-gray-300 text-sm">
          <span className="font-semibold text-white">Hover</span> to preview<br />
          <span className="font-semibold text-white">Click</span> for details<br />
          <span className="font-semibold text-white">Filter</span> by category<br />
          <span className="font-semibold text-white">Drag</span> to rotate •{' '}
          <span className="font-semibold text-white">Scroll</span> to zoom
        </p>
        <p className="text-gray-500 text-xs mt-3 pt-3 border-t border-gray-700">
          Made By Neelansh D
        </p>
      </div>
    </div>
  );
}
