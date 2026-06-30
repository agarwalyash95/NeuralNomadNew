# Quick Reference Guide - Helper Components

## 🚀 Quick Start

### Import Components

```typescript
// Booking components
import { 
  FlightSearchForm, 
  HotelSearchForm, 
  BookingResults 
} from './helpers/booking';

// Attractions components
import { 
  AttractionsSearchForm, 
  AttractionsResults 
} from './helpers/attractions';

// Travel prep components
import { 
  ForexSearchForm, 
  VisaResults 
} from './helpers/travel-prep';
```

## 📝 Common Tasks

### Adding a New Booking Type

**Example: Adding Ferry Booking**

1. **Create the form component:**
```typescript
// helpers/booking/FerrySearchForm.tsx
'use client';

import React from 'react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';

interface FerrySearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function FerrySearchForm({ params, onUpdateParam }: FerrySearchFormProps) {
  return (
    <>
      <LocationAutocomplete
        label="From Port"
        value={params.origin}
        type="port"
        onChange={(v) => onUpdateParam('origin', v)}
      />
      <LocationAutocomplete
        label="To Port"
        value={params.destination}
        type="port"
        onChange={(v) => onUpdateParam('destination', v)}
      />
      <SearchField
        label="Date"
        type="date"
        value={params.departureDate}
        onChange={(v) => onUpdateParam('departureDate', v)}
      />
    </>
  );
}
```

2. **Add to index:**
```typescript
// helpers/booking/index.ts
export { default as FerrySearchForm } from './FerrySearchForm';
```

3. **Update BookingHelper:**
```typescript
// BookingHelper.tsx
import { FerrySearchForm } from './helpers/booking';

const services = [
  // ... existing services
  { id: 'ferry', label: 'Ferry', icon: Ship },
];

// In form section:
{params.service === 'ferry' && (
  <FerrySearchForm
    params={params}
    onUpdateParam={(field, value) => updateParam(setParams, field, value)}
  />
)}
```

### Modifying an Existing Form

**Example: Adding a Field to Flight Form**

```typescript
// helpers/booking/FlightSearchForm.tsx

// Add new field
<SelectField
  label="Airline Preference"
  value={params.airlinePreference}
  options={[
    { value: 'any', label: 'Any Airline' },
    { value: 'indigo', label: 'IndiGo' },
    { value: 'airindia', label: 'Air India' },
  ]}
  onChange={(v) => onUpdateParam('airlinePreference', v)}
/>
```

### Updating Results Display

**Example: Customizing Booking Results**

```typescript
// helpers/booking/BookingResults.tsx

export default function BookingResults({ loading, results, serviceType }: BookingResultsProps) {
  // Add custom filtering or sorting
  const sortedResults = results.sort((a, b) => a.price - b.price);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">
          {results.length} Results
        </h3>
        <select className="text-xs">
          <option>Sort by Price</option>
          <option>Sort by Duration</option>
        </select>
      </div>
      <SearchResults results={sortedResults} />
    </div>
  );
}
```

## 🎨 Styling Guide

### Component Wrapper
```typescript
<div className="rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm">
```

### Form Container
```typescript
<form className="flex flex-col gap-3">
```

### Input Field
```typescript
<div className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
    Label
  </label>
  <input className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none" />
</div>
```

### Submit Button
```typescript
<button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800">
  Submit
</button>
```

## 🔧 Common Patterns

### Conditional Rendering
```typescript
{params.service === 'flight' && <FlightSearchForm />}
{activeService === 'forex' && <ForexSearchForm />}
{loading && <LoadingSpinner />}
```

### State Updates
```typescript
const updateParam = (field: keyof BookingSearchParams, value: string) => {
  setParams(current => ({ ...current, [field]: value }));
};
```

### Form Submission
```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  const error = validateParams(params);
  if (error) {
    setFormError(error);
    return;
  }
  await search(params);
};
```

## 📦 Component Props Reference

### SearchField
```typescript
interface SearchFieldProps {
  label: string;           // Field label
  value: string;           // Current value
  placeholder?: string;    // Input placeholder
  type?: string;          // Input type (text, date, number)
  onChange: (value: string) => void;
  icon?: React.ElementType; // Optional icon
}
```

### SelectField
```typescript
interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ElementType;
}
```

## 🐛 Debugging Tips

### Check Component Rendering
```typescript
console.log('Rendering FlightSearchForm with params:', params);
```

### Validate Props
```typescript
useEffect(() => {
  console.log('Current service:', params.service);
  console.log('Origin:', params.origin);
  console.log('Destination:', params.destination);
}, [params]);
```

### Test Form Submission
```typescript
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  console.log('Form submitted with data:', params);
  // ... rest of logic
};
```

## 📊 File Locations Quick Map

```
Need to update flight search? → helpers/booking/FlightSearchForm.tsx
Need to update hotel search? → helpers/booking/HotelSearchForm.tsx
Need to update train search? → helpers/booking/TrainSearchForm.tsx
Need to update bus search? → helpers/booking/BusSearchForm.tsx
Need to update cab search? → helpers/booking/CabSearchForm.tsx

Need to update booking results? → helpers/booking/BookingResults.tsx
Need to update shared input? → helpers/booking/SearchField.tsx
Need to update shared dropdown? → helpers/booking/SelectField.tsx

Need to update attractions search? → helpers/attractions/AttractionsSearchForm.tsx
Need to update attractions results? → helpers/attractions/AttractionsResults.tsx

Need to update forex search? → helpers/travel-prep/ForexSearchForm.tsx
Need to update visa search? → helpers/travel-prep/VisaSearchForm.tsx
Need to update forex results? → helpers/travel-prep/ForexResults.tsx
Need to update visa results? → helpers/travel-prep/VisaResults.tsx

Main container files:
- BookingHelper.tsx (manages booking state)
- AttractionsHelper.tsx (manages attractions state)
- TravelPrepHelper.tsx (manages travel prep state)
```

## 🎯 Best Practices

1. **Keep forms focused** - Each form handles only its service type
2. **Use shared components** - Leverage SearchField and SelectField
3. **Maintain consistency** - Follow existing styling patterns
4. **Type everything** - Full TypeScript typing for all props
5. **Document changes** - Update README if adding new components
6. **Test independently** - Each component should work in isolation

## 🚨 Common Mistakes to Avoid

❌ Don't put logic in form components
✅ Keep forms presentational, logic in parent

❌ Don't duplicate SearchField/SelectField
✅ Use the shared components

❌ Don't mix service types in one component
✅ Keep them separated

❌ Don't forget to update index.ts
✅ Export new components

❌ Don't modify BookingSearchParams without backend sync
✅ Coordinate with backend team

## 📚 Additional Resources

- Full documentation: `README.md`
- Architecture details: `ARCHITECTURE.md`
- Refactoring summary: `REFACTORING_SUMMARY.md`
- Types: `@/types/booking.ts`, `@/types/forex.ts`, `@/types/visa.ts`

---

**Quick Help:**
- New transport type? → Create form in `booking/` + update `BookingHelper.tsx`
- Change existing form? → Edit specific form component
- Update styling? → Modify in form component or shared components
- Add validation? → Update parent helper component

Happy coding! 🚀
