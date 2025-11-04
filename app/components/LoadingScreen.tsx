'use client';

export default function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Initializing Brainwave</h2>
        <p className="text-gray-400">Connecting to global consciousness...</p>
      </div>
    </div>
  );
}