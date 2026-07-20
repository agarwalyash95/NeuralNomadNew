import React, { useState, useEffect } from 'react';
import { Users2 } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface GroupTypeWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const GROUP_TYPES = [
  { id: 'solo', label: 'Solo', emoji: '🧳' },
  { id: 'couple', label: 'Couple', emoji: '💑' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
  { id: 'friends', label: 'Friends', emoji: '🎉' },
  { id: 'honeymoon', label: 'Honeymoon', emoji: '🥂' },
  { id: 'corporate', label: 'Corporate', emoji: '💼' },
];

export function GroupTypeWidget({ onSubmit, widget, isCompleted }: GroupTypeWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [groupType, setGroupType] = useState<string>(prefilled.group_type || 'couple');

  useEffect(() => {
    if (!isCompleted && prefilled.group_type) setGroupType(prefilled.group_type);
  }, [prefilled.group_type, isCompleted]);

  const selected = GROUP_TYPES.find(g => g.id === groupType);

  const handleConfirm = () => {
    onSubmit(`Traveling as: ${selected?.label}`, {
      field: 'group_type',
      value: { group_type: groupType },
    });
  };

  const summaryNode = (
    <span className="font-semibold text-ink-800">{selected?.emoji} {selected?.label}</span>
  );

  return (
    <WidgetContainer
      header={{ icon: <Users2 size={13} />, title: 'Traveling as?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-wrap gap-1.5">
        {GROUP_TYPES.map(g => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroupType(g.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
              groupType === g.id
                ? 'border-ink-900 bg-ink-900 text-white shadow-sm'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            <span>{g.emoji}</span> {g.label}
          </button>
        ))}
      </div>
    </WidgetContainer>
  );
}
