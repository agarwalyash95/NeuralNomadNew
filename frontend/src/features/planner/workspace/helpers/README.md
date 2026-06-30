# Planner Helper Components

This directory contains the separated helper canvas components for the NeuralNomad planner feature.

## 📁 Directory Structure

```
helpers/
├── booking/              # Booking-related helpers (flights, hotels, trains, buses, cabs)
│   ├── FlightSearchForm.tsx
│   ├── HotelSearchForm.tsx
│   ├── TrainSearchForm.tsx
│   ├── BusSearchForm.tsx
│   ├── CabSearchForm.tsx
│   ├── SearchField.tsx      # Reusable search input field
│   ├── SelectField.tsx      # Reusable select dropdown field
│   ├── BookingResults.tsx   # Results display component
│   └── index.ts
│
├── attractions/          # Attractions exploration helpers
│   ├── AttractionsSearchForm.tsx
│   ├── AttractionsResults.tsx
│   └── index.ts
│
└── travel-prep/          # Travel preparation helpers (forex, visa)
    ├── ForexSearchForm.tsx
    ├── VisaSearchForm.tsx
    ├── ForexResults.tsx
    ├── VisaResults.tsx
    └── index.ts
```

## 🎯 Component Organization

### Booking Components (`booking/`)

**Search Forms:**
- `FlightSearchForm` - Flight booking search with trip type, origin, destination, dates, travelers, class
- `HotelSearchForm` - Hotel booking search with location, check-in/out, rooms, guests
- `TrainSearchForm` - Train booking search with stations, date, class, quota
- `BusSearchForm` - Bus booking search with cities, date, seat type, passengers
- `CabSearchForm` - Cab booking search with cab type, pickup, drop, time

**Shared Components:**
- `SearchField` - Reusable text/date/number input field with icon and label
- `SelectField` - Reusable dropdown select field with icon and label
- `BookingResults` - Unified results display for all booking types

### Attractions Components (`attractions/`)

- `AttractionsSearchForm` - Location search with autocomplete dropdown
- `AttractionsResults` - Display places with filtering (all/sights/food/activities)

### Travel Prep Components (`travel-prep/`)

**Forex:**
- `ForexSearchForm` - Currency conversion and vendor search form
- `ForexResults` - Display forex vendors and conversion rates

**Visa:**
- `VisaSearchForm` - Destination country visa requirements search
- `VisaResults` - Display visa information and requirements

## 🔧 Usage

### Import Individual Components

```typescript
import FlightSearchForm from './helpers/booking/FlightSearchForm';
import ForexSearchForm from './helpers/travel-prep/ForexSearchForm';
import AttractionsResults from './helpers/attractions/AttractionsResults';
```

### Or Use Index Exports

```typescript
import { FlightSearchForm, HotelSearchForm } from './helpers/booking';
import { ForexSearchForm, VisaResults } from './helpers/travel-prep';
import { AttractionsSearchForm } from './helpers/attractions';
```

## 📝 Component Props

### Booking Search Forms

All booking search forms follow a similar pattern:

```typescript
interface SearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}
```

### Travel Prep Forms

```typescript
// Forex
interface ForexSearchFormProps {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  currencyOptions: string[];
  conversionResult: { converted: number; rate: number } | null;
  forexLoading: boolean;
  onFromCurrencyChange: (value: string) => void;
  onToCurrencyChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onSwapCurrencies: () => void;
  onSubmit: (e: FormEvent) => void;
}

// Visa
interface VisaSearchFormProps {
  visaQuery: string;
  visaLoading: boolean;
  onVisaQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}
```

### Attractions

```typescript
interface AttractionsSearchFormProps {
  searchQuery: string;
  showDropdown: boolean;
  suggestions: any[];
  searchingDropdown: boolean;
  currentLocationStr: string;
  onSearchQueryChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onSelectLocation: (prediction: any) => void;
  onSubmit: (e: FormEvent) => void;
}
```

## 🚀 Benefits of This Structure

1. **Separation of Concerns** - Each transport/service type has its own component
2. **Easy to Maintain** - Update one component without affecting others
3. **Reusable Components** - `SearchField` and `SelectField` shared across forms
4. **Scalable** - Easy to add new transport types or services
5. **Type-Safe** - All components properly typed with TypeScript
6. **Clean Imports** - Index files for convenient importing

## 🔄 Future Updates

To add a new booking type:

1. Create a new form component in `booking/` (e.g., `FerrySearchForm.tsx`)
2. Add the component to `booking/index.ts`
3. Import and use in `BookingHelper.tsx`

To add a new travel prep service:

1. Create form and results components in `travel-prep/`
2. Add to `travel-prep/index.ts`
3. Import and use in `TravelPrepHelper.tsx`

## 📦 Parent Components

These helpers are used by:

- `BookingHelper.tsx` - Main booking helper that switches between transport types
- `AttractionsHelper.tsx` - Main attractions helper
- `TravelPrepHelper.tsx` - Main travel prep helper that switches between forex/visa

---

**Last Updated:** 2024
**Version:** 1.0.0
