# Helper Components Architecture

## 🏗️ Component Hierarchy

```
PlannerWorkspace
│
├── BookingHelper (Main Container)
│   │
│   ├── Service Tabs (Flight | Hotel | Train | Bus | Cab)
│   │
│   ├── Search Forms (Conditional Rendering)
│   │   ├── FlightSearchForm
│   │   │   ├── SearchField (Trip type buttons)
│   │   │   ├── LocationAutocomplete (Origin)
│   │   │   ├── LocationAutocomplete (Destination)
│   │   │   ├── SearchField (Departure Date)
│   │   │   ├── SearchField (Return Date - conditional)
│   │   │   ├── SearchField (Travelers)
│   │   │   └── SelectField (Class)
│   │   │
│   │   ├── HotelSearchForm
│   │   │   ├── LocationAutocomplete (City)
│   │   │   ├── SearchField (Check-in)
│   │   │   ├── SearchField (Check-out)
│   │   │   ├── SearchField (Rooms)
│   │   │   └── SelectField (Guests)
│   │   │
│   │   ├── TrainSearchForm
│   │   │   ├── LocationAutocomplete (From Station)
│   │   │   ├── LocationAutocomplete (To Station)
│   │   │   ├── SearchField (Date)
│   │   │   ├── SelectField (Class)
│   │   │   └── SelectField (Quota)
│   │   │
│   │   ├── BusSearchForm
│   │   │   ├── LocationAutocomplete (From City)
│   │   │   ├── LocationAutocomplete (To City)
│   │   │   ├── SearchField (Date)
│   │   │   ├── SelectField (Seat Type)
│   │   │   └── SearchField (Passengers)
│   │   │
│   │   └── CabSearchForm
│   │       ├── SelectField (Cab Type)
│   │       ├── LocationAutocomplete (Pickup)
│   │       ├── LocationAutocomplete (Drop - conditional)
│   │       └── SearchField (Pickup Time)
│   │
│   └── BookingResults (Results Display)
│       └── SearchResults (Card List)
│
├── AttractionsHelper (Main Container)
│   │
│   ├── Filter Tabs (All | Sights | Food | Fun)
│   │
│   ├── AttractionsSearchForm
│   │   ├── SearchField (Location with Autocomplete)
│   │   └── Submit Button
│   │
│   └── AttractionsResults
│       ├── Loading State
│       ├── Empty State
│       └── PlaceCard List
│           └── DetailsModal (on click)
│
└── TravelPrepHelper (Main Container)
    │
    ├── Service Tabs (Forex | Visa)
    │
    ├── Search Forms (Conditional Rendering)
    │   ├── ForexSearchForm
    │   │   ├── SelectField (From Currency)
    │   │   ├── Swap Button
    │   │   ├── SelectField (To Currency)
    │   │   ├── SearchField (Amount)
    │   │   ├── Conversion Result (conditional)
    │   │   └── Submit Button
    │   │
    │   └── VisaSearchForm
    │       ├── SearchField (Country)
    │       └── Submit Button
    │
    └── Results (Conditional Rendering)
        ├── ForexResults
        │   ├── Loading State
        │   ├── Error State
        │   ├── Empty State
        │   └── VendorCard List
        │
        └── VisaResults
            ├── Loading State
            ├── Error State
            ├── Empty State
            └── VisaDetailsCard List
```

## 🔄 Data Flow

### Booking Helper Flow

```
User Action
    ↓
BookingHelper (State Management)
    ↓
[Switch Service Type] → Update params.service
    ↓
Render Appropriate Form Component
    ↓
User Fills Form → onUpdateParam(field, value)
    ↓
Update BookingSearchParams State
    ↓
Submit Form → validateParams() → search()
    ↓
BookingResults → Display SearchResults
```

### Attractions Helper Flow

```
User Action
    ↓
AttractionsHelper (State Management)
    ↓
[Filter Selection] → Update activeFilter
    ↓
AttractionsSearchForm
    ↓
User Types → onSearchQueryChange
    ↓
Debounce → Fetch Autocomplete Suggestions
    ↓
User Selects Location → onSelectLocation
    ↓
Submit → exploreLocation()
    ↓
AttractionsResults → Display Filtered Places
    ↓
Click Place → fetchDetails() → DetailsModal
```

### Travel Prep Helper Flow

```
User Action
    ↓
TravelPrepHelper (State Management)
    ↓
[Service Tab] → forex or visa
    ↓
Render Appropriate Form
    ↓
━━━ Forex Path ━━━
│   ForexSearchForm
│   User Inputs → Update State
│   Real-time Conversion (useEffect)
│   Submit → forexService.getVendors()
│   ForexResults → VendorCard List
│
━━━ Visa Path ━━━
    VisaSearchForm
    User Inputs → Update visaQuery
    Submit → visaService.searchVisaByCountry()
    VisaResults → VisaDetailsCard List
```

## 📦 Shared Components

### SearchField
Used by: All booking forms, travel prep forms
Purpose: Consistent text/date/number input with label and icon

### SelectField
Used by: All booking forms, travel prep forms
Purpose: Consistent dropdown select with label and icon

### LocationAutocomplete
Used by: Flight, Hotel, Train, Bus, Cab forms
Purpose: Location search with autocomplete (airports, cities, stations)

## 🎨 Styling Patterns

All components follow consistent design patterns:

- **Border**: `border border-[#ddd7ca]`
- **Background**: `bg-white` with `rounded-2xl`
- **Focus**: `focus-within:border-blue-500`
- **Labels**: `text-[10px] font-bold uppercase tracking-wider text-slate-500`
- **Values**: `text-sm font-semibold text-slate-800`
- **Buttons**: `rounded-2xl bg-slate-900 text-white hover:bg-slate-800`

## 🔑 Key Benefits

1. **Modularity**: Each service type is self-contained
2. **Maintainability**: Change one form without affecting others
3. **Consistency**: Shared components ensure uniform UX
4. **Scalability**: Easy to add new transport types
5. **Type Safety**: Full TypeScript typing throughout
6. **Testing**: Each component can be tested independently
7. **Code Reuse**: Shared fields reduce duplication
8. **Clear Separation**: Search logic separated from results display

## 🚀 Performance Considerations

- **Lazy Loading**: Forms only render when service is selected
- **Debouncing**: Autocomplete uses debounced search (300ms)
- **Memoization**: Results components can be memoized if needed
- **Code Splitting**: Each helper can be lazy loaded with Next.js dynamic imports

---

This structure allows for easy future updates and maintains clean separation of concerns while keeping the logic intact.
