# Canvas Update Pattern - Implementation Guide

## ✅ Completed Canvases
- FlightCanvas ✓
- HotelCanvas ✓

## 📋 Pattern to Follow for Remaining Canvases

### Common Structure for All Canvases

```typescript
// 1. State Setup
const [params, setParams] = useState(/* pre-filled data */);
const [isSearchExpanded, setIsSearchExpanded] = useState(false);
const [loading, setLoading] = useState(false);
const [results, setResults] = useState(mockResults);
const [selectedTags, setSelectedTags] = useState(['Tag1', 'Tag2']);

// 2. Collapsed Search Bar (Always Visible)
{!isSearchExpanded && (
  <div className="border-b border-slate-200 bg-slate-50 p-4">
    <button onClick={() => setIsSearchExpanded(true)} className="...">
      {/* Show summary of search params */}
      <div>Origin → Destination</div>
      <div>Date • Travelers • Class</div>
      <Edit2 icon />
    </button>
    
    {/* Quick Filter Tags */}
    <div className="mt-3">
      {recommendedTags.map(tag => (
        <button onClick={() => toggleTag(tag)}>
          {tag}
        </button>
      ))}
    </div>
  </div>
)}

// 3. Expanded Search Form (Conditional)
{isSearchExpanded && (
  <div className="border-b border-slate-200 bg-white p-4">
    <form onSubmit={handleSearch}>
      <SearchForm params={params} onUpdateParam={updateParam} />
      <button type="submit">Update Search</button>
    </form>
  </div>
)}

// 4. Results Section
<div className="p-4">
  {loading ? <LoadingState /> : <ResultsList />}
</div>
```

### Pre-filled Data Examples

**Train:**
```typescript
origin: 'New Delhi (NDLS)',
destination: 'Mumbai Central (MMCT)',
departureDate: '2024-03-15',
trainClass: '3A'
```

**Bus:**
```typescript
origin: 'Delhi (Kashmiri Gate)',
destination: 'Mumbai (Dadar)',
departureDate: '2024-03-15'
```

**Cab:**
```typescript
pickup: 'Delhi Airport T3',
cabType: 'airport'
```

**Attractions:**
```typescript
currentLocation: 'Tokyo, Japan'
```

**Forex:**
```typescript
fromCurrency: 'INR',
toCurrency: 'USD',
amount: 50000
```

**Visa:**
```typescript
destination: 'Japan'
```

### Recommended Tags by Service

**Train:** `['AC Class', 'Morning', 'Rajdhani', 'Tatkal', 'Confirmed']`
**Bus:** `['AC Sleeper', 'Evening', 'WiFi', 'Volvo', 'Top Rated']`
**Cab:** `['Sedan', 'AC', 'GPS', 'Instant', 'Top Driver']`
**Attractions:** `['Museums', 'Temples', 'Food', 'Shopping', 'Nightlife']`
**Forex:** `['Best Rate', 'Near Me', 'No Commission', 'Instant', 'Verified']`
**Visa:** `['Tourist', 'Business', 'E-Visa', 'Fast Track', 'On Arrival']`

### Color Schemes

```css
Flight:   bg-blue-600, border-blue-300, text-blue-600
Hotel:    bg-purple-600, border-purple-300, text-purple-600
Train:    bg-emerald-600, border-emerald-300, text-emerald-600
Bus:      bg-orange-600, border-orange-300, text-orange-600
Cab:      bg-yellow-600, border-yellow-300, text-yellow-600
Attractions: bg-rose-600, border-rose-300, text-rose-600
Forex:    bg-cyan-600, border-cyan-300, text-cyan-600
Visa:     bg-indigo-600, border-indigo-300, text-indigo-600
```

### Mock Data Location

All mock data files created:
- `mockFlightData.ts` ✓
- `mockHotelData.ts` ✓
- `mockTransportData.ts` ✓ (contains train, bus, cab data)

Create additional mock data files:
- `mockAttractionsData.ts` (places/activities)
- `mockForexData.ts` (vendors/rates)
- `mockVisaData.ts` (requirements/documents)

### Result Card Pattern

**Common Structure:**
```typescript
<div className="rounded-xl border p-4 hover:border-{color}-300">
  <div className="flex justify-between">
    <div className="flex-1">
      {/* Main Info */}
      <h3>Name/Number</h3>
      <p>Details</p>
      
      {/* Timeline/Route */}
      <div className="flex items-center gap-3">
        <div>Departure</div>
        <div>---Duration---</div>
        <div>Arrival</div>
      </div>
      
      {/* Features/Amenities */}
      <div className="flex gap-2">
        {features.map(f => <span>{f}</span>)}
      </div>
    </div>
    
    <div className="text-right">
      <p className="text-xl font-bold">₹{price}</p>
      <button>Select</button>
    </div>
  </div>
</div>
```

## 🚀 Quick Implementation Steps

1. **Import mock data at top:**
   ```typescript
   import { mockResults } from './mockDataFile';
   ```

2. **Set pre-filled initial params**

3. **Add tag state and toggle function**

4. **Replace search form with collapsible pattern**

5. **Update results display with mock data**

6. **Style with service-specific colors**

## 📝 Notes

- All canvases follow the same UX pattern
- Search collapsed by default
- Tags for quick filtering
- Mock data shows realistic results
- Edit button expands search
- Update button collapses search
- 600px side panel width
- Service-specific branding colors

---

**Status:**
- ✅ FlightCanvas - Complete with mock data
- ✅ HotelCanvas - Complete with mock data
- ⏳ TrainCanvas - Need to update (mock data ready)
- ⏳ BusCanvas - Need to update (mock data ready)
- ⏳ CabCanvas - Need to update (mock data ready)
- ⏳ AttractionsCanvas - Need to update (need mock data)
- ⏳ ForexCanvas - Need to update (need mock data)
- ⏳ VisaCanvas - Need to update (need mock data)
