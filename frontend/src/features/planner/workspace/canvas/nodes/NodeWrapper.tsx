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
    <div className="relative py-1.5 pl-24 md:pl-28">
      <div className="absolute left-0 top-1/2 w-16 -translate-y-1/2 text-right">
        <p className="text-xs font-semibold text-slate-800">{time}</p>
        {endTime ? <p className="mt-0.5 text-[10px] font-medium text-slate-500">{endTime}</p> : null}
      </div>

      {!isLast ? (
        <div className="absolute bottom-[-52%] left-[81px] top-1/2 w-px bg-[#ddd7ca] md:left-[89px]" />
      ) : null}

      <div
        className={`absolute left-[71px] top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg shadow-sm md:left-[79px] ${getBgColor()}`}
      >
        {getIcon()}
      </div>

      <div className="w-full">{children}</div>
    </div>
  );
}
