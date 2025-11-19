import React from 'react';

interface VisualizerProps {
  isActive: boolean;
  level: number; // 0 to 1
  color: string;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, level, color }) => {
  // If inactive, show a flat line or small pulse
  const scale = isActive ? 1 + level * 2 : 1;
  const opacity = isActive ? 0.6 + level * 0.4 : 0.3;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      {/* Outer Glow Ring */}
      <div 
        className={`absolute rounded-full transition-all duration-75 ease-linear`}
        style={{
            width: '100%',
            height: '100%',
            backgroundColor: color,
            transform: `scale(${scale})`,
            opacity: opacity * 0.3,
            filter: 'blur(20px)',
        }}
      />
       {/* Middle Ring */}
      <div 
        className={`absolute rounded-full transition-all duration-75 ease-linear`}
        style={{
            width: '80%',
            height: '80%',
            border: `2px solid ${color}`,
            transform: `scale(${isActive ? 1 + level * 0.5 : 1})`,
            opacity: opacity * 0.8,
        }}
      />
      {/* Core Circle */}
      <div 
        className={`relative rounded-full shadow-lg transition-all duration-200`}
        style={{
            width: '60%',
            height: '60%',
            backgroundColor: color,
            opacity: 0.9,
            transform: isActive ? 'scale(0.9)' : 'scale(1)',
        }}
      >
         {isActive && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
             </div>
         )}
      </div>
    </div>
  );
};

export default Visualizer;