# Separate Canvas UI - Implementation Guide

## ✨ Overview

Each helper now has its own **dedicated full-screen canvas** with unique branding and UI. When you click on flight, hotel, train, bus, cab, attractions, forex, or visa - each opens in a separate, beautifully designed canvas.

## 🎨 Canvas Features

### Individual Branding
Each canvas has:
- **Unique color scheme** (Flight: Blue, Hotel: Purple, Train: Emerald, Bus: Orange, Cab: Yellow, Attractions: Rose, Forex: Cyan, Visa: Indigo)
- **Custom hero section** with gradient backgrounds
- **Service-specific icons** and messaging
- **Branded animations** and effects

### Full-Screen Experience
- Takes over the entire workspace
- Smooth slide-in animation from right
- Close button returns to planner
- No more small sidebar panels

### Rich UI Components
- **Hero banners** with gradients and shadows
- **Live status indicators** (real-time pricing, availability)
- **Filter options** for results
- **Empty states** with helpful messaging
- **Loading states** with branded spinners

## 📁 Canvas Structure

```
helpers/
├── booking/
│   └── canvas/
│       ├── FlightCanvas.tsx    🔵 Blue gradient
│       ├── HotelCanvas.tsx     🟣 Purple gradient
│       ├── TrainCanvas.tsx     🟢 Emerald gradient
│       ├── BusCanvas.tsx       🟠 Orange gradient
│       ├── CabCanvas.tsx       🟡 Yellow gradient
│       └── index.ts
│
├── attractions/
│   └── canvas/
│       ├── AttractionsCanvas.tsx 🌹 Rose gradient
│       └── index.ts
│
└── travel-prep/
    └── canvas/
        ├── ForexCanvas.tsx     🔷 Cyan gradient
        ├── VisaCanvas.tsx      🟪 Indigo gradient
        └── index.ts
```

## 🎯 How It Works

### Before (Small Sidebar)
```
┌─────────────────────┬──────────┐
│                     │ Flight   │
│   Planner Canvas    │ Search   │
│                     │ (440px)  │
└─────────────────────┴──────────┘
```

### After (Full Screen Canvas)
```
┌─────────────────────────────────┐
│                                 │
│       Flight Canvas             │
│       (Full Screen)             │
│                                 │
└─────────────────────────────────┘
```

## 🚀 Usage

### Opening a Canvas

Click any item in the planner:
```typescript
// Flight item clicked
setActivePanel('flight')  // Opens FlightCanvas

// Hotel item clicked
setActivePanel('hotel')   // Opens HotelCanvas

// Attractions clicked
setActivePanel('attractions') // Opens AttractionsCanvas
```

### Closing a Canvas

Click the X button or use the onClose callback:
```typescript
<FlightCanvas onClose={() => setActivePanel('none')} />
```

## 🎨 Canvas Anatomy

### FlightCanvas Example

```tsx
<FlightCanvas>
  ├── Header (Sticky)
  │   ├── Icon + Title
  │   └── Close Button
  │
  ├── Hero Section
  │   ├── Blue Gradient Background
  │   ├── Tagline
  │   └── Description
  │
  ├── Search Form
  │   ├── Form Title
  │   ├── Live Status Indicator
  │   ├── FlightSearchForm Component
  │   └── Submit Button (Gradient)
  │
  └── Results Section
      ├── Loading State (Blue Spinner)
      ├── Results List with Filters
      └── Empty State
</FlightCanvas>
```

## 🎨 Color Schemes

### Flight Canvas 🔵
- Primary: `from-blue-600 to-indigo-600`
- Border: `border-blue-100`
- Shadow: `shadow-blue-500/30`

### Hotel Canvas 🟣
- Primary: `from-purple-600 to-pink-600`
- Border: `border-purple-100`
- Shadow: `shadow-purple-500/30`

### Train Canvas 🟢
- Primary: `from-emerald-600 to-teal-600`
- Border: `border-emerald-100`
- Shadow: `shadow-emerald-500/30`

### Bus Canvas 🟠
- Primary: `from-orange-600 to-amber-600`
- Border: `border-orange-100`
- Shadow: `shadow-orange-500/30`

### Cab Canvas 🟡
- Primary: `from-yellow-600 to-amber-600`
- Border: `border-yellow-100`
- Shadow: `shadow-yellow-500/30`

### Attractions Canvas 🌹
- Primary: `from-rose-600 to-pink-600`
- Border: `border-rose-100`
- Shadow: `shadow-rose-500/30`

### Forex Canvas 🔷
- Primary: `from-cyan-600 to-blue-600`
- Border: `border-cyan-100`
- Shadow: `shadow-cyan-500/30`

