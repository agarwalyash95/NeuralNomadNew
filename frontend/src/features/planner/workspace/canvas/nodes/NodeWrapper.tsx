import React from 'react';
import { Plane, Car, BedDouble, Utensils, Camera, Train, Bus } from 'lucide-react';

interface NodeWrapperProps {
  type: string;
  time?: string;
  endTime?: string;
  children: React.ReactNode;
  iconBgColor?: string;
  isLast?: boolean;
}

export default function NodeWrapper({ type, time, endTime, children, iconBgColor, isLast }: NodeWrapperProps) {
  const getIcon = () => {
    switch (type) {
      case 'flight':
        return <Plane size={14} className="text-white" fill="currentColor" />;
      case 'taxi':
        return <Car size={14} className="text-white" fill="currentColor" />;
      case 'hotel':
        return <BedDouble size={14} className="text-white" fill="currentColor" />;
      case 'food':
        return <Utensils size={14} className="text-white" fill="currentColor" />;
      case 'activity':
        return <Camera size={14} className="text-white" fill="currentColor" />;
      case 'train':
        return <Train size={14} className="text-white" fill="currentColor" />;
      case 'bus':
        return <Bus size={14} className="text-white" fill="currentColor" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    if (iconBgColor) return iconBgColor;
    switch (type) {
      case 'flight':
        return 'bg-indigo-500';
      case 'taxi':
        return 'bg-amber-500';
      case 'hotel':
        return 'bg-violet-500';
      case 'food':
        return 'bg-orange-500';
      case 'activity':
        return 'bg-emerald-500';
      case 'train':
        return 'bg-blue-500';
      case 'bus':
        return 'bg-pink-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="relative py-2 pl-[144px] pr-4">
      {/* Main Spine passing through continuously */}
      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
      
      {/* Sub Spine passing through the items */}
      <div className={`absolute left-[120px] top-0 w-[1.5px] bg-slate-200 ${isLast ? 'bottom-1/2' : 'bottom-0'}`} />

      {/* Time column (between Main and Sub spine) */}
      <div className="absolute left-[64px] top-[26px] w-[40px] text-right">
        <p className="text-[11px] font-bold text-slate-800">{time}</p>
        {endTime ? <p className="text-[10px] font-semibold text-slate-500">{endTime}</p> : null}
      </div>

      {/* Activity Icon on Sub Spine */}
      <div
        className={`absolute left-[108px] top-[26px] z-10 flex h-6 w-6 items-center justify-center rounded-full border-[2px] border-white shadow-sm ${getBgColor()}`}
      >
        {getIcon()}
      </div>

      <div className="w-full">{children}</div>
    </div>
  );
}
