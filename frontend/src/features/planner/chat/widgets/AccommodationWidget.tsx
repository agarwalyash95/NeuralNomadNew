import React, { useState, useEffect } from 'react';
import { Home, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface AccommodationWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function AccommodationWidget({ onSubmit, widget, isCompleted }: AccommodationWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [starRating, setStarRating] = useState<string>(prefilled.star_rating || '4 Star');
  const [propertyType, setPropertyType] = useState<string>(prefilled.property_type || 'Hotel');
  const [amenities, setAmenities] = useState<string[]>(prefilled.amenities || []);
  const [mealPlan, setMealPlan] = useState<string>(prefilled.meal_plan || 'Breakfast Included');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.star_rating) setStarRating(prefilled.star_rating);
      if (prefilled.property_type) setPropertyType(prefilled.property_type);
      if (prefilled.amenities) setAmenities(prefilled.amenities);
      if (prefilled.meal_plan) setMealPlan(prefilled.meal_plan);
    }
  }, [prefilled.star_rating, prefilled.property_type, prefilled.amenities, prefilled.meal_plan, isCompleted]);

  const toggleAmenity = (am: string) =>
    setAmenities(prev => prev.includes(am) ? prev.filter(x => x !== am) : [...prev, am]);

  const handleConfirm = () => {
    onSubmit(`Stay: ${starRating} ${propertyType}, ${mealPlan}`, {
      field: 'accommodation_preferences',
      value: { star_rating: starRating, property_type: propertyType, amenities, meal_plan: mealPlan },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{starRating} · {propertyType}</span>;

  const Chips = ({ options, value, setValue }: { options: string[]; value: string; setValue: (v: string) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => setValue(opt)}
          className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
            value === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <WidgetContainer
      header={{ icon: <Home size={13} />, title: 'Where to stay?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <Chips
        options={['3 Star', '4 Star', '5 Star', 'Luxury']}
        value={starRating}
        setValue={setStarRating}
      />
      <Chips
        options={['Hotel', 'Resort', 'Villa', 'Homestay', 'Hostel']}
        value={propertyType}
        setValue={setPropertyType}
      />

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
      >
        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Less' : 'Meal plan & amenities'}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-line pt-2">
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Meal Plan</span>
            <Chips
              options={['Room Only', 'Breakfast Included', 'Half Board', 'All Inclusive']}
              value={mealPlan}
              setValue={setMealPlan}
            />
          </div>
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Amenities</span>
            <div className="flex flex-wrap gap-1.5">
              {['Pool', 'Spa', 'Gym', 'Beachfront', 'Free Wi-Fi', 'Pet Friendly'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleAmenity(opt)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    amenities.includes(opt) ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
}