### Visa Canvas 🟪
- Primary: `from-indigo-600 to-violet-600`
- Border: `border-indigo-100`
- Shadow: `shadow-indigo-500/30`

## ✨ Special Features

### FlightCanvas
- Trip type toggle (one-way/round-trip)
- Class selection (Economy, Business, First)
- Real-time pricing indicator
- Cheapest/Fastest sorting

### HotelCanvas
- Star ratings in hero
- Check-in/out date selection
- Room and guest configuration
- Price/Rating sorting

### TrainCanvas
- IRCTC integration messaging
- Class selection (SL, 3A, 2A, 1A, etc.)
- Quota selection (General, Tatkal, Ladies)
- Live seat availability indicator

### BusCanvas
- Seat type selection (Sleeper, AC, Seater)
- Live seat selection indicator
- Comfortable journey messaging

### CabCanvas
- Cab type (Airport, Outstation, Hourly)
- Instant confirmation badge
- Multiple provider rates

### AttractionsCanvas
- Filter tabs (All, Sights, Food, Fun)
- Location autocomplete
- Place details modal
- Curated recommendations

### ForexCanvas
- Currency swap button
- Real-time conversion display
- Live exchange rates
- Vendor comparison

### VisaCanvas
- Popular destinations quick select
- Requirements checklist
- Processing time info
- Document list

## 🔄 Animation

### Entry Animation
```typescript
initial={{ x: '100%', opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
transition={{ type: 'spring', stiffness: 300, damping: 30 }}
```

Canvas slides in from right with spring physics.

### Exit Animation
```typescript
exit={{ x: '100%', opacity: 0 }}
```

Canvas slides out to right when closed.

## 📱 Responsive Design

All canvases are responsive:
- Mobile: Full width, vertical scroll
- Tablet: Optimized padding and spacing
- Desktop: Max-width container (4xl)

## 🎯 Benefits

### User Experience
✅ Immersive full-screen experience
✅ Clear focus on one task at a time
✅ Beautiful branded UI for each service
✅ Smooth animations and transitions
✅ Consistent interaction patterns

### Developer Experience
✅ Each canvas is independent
✅ Easy to update individual services
✅ Reusable form components
✅ Clear separation of concerns
✅ Type-safe with TypeScript

### Maintainability
✅ One file per canvas
✅ Consistent structure across all canvases
✅ Easy to add new transport types
✅ Shared form components reduce duplication
✅ Clear naming conventions

## 🔧 Customization

### Adding a New Canvas

1. **Create the canvas file:**
```tsx
// helpers/booking/canvas/FerryCanvas.tsx
export default function FerryCanvas({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Your UI here */}
    </div>
  );
}
```

2. **Export in index.ts:**
```tsx
export { default as FerryCanvas } from './FerryCanvas';
```

3. **Add to PlannerWorkspace:**
```tsx
import { FerryCanvas } from './helpers/booking/canvas';

{activePanel === 'ferry' && <FerryCanvas onClose={() => setActivePanel('none')} />}
```

### Modifying Existing Canvas

Edit the specific canvas file:
```tsx
// helpers/booking/canvas/FlightCanvas.tsx
// All flight-specific UI is here
```

## 🎨 Design Patterns

### Hero Section Pattern
```tsx
<div className="rounded-3xl border bg-gradient-to-br p-8 text-white shadow-xl">
  <div className="mb-4 flex items-center gap-2">
    <Icon />
    <span className="text-xs font-bold uppercase">Tagline</span>
  </div>
  <h1 className="mb-3 text-3xl font-bold">Title</h1>
  <p className="text-sm">Description</p>
</div>
```

### Loading State Pattern
```tsx
<div className="flex flex-col items-center justify-center rounded-3xl bg-white p-12">
  <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4" />
  <p className="text-sm font-semibold">Loading message...</p>
  <p className="mt-1 text-xs text-slate-400">Sub-message</p>
</div>
```

### Empty State Pattern
```tsx
<div className="rounded-3xl bg-white p-12 text-center">
  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
    <Icon size={32} className="text-slate-400" />
  </div>
  <h3 className="mb-2 text-lg font-semibold">Title</h3>
  <p className="text-sm text-slate-500">Message</p>
</div>
```

## 📊 Comparison

| Feature | Old Sidebar | New Canvas |
|---------|------------|------------|
| Size | 440px fixed | Full screen |
| Branding | Generic | Service-specific |
| Animation | Width expand | Slide in |
| Focus | Shared view | Dedicated |
| Scroll | Limited | Unlimited |
| Mobile | Cramped | Optimized |

---

**Your planner now has beautiful, dedicated canvases for each service! 🎉**
