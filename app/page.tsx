'use client';

import dynamic from 'next/dynamic';
import LoadingScreen from './components/LoadingScreen';

// Dynamically import to avoid SSR issues with Three.js
const BrainVisualization = dynamic(
  () => import('./components/BrainVisualization'),
  { 
    ssr: false,
    loading: () => <LoadingScreen />
  }
);

export default function Home() {
  return <BrainVisualization />;
}