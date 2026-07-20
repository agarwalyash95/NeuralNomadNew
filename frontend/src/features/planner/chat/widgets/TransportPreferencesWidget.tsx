import React, { useState, useEffect } from 'react';
import { Plane, Train, Bus, Car, Navigation, Ship } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface TransportPreferencesWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function TransportPreferencesWidget({ onSubmit, widget, isCompleted }: TransportPreferencesWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;
  const mode = (data.mode as string) || 'flight';

  // State mapping for all modes
  const [flightClass, setFlightClass] = useState<string>(prefilled.flight_class || 'Economy');
  const [nonStop, setNonStop] = useState<string>(prefilled.non_stop || 'Any Flight');
  const [preferredTime, setPreferredTime] = useState<string>(prefilled.time_window || 'Morning');

  const [trainClass, setTrainClass] = useState<string>(prefilled.train_class || '3rd AC');
  const [journeyTiming, setJourneyTiming] = useState<string>(prefilled.journey_timing || 'Overnight');
  const [tatkal, setTatkal] = useState<string>(prefilled.tatkal || 'Standard Booking');

  const [busType, setBusType] = useState<string>(prefilled.bus_type || 'AC Sleeper');

  const [carType, setCarType] = useState<string>(prefilled.car_type || 'SUV');
  const [priority, setPriority] = useState<string>(prefilled.priority || 'Max Comfort');

  const [transmission, setTransmission] = useState<string>(prefilled.transmission || 'Automatic');
  const [ownVehicle, setOwnVehicle] = useState<boolean>(prefilled.own_vehicle || false);
  const [ferryClass, setFerryClass] = useState<string>(prefilled.ferry_class || 'Economy Deck');

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.flight_class) setFlightClass(prefilled.flight_class);
      if (prefilled.non_stop) setNonStop(prefilled.non_stop);
      if (prefilled.time_window) setPreferredTime(prefilled.time_window);
      if (prefilled.train_class) setTrainClass(prefilled.train_class);
      if (prefilled.journey_timing) setJourneyTiming(prefilled.journey_timing);
      if (prefilled.tatkal) setTatkal(prefilled.tatkal);
      if (prefilled.bus_type) setBusType(prefilled.bus_type);
      if (prefilled.car_type) setCarType(prefilled.car_type);
      if (prefilled.priority) setPriority(prefilled.priority);
      if (prefilled.transmission) setTransmission(prefilled.transmission);
      if (prefilled.own_vehicle !== undefined) setOwnVehicle(prefilled.own_vehicle);
      if (prefilled.ferry_class) setFerryClass(prefilled.ferry_class);
    }
  }, [prefilled, isCompleted]);

  const handleConfirm = () => {
    let summaryText = '';
    let values: Record<string, any> = { mode };

    if (mode === 'flight') {
      summaryText = `Flight: ${flightClass}, ${nonStop === 'Direct Only' ? 'Direct only' : 'Any flights'}, ${preferredTime} preferred.`;
      values = { ...values, flight_class: flightClass, non_stop: nonStop, time_window: preferredTime };
    } else if (mode === 'train') {
      summaryText = `Train: ${trainClass}, ${journeyTiming.toLowerCase()} travel, ${tatkal === 'Tatkal / Urgent' ? 'Tatkal' : 'Standard'}.`;
      values = { ...values, train_class: trainClass, journey_timing: journeyTiming, tatkal };
    } else if (mode === 'bus') {
      summaryText = `Bus: ${busType}, ${journeyTiming.toLowerCase()} preferred.`;
      values = { ...values, bus_type: busType, journey_timing: journeyTiming };
    } else if (mode === 'cab') {
      summaryText = `Cab: ${carType}, focus on ${priority.toLowerCase()}.`;
      values = { ...values, car_type: carType, priority };
    } else if (mode === 'self_drive') {
      summaryText = `Self Drive: ${ownVehicle ? 'Own car' : `Rental ${carType}`}, ${transmission.toLowerCase()} transmission.`;
      values = { ...values, car_type: carType, transmission, own_vehicle: ownVehicle };
    } else if (mode === 'ferry') {
      summaryText = `Ferry / Cruise: ${ferryClass}.`;
      values = { ...values, ferry_class: ferryClass };
    }

    onSubmit(summaryText, {
      field: 'transport_preferences',
      value: values,
    });
  };

  // Summary rendering
  const summaryNode = () => {
    if (mode === 'flight') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{flightClass} • {nonStop}</span>
          <span className="text-xs text-ink-500">Departure: {preferredTime}</span>
        </div>
      );
    } else if (mode === 'train') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{trainClass} • {journeyTiming}</span>
          <span className="text-xs text-ink-500">{tatkal}</span>
        </div>
      );
    } else if (mode === 'bus') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{busType}</span>
          <span className="text-xs text-ink-500">{journeyTiming} journey</span>
        </div>
      );
    } else if (mode === 'cab') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{carType} Cab</span>
          <span className="text-xs text-ink-500">Priority: {priority}</span>
        </div>
      );
    } else if (mode === 'self_drive') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{ownVehicle ? 'Personal Vehicle' : `Rental: ${carType}`}</span>
          <span className="text-xs text-ink-500">{transmission} transmission</span>
        </div>
      );
    } else if (mode === 'ferry') {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-ink-900">{ferryClass}</span>
          <span className="text-xs text-ink-500">Ferry / Cruise</span>
        </div>
      );
    }
    return null;
  };

  // Helper renderers
  const Selector = ({ label, options, value, setValue }: { label: string, options: string[], value: string, setValue: (v: string) => void }) => (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setValue(opt)}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
              value === opt
                ? 'border-transparent bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  let icon = <Plane size={14} />;
  let title = 'Flight Details';
  if (mode === 'train') { icon = <Train size={14} />; title = 'Train Preferences'; }
  else if (mode === 'bus') { icon = <Bus size={14} />; title = 'Bus Preferences'; }
  else if (mode === 'cab') { icon = <Navigation size={14} />; title = 'Cab Preferences'; }
  else if (mode === 'self_drive') { icon = <Car size={14} />; title = 'Self Drive Options'; }
  else if (mode === 'ferry') { icon = <Ship size={14} />; title = 'Ferry / Cruise Options'; }

  return (
    <WidgetContainer
      header={{
        icon,
        title,
        subtitle: `Specify details for your ${mode === 'self_drive' ? 'drive' : mode} transit`,
      }}
      isCompleted={isCompleted}
      summaryNode={summaryNode()}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-3">
        {mode === 'flight' && (
          <>
            <Selector label="Flight Class" options={['Economy', 'Premium Economy', 'Business', 'First Class']} value={flightClass} setValue={setFlightClass} />
            <Selector label="Stops" options={['Direct Only', 'Any Flight']} value={nonStop} setValue={setNonStop} />
            <Selector label="Departure Window" options={['Morning', 'Afternoon', 'Evening', 'Night']} value={preferredTime} setValue={setPreferredTime} />
          </>
        )}

        {mode === 'train' && (
          <>
            <Selector label="Coach / Class" options={['Sleeper', '3rd AC', '2nd AC', '1st AC', 'Chair Car']} value={trainClass} setValue={setTrainClass} />
            <Selector label="Timing" options={['Day Journey', 'Overnight']} value={journeyTiming} setValue={setJourneyTiming} />
            <Selector label="Quota style" options={['Standard Booking', 'Tatkal / Urgent']} value={tatkal} setValue={setTatkal} />
          </>
        )}

        {mode === 'bus' && (
          <>
            <Selector label="Bus Class" options={['AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Volvo']} value={busType} setValue={setBusType} />
            <Selector label="Timing" options={['Day Journey', 'Overnight']} value={journeyTiming} setValue={setJourneyTiming} />
          </>
        )}

        {mode === 'cab' && (
          <>
            <Selector label="Cab Type" options={['Hatchback', 'Sedan', 'SUV', 'Luxury']} value={carType} setValue={setCarType} />
            <Selector label="Route Priority" options={['Cheapest', 'Fastest Route', 'Max Comfort']} value={priority} setValue={setPriority} />
          </>
        )}

        {mode === 'self_drive' && (
          <>
            <div className="flex items-center justify-between py-1 border-b border-line">
              <span className="text-xs font-semibold text-ink-700">Using my own car</span>
              <input 
                type="checkbox" 
                checked={ownVehicle}
                onChange={(e) => setOwnVehicle(e.target.checked)}
                className="w-4 h-4 rounded text-ink-900 border-line focus:ring-ink-900" 
              />
            </div>
            {!ownVehicle && (
              <Selector label="Rental Car Class" options={['Hatchback', 'Sedan', 'SUV', 'Luxury']} value={carType} setValue={setCarType} />
            )}
            <Selector label="Transmission" options={['Automatic', 'Manual']} value={transmission} setValue={setTransmission} />
          </>
        )}

        {mode === 'ferry' && (
          <Selector label="Ferry / Cruise Class" options={['Economy Deck', 'Business Class', 'Cabin', 'Luxury Suite']} value={ferryClass} setValue={setFerryClass} />
        )}
      </div>
    </WidgetContainer>
  );
}
