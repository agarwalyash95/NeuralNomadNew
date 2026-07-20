import React, { useMemo, useState } from 'react';
import { Car, Check } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface Props {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const Choice = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
      active ? 'border-ink-800 bg-ink-900 text-white' : 'border-line bg-paper-1 text-ink-600 hover:border-ink-300'
    }`}
  >
    {label}
  </button>
);

export function SelfDriveWidget({ widget, onSubmit, isCompleted }: Props) {
  const stage = String(widget.data.stage || 'openness');
  const defaults = (widget.data.defaults || {}) as Record<string, any>;
  const [canDrive, setCanDrive] = useState<boolean | null>(null);
  const [licenseReady, setLicenseReady] = useState<boolean | null>(null);
  const [vehicleAccess, setVehicleAccess] = useState<string>('');
  const [maxHours, setMaxHours] = useState<number>(Number(defaults.max_driving_hours || 6));
  const [nightDriving, setNightDriving] = useState<boolean>(Boolean(defaults.night_driving));
  const [mountainExperience, setMountainExperience] = useState<string>('');

  const value = useMemo(() => {
    if (stage === 'openness') return { can_drive: canDrive };
    if (stage === 'readiness') return { license_ready: licenseReady, vehicle_access: vehicleAccess || null };
    return {
      max_driving_hours: maxHours,
      night_driving: nightDriving,
      ...(Array.isArray(widget.data.fields) && widget.data.fields.includes('mountain_experience')
        ? { mountain_experience: mountainExperience || null }
        : {}),
    };
  }, [stage, canDrive, licenseReady, vehicleAccess, maxHours, nightDriving, mountainExperience, widget.data.fields]);

  const valid = stage === 'openness'
    ? canDrive !== null
    : stage === 'readiness'
      ? licenseReady !== null && (!licenseReady || Boolean(vehicleAccess))
      : maxHours > 0;

  const submit = () => {
    if (!valid) return;
    const message = stage === 'openness'
      ? (canDrive ? 'I am open to self-driving.' : 'I do not want to drive on this trip.')
      : stage === 'readiness'
        ? (licenseReady ? `I am licensed and prefer ${vehicleAccess === 'own' ? 'my own vehicle' : 'a rental'}.` : 'I am not license-ready for this trip.')
        : `Keep driving to ${maxHours} hours per day${nightDriving ? ', including night driving' : ', with no night driving'}.`;
    onSubmit(message, { field: 'self_drive_profile', value });
  };

  return (
    <WidgetContainer
      header={{ icon: <Car size={13} />, title: String(widget.data.step_label || 'Driving preferences') }}
      isCompleted={isCompleted}
      onConfirm={valid ? submit : undefined}
      onSkip={() => onSubmit('Skip driving questions.', {
        field: 'self_drive_profile',
        value: stage === 'openness' ? { can_drive: false } : defaults,
      })}
      summaryNode={<span className="flex items-center gap-1"><Check size={10} /> Saved</span>}
    >
      <p className="text-[10px] leading-relaxed text-ink-500">{String(widget.data.step_hint || '')}</p>

      {stage === 'openness' && (
        <div className="grid grid-cols-2 gap-2">
          <Choice active={canDrive === true} label="Yes, I can drive" onClick={() => setCanDrive(true)} />
          <Choice active={canDrive === false} label="No driving" onClick={() => setCanDrive(false)} />
        </div>
      )}

      {stage === 'readiness' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={licenseReady === true} label="License ready" onClick={() => setLicenseReady(true)} />
            <Choice active={licenseReady === false} label="Not license ready" onClick={() => { setLicenseReady(false); setVehicleAccess(''); }} />
          </div>
          {licenseReady && (
            <div className="grid grid-cols-2 gap-2">
              <Choice active={vehicleAccess === 'own'} label="Own vehicle" onClick={() => setVehicleAccess('own')} />
              <Choice active={vehicleAccess === 'rental'} label="Rental" onClick={() => setVehicleAccess('rental')} />
            </div>
          )}
        </>
      )}

      {stage === 'route_comfort' && (
        <>
          <label className="text-[10px] font-semibold text-ink-600">
            Maximum driving per day: {maxHours} hours
            <input
              className="mt-2 w-full accent-ink-900"
              type="range"
              min={2}
              max={10}
              value={maxHours}
              onChange={event => setMaxHours(Number(event.target.value))}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Choice active={!nightDriving} label="Daylight only" onClick={() => setNightDriving(false)} />
            <Choice active={nightDriving} label="Night driving is OK" onClick={() => setNightDriving(true)} />
          </div>
          {Array.isArray(widget.data.fields) && widget.data.fields.includes('mountain_experience') && (
            <div className="grid grid-cols-2 gap-2">
              <Choice active={mountainExperience === 'experienced'} label="Mountain experienced" onClick={() => setMountainExperience('experienced')} />
              <Choice active={mountainExperience === 'avoid'} label="Avoid mountain driving" onClick={() => setMountainExperience('avoid')} />
            </div>
          )}
        </>
      )}
    </WidgetContainer>
  );
}
