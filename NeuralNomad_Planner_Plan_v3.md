# NeuralNomad AI Planner — Architecture & Implementation Plan (v3)
> Fully updated from UI mockup images. All canvases designed. Layout corrected.

---

## Architectural Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Single Responsibility** | Each module does exactly one thing |
| 2 | **Event Driven** | Modules communicate through workspace events, never directly |
| 3 | **Plugin Based** | Execution canvases are plugins — register without modifying the engine |
| 4 | **AI Agnostic** | AI providers only generate commands. The Planner Engine executes them |
| 5 | **Database First** | Store knowledge locally. Avoid unnecessary API calls |
| 6 | **API Second** | Use APIs only for live information (prices, availability, weather) |
| 7 | **Reusable Components** | StandardCanvas, CanvasHeader, ResultCard are shared, not duplicated |
| 8 | **Incremental Loading** | Load canvases lazily, fetch data on demand |
| 9 | **Workspace Persistence** | Every workspace state is persisted — user can leave and resume |
| 10 | **Offline Friendly** | Reference data cached client-side for fast searches |
| 11 | **Production Ready** | Error handling, loading states, edge cases from day one |
| 12 | **Right Slot Pattern** | One dynamic right slot — Info Panel / Canvas / AI Chat — never all at once |

---

## 1. Product Understanding

NeuralNomad Planner is an **AI-powered Travel Workspace** — not a chatbot.
The Plan Canvas is the heart. The AI chat is contextual (a drawer, not a panel).
Execution canvases open in the right slot when the user clicks a timeline item.

### Core Separation: Intelligence vs Execution

```
User
  ↓
AI Chat (language understanding only — right slot drawer)
  ↓
Planner Engine (the brain — all intelligence lives here)
  ↓
Plan Canvas (visual representation — always center)
  ↓
Right Slot (Info Panel → Execution Canvas → AI Chat — one at a time)
```

### What the Images Confirmed

| Image | What it Shows |
|-------|---------------|
| **Image 1** | Plan Canvas + 4 annotated helper canvases (Flight/Hotel/Restaurant). Clicking an item in the timeline opens its canvas in the right slot |
| **Image 2** | Plan Canvas + AI Assistant chat drawer (right slot, triggered by top bar button). Chat has quick actions, message bubbles, and action buttons |
| **Image 3** | Full layout — icon sidebar (left, thin) + Plan Canvas (center) + Right Info Panel (default right slot: Map + AI Insights + Trip Summary + Quick Add). Inline expanded item card visible |

### Key Layout Correction from Images

The original v2 plan had a **3-panel layout** (Sidebar 18% + Chat 32% + Workspace 50%).
The images show a fundamentally different layout:

```
❌ v2: [Wide Sidebar] [Persistent Chat] [Workspace]
✅ v3: [Icon Bar] [Plan Canvas] [Right Slot: switches between 3 states]
```

The AI chat is **NOT a persistent panel**. It is a right-slot overlay toggled from the top bar.

---

## 2. UI Layout Architecture

### Two Sidebar Modes (Both shown in images)

**Mode A — Labeled Sidebar** (Images 1 & 2, sidebar expanded)
```
┌────────────────┬─────────────────────────────┬──────────────────────────┐
│  Sidebar 180px │   Plan Canvas (flexible)    │  Right Slot 380px        │
│                │                             │                          │
│  🌍 NeuralNomad│  PRE-JOURNEY CHECKLIST      │  [Info Panel]            │
│  + New Trip    │  ━━━━━━━━━━━━━━━━━━━━━━━━━  │  or                      │
│  ─────────────│  TOKYO  3N · Oct 01–04 · ☀️ │  [Execution Canvas]      │
│  🏠 Home       │    Day 1 → timeline items   │  or                      │
│  ✈️ Trips      │    Day 2 → timeline items   │  [AI Chat Panel]         │
│  📋 Planner    │                             │                          │
│  🎫 Bookings   │  JOURNEY: Tokyo → Kyoto     │                          │
│  💰 Wallet     │                             │                          │
│  📄 Documents  │  KYOTO  2N · Oct 04–06      │                          │
│  ─────────────│    Day 4 → timeline items   │                          │
│  ✦ AI Assistant│                             │                          │
│  👤 Yash       │                             │                          │
└────────────────┴─────────────────────────────┴──────────────────────────┘
```

**Mode B — Icon-Only Sidebar** (Image 3, sidebar collapsed)
```
┌────┬──────────────────────────────────────────┬─────────────────────────┐
│ 60 │          Plan Canvas (flexible)          │  Right Info Panel 320px │
│    │                                          │                         │
│ 🌍 │  TOP BAR: Title | Meta | Actions         │  ┌─────────────────┐   │
│ ─  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │  │  MAP (route)    │   │
│ 📋 │  PRE-JOURNEY CHECKLIST                   │  └─────────────────┘   │
│ ✈️ │                                          │  AI Trip Insights       │
│ 🏨 │  TOKYO  3N · Oct 01–04 · 22°C           │  ─────────────────────  │
│ 🗺️ │    [timeline items]                      │  Trip Summary           │
│ 📷 │                                          │  ─────────────────────  │
│ 🚕 │  KYOTO  2N · Oct 04–06                   │  Quick Add              │
│ 📄 │    [timeline items]                      │                         │
│ ─  │                                          │  💡 Drag & drop tip     │
│ ⚙️ │                                          │                         │
└────┴──────────────────────────────────────────┴─────────────────────────┘
```

### Right Slot — 3 States

The right slot is a single area that renders one of three things:

```
RIGHT SLOT STATE MACHINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFAULT (on load)
  → Right Info Panel (Map + AI Insights + Summary + Quick Add)

TRIGGER: Click timeline item (Flight/Hotel/Restaurant/Activity etc.)
  → Execution Canvas for that item type
  → Back arrow returns to Info Panel

TRIGGER: Click "AI Assistant" in top bar
  → AI Chat Panel slides in from right
  → X button or clicking away returns to Info Panel

TRIGGER: Click Quick Add button (Flight / Hotel / Activity etc.)
  → Corresponding Execution Canvas opens in empty search state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Top Bar (from Images 2 & 3)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🌍  Japan Autumn Journey ▾   7 Days · 3 Cities · ₹1,75,000 · 2 Travelers│
│                                                                         │
│              ✦ AI Assistant  ↺  ↻  Share  Export  [Book Journey]  🔍 ⋮ │
└─────────────────────────────────────────────────────────────────────────┘
```

Components: `TripTitle (editable)` | `TripMeta` | `AIAssistantButton` | `UndoRedo` | `ShareButton` | `ExportButton` | `BookJourneyCTA` | `SearchButton` | `MoreMenu`

---

## 3. Design System

### Color Palette

```
Background:  #FAFAFA  (warm white — base)
Surface:     #FFFFFF  (cards, panels)
Border:      #F0F0F0  (subtle dividers)
Text:        #111827  (primary)
Text Muted:  #6B7280  (secondary)
Text Light:  #9CA3AF  (timestamps, captions)

Sidebar:     #1A1A2E  (deep navy)
Sidebar Text:#E2E8F0
Sidebar Sel: #6366F1  (indigo selected state)

Success:     #10B981  (confirmed, completed)
Warning:     #F59E0B  (pending, in progress)
Error:       #EF4444  (conflicts, errors)
```

### Canvas Accent Colors

| Canvas | Accent | Hex | Icon Circle Color |
|--------|--------|-----|-------------------|
| Planner / AI | Indigo | `#6366F1` | `bg-indigo-500` |
| Flight | Royal Blue | `#2563EB` | `bg-blue-500` |
| Hotel | Orchid Purple | `#9333EA` | `bg-purple-600` |
| Train | Burnt Orange | `#EA580C` | `bg-orange-600` |
| Bus | Amber | `#D97706` | `bg-amber-600` |
| Cab / Taxi | Emerald | `#059669` | `bg-emerald-500` |
| Attractions | Coral Orange | `#F97316` | `bg-orange-500` |
| Activities | Teal | `#0D9488` | `bg-teal-600` |
| Restaurant | Rose | `#F43F5E` | `bg-rose-500` |
| Visa | Indigo Dark | `#4338CA` | `bg-indigo-700` |
| Forex | Mint Green | `#6EE7B7` | `bg-emerald-300` |
| Booking | Blue→Purple | gradient | `bg-gradient` |
| Camera / Photo | Teal Light | `#14B8A6` | `bg-teal-500` |

### Typography

```
Display:  Inter 700 — trip titles, city names
Heading:  Inter 600 — section headers, canvas titles
Body:     Inter 400 — timeline content, descriptions
Caption:  Inter 400 — timestamps, subtitles, meta
AI Tip:   Inter 500 — canvas accent color text
Price:    Inter 600 — right-aligned, prominent
```

### Spacing Scale

```
Timeline row padding:    py-3
Timeline icon size:      32×32px (w-8 h-8)
Timeline time column:    56px (w-14)
Card border radius:      12px (rounded-xl)
Canvas result card:      rounded-2xl
Sidebar width:           180px expanded / 60px collapsed
Right slot width:        380px canvas / 320px info panel
```

---

## 4. Plan Canvas — Complete Design

### Pre-Journey Checklist (top of canvas, from all images)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PRE-JOURNEY CHECKLIST ▾                        + Add Task
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅ Passport    ✅ eVisa    ⏳ Forex    ✅ Insurance    ⏳ eSIM
   Completed     Completed   Pending     Completed     Pending
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Each pill: `icon + label + status text`. Status: green=completed, amber=pending, gray=not started. Collapsible. Click pill → opens relevant canvas (Forex pill → ForexCanvas).

### City Section Header

```
🔴 TOKYO            3 Nights · Oct 01 – Oct 04 · 22°C ☀️        ↑ Collapse  ⋮
```

City icon circle color matches destination (configurable). Weather pulled from WeatherNormals reference. Collapse hides all days for that city.

### Timeline Item Row (from Image 3 — exact design)

```
08:20  ┌──────────────────────────────────────────────────────────────┐
   ✈️  │ Flight                                              ₹52,000  │
18:30  │ Indigo AI 302 · DEL → HND · Non-stop  [Economy]   Confirmed │
       │ AI Tip: Cheapest direct flight today                     ⋮   │
       └──────────────────────────────────────────────────────────────┘
       │ (vertical line connecting to next item)
19:15  ┌──────────────────────────────────────────────────────────────┐
   🚕  │ Taxi to Hotel                                       ₹4,200   │
20:00  │ 28 km · 45 min                                    Confirmed  │
       │ AI Tip: Avoid expressway after 6PM                      ⋮   │
       └──────────────────────────────────────────────────────────────┘
```

**Anatomy of a timeline item:**
- Left: time column (start / end, 56px wide, right-aligned)
- Center-left: colored circle icon (32px, category color)
- Center: vertical connector line (CSS border-left on the icon column)
- Right card: Title + meta details + AI Tip (accent color) + Price + Status + ⋮
- Card hover: subtle border color + shadow
- Card click: inline expansion (see below)

### Inline Expanded Item (Image 3 — Aman Tokyo hotel)

```
20:00  ┌──────────────────────────────────────────────────────────────┐
   🏨  │  ┌────────────┐  Aman Tokyo  ★★★★★         ₹42,000 / night  │
       │  │  [Photo]   │  Otemachi · 0.5 km from Tokyo Station        │
       │  │            │  Breakfast included · Check-in 3:00 PM        │
       │  └────────────┘  AI Pick: Luxury + Best Location     📍 🔖   │
       │  ──────────────────────────────────────────────────────────── │
       │  [↺ Replace]  [⚖ Compare]  [📝 Notes]  [🗑 Remove]          │
       └──────────────────────────────────────────────────────────────┘
```

Expanded card: shows photo thumbnail (left), full details (right), action row at bottom.
Actions: `Replace` → opens canvas in search mode | `Compare` → opens canvas in compare mode | `Notes` → inline note input | `Remove` → removes from timeline with undo toast.

### Inter-City Journey Card

```
       ┌──────────────────────────────────────────────────────────────┐
  🚅   │  ┌──────────┐  Journey to Kyoto                  ₹13,320    │
       │  │ [Mt Fuji]│  Shinkansen Nozomi · 513 km · 2h 18m          │
       │  │  photo   │  Reserved Seat · Mount Fuji View          📖 ⋮ │
       └──────────────────────────────────────────────────────────────┘
```

### Day Header

```
Day 1  Oct 01                   Arrival in Tokyo
```

Subtle, minimal. No heavy card — just a row that groups items below it.

### Add Activity Button

```
                    + Add Activity
```

Centered, ghost button. Click → opens QuickAdd modal with category options.

---

## 5. Right Info Panel — Default State (Image 3)

This is the default right slot content when no canvas or chat is active.

```
┌─────────────────────────────────────────────┐
│           MAP VIEW                          │
│  ┌─────────────────────────────────────┐    │
│  │  [Route map: Tokyo→Kyoto→Osaka]     │    │
│  │   🔴 Tokyo                          │    │
│  │         ……………………                   │    │
│  │                    🟡 Kyoto         │    │
│  │                         ………        │    │
│  │                              🟢 Osaka│   │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  ✦ AI Trip Insights  +                      │
│  ─────────────────────────────────────────  │
│  🌧 Rain expected on Oct 03          [View] │
│     Consider indoor activities              │
│  ─────────────────────────────────────────  │
│  🌅 Best time: Arashiyama 7–9 AM    [View] │
│     Early morning visit recommended         │
│  ─────────────────────────────────────────  │
│  📉 Price drop alert                [View] │
│     Hotels in Kyoto decreased 10%           │
├─────────────────────────────────────────────┤
│  Trip Summary                               │
│  ─────────────────────────────────────────  │
│  Total Days          7 Days                 │
│  Total Budget        ₹1,75,000              │
│  Spent               ₹48,200                │
│  Remaining           ₹1,26,800              │
│  ████████░░░░░░░░░░░░░░░  27%              │
├─────────────────────────────────────────────┤
│  Quick Add                                  │
│  ─────────────────────────────────────────  │
│  [✈ Flight]     [🏨 Hotel]                │
│  [⚡ Activity]  [🍽 Restaurant]            │
│  [🚕 Transport] [📝 Note]                 │
├─────────────────────────────────────────────┤
│  💡 Tip: Drag & drop to reorder activities ✕│
└─────────────────────────────────────────────┘
```

---

## 6. AI Chat Panel (Image 2)

Triggered by "AI Assistant" button in top bar. Slides in as right slot.

```
┌─────────────────────────────────────────────┐
│  ✦ AI Assistant          Your AI Travel...✕ │
├─────────────────────────────────────────────┤
│  Hi Yash! 👋                                │
│  How can I help you plan your Japan trip?   │
│  ─────────────────────────────────────────  │
│  [✦ Optimize itinerary] [🍜 Best restaurants]│
│  [💰 Budget analysis]  [☁️ Weather forecast] │
│  [+ Add a day]         [··· More suggestions]│
├─────────────────────────────────────────────┤
│                                             │
│          [Is Day 2 in Tokyo too busy?] 10:30│
│                                             │
│  Yes, Day 2 looks a bit packed.             │
│  You have 5 activities and 2 long commutes. │
│                                             │
│  I recommend:                               │
│  • Move Akihabara to Day 3 morning          │
│  • Add a break after Senso-ji Temple        │
│  • Visit teamLab in the evening             │
│                                             │
│  Shall I update the plan for you?   10:31   │
│  ─────────────────────────────────────────  │
│  [✦ Update Plan]   [Show Alternatives]      │
│  ─────────────────────────────────────────  │
│          [Yes, update the plan]      10:32  │
│  ─────────────────────────────────────────  │
│  ✅ Day 2 has been optimized!       10:32   │
│  [View Updated Plan]                        │
│                                             │
├─────────────────────────────────────────────┤
│  Ask me anything...            📎  🎤  ➤   │
│  ⓘ AI suggestions based on preferences     │
└─────────────────────────────────────────────┘
```

**Chat Widget Types** (rendered inside messages):
- `text` — plain AI response
- `quick_actions` — horizontal button row (Optimize / Budget / Weather)
- `update_plan_card` — "Update Plan" + "Show Alternatives" action buttons
- `confirmation_card` — "✅ Day 2 has been optimized!" with CTA
- `recommendation_card` — flight/hotel suggestion with "Add to Trip"
- `date_picker` — calendar widget for date selection
- `budget_slider` — slider with Budget/Mid-range/Luxury presets
- `traveler_selector` — +/- adults/children/infants
- `destination_card` — city photo + weather + best time
- `checklist` — multi-select preferences

---

## 7. All Canvas Designs

### Canvas Header Pattern (shared by all execution canvases)

```
┌─────────────────────────────────────────────────────────────────┐
│  ←  [Canvas Type Icon]  [Title + Context]         🗺 Map  Filters│
└─────────────────────────────────────────────────────────────────┘
```

Back arrow → returns to Info Panel. Context shows trip-specific info pre-filled from AI command.

---

### 7.1 Flight Canvas (Royal Blue `#2563EB`)
*Observed in Image 1*

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← ✈ Flight  DEL → HND    Wed, 01 Oct · 1 Traveler · Economy  Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mon 29 Sep   Tue 30 Sep  [Wed 01 Oct]  Thu 02 Oct  Fri 03 Oct  ›
   ₹48,200      ₹46,800    ₹52,000 ★     ₹49,100     ₹51,300
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ★ Best Value
  ┌───────────────────────────────────────────────────────────┐
  │  ✈ Indigo AI 302     08:20 DEL → 18:30 HND    ₹52,000   │
  │  Non-stop · 7h 40m                          [View Details]│
  │  AI Pick: Best value for money                            │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ✈ Air India AI 720  09:15 DEL → 19:40 HND   ₹54,300   │
  │  Non-stop · 7h 55m                          [View Details]│
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ✈ ANA NH 837        10:30 DEL → 21:10 HND   ₹61,200   │
  │  Non-stop · 7h 10m                          [View Details]│
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**View Details** → expands card inline showing: seat map preview, baggage policy, cancellation policy, `[Add to Trip]` button.

---

### 7.2 Hotel Canvas (Orchid Purple `#9333EA`)
*Observed in Image 1*

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🏨 Hotel  Tokyo · Oct 01–04 · 3 Nights · 1 Room · 2 Guests  🗺 Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [Recommended]  [Price: Low→High]  [Price: High→Low]  [Distance]  [Top Reviewed]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Aman Tokyo  ★★★★★                ₹42,000 │
  │  │  [Photo] │  Otemachi · 0.5 km from Tokyo Station /night│
  │  │          │  Breakfast included                          │
  │  └──────────┘  AI Pick: Luxury + Best Location [View Det.]│
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  The Ritz-Carlton Tokyo  ★★★★★   ₹38,500 │
  │  │  [Photo] │  Roppongi · 2.1 km from Tokyo Station  /night│
  │  │          │  Breakfast included  ★4.7 (382 reviews)      │
  │  └──────────┘                               [View Details] │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Mitsui Garden Hotel  ★★★★       ₹16,800 │
  │  │  [Photo] │  Ginza · 1.2 km from Tokyo Station     /night│
  │  │          │  Breakfast available  ★4.3 (812 reviews)     │
  │  └──────────┘                               [View Details] │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 7.3 Restaurant Canvas (Rose `#F43F5E`)
*Observed in Image 1*

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🍽 Restaurant  Tokyo · Oct 01 · Dinner · 2 Guests       🗺 Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [Recommended]  [Top Rated]  [Price: Low→High]  [Distance]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Sukiyabashi Jiro  ★4.8          [Reserve] │
  │  │  [Photo] │  Sushi · Reservation Required · $$$$        │
  │  │          │  AI Tip: World famous Omakase experience     │
  │  └──────────┘                                             │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Torisho Yakitori  ★4.6          [Reserve] │
  │  │  [Photo] │  Yakitori · 500m · ₹2,500 per person       │
  │  │          │  AI Tip: Best yakitori in Shinjuku           │
  │  └──────────┘                                             │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Ichiran Ramen  ★4.5             [Reserve] │
  │  │  [Photo] │  Ramen · Multiple Locations · ₹1,200/person │
  │  │          │  AI Tip: Famous solo dining booths           │
  │  └──────────┘                                             │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 7.4 Train Canvas (Burnt Orange `#EA580C`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🚅 Train  Tokyo → Kyoto  Wed, 04 Oct · 2 Passengers      Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Class: [All]  [Green Car]  [Ordinary Reserved]  [Unreserved]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  🚅 Nozomi 203             ★ AI Pick: Mount Fuji View    │
  │  Tokyo  07:00 ────── 09:18  Kyoto      2h 18m  Non-stop  │
  │  Reserved · Ordinary   ¥13,320 (₹7,300)    [Book Seats]  │
  │  AI Tip: Right side seats for Mt Fuji view               │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  🚅 Hikari 505                                           │
  │  Tokyo  08:30 ────── 11:10  Kyoto      2h 40m  1 stop   │
  │  Reserved · Ordinary   ¥13,320 (₹7,300)    [Book Seats]  │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  🚅 Nozomi 211                                           │
  │  Tokyo  10:00 ────── 12:18  Kyoto      2h 18m  Non-stop  │
  │  Green Car   ¥22,080 (₹12,100)             [Book Seats]  │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 JR Pass holders travel free on Nozomi in unreserved cars
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 7.5 Bus Canvas (Amber `#D97706`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🚌 Bus  Kolkata → Digha  Sat, 12 Oct · 2 Passengers      Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Type: [All]  [AC Sleeper]  [AC Seater]  [Non-AC]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  WBTC Volvo  ★4.2                     ★ AI Pick          │
  │  20:00 Esplanade ──────────────────── 23:30 Digha Bus    │
  │  AC Sleeper · 3h 30m · 14 seats left   ₹380  [Select]   │
  │  Pickup: Esplanade · Drop: Digha Bus Stand               │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  Greenline Travels  ★3.9                                 │
  │  19:30 Babughat ───────────────────── 23:00 Digha        │
  │  AC Seater · 3h 30m · 22 seats left   ₹250   [Select]   │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  Shyamali Travels  ★3.7                                  │
  │  21:00 Howrah ─────────────────────── 00:30 Digha        │
  │  Non-AC Sleeper · 3h 30m · 8 left      ₹180  [Select]   │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Clicking `[Select]` → opens seat map overlay for seat selection.

---

### 7.6 Cab / Taxi Canvas (Emerald `#059669`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🚕 Cab  Haneda Airport → Aman Tokyo  Wed, 01 Oct · 18:30
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📍 From: Haneda Airport (HND)
  📍 To: Aman Tokyo, Otemachi                    28 km · 45 min
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │  ECONOMY  │  │  COMFORT  │  │    SUV    │  │  PREMIUM  │
  │   🚗      │  │    🚙     │  │    🚐    │  │    🚘    │
  │  4 seats  │  │  4 seats  │  │  6 seats │  │  4 seats  │
  │  ₹2,800   │  │  ₹3,800   │  │  ₹5,200  │  │  ₹7,500   │
  │  ~40 min  │  │  ~40 min  │  │  ~45 min │  │  ~38 min  │
  │  [Select] │  │ ★ Pick   │  │  [Select] │  │  [Select] │
  └───────────┘  └───────────┘  └───────────┘  └───────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🟢 Limousine Bus: ₹1,200 · 75 min · Direct to major hotels
  🚇 Airport Express: ₹310 · 30 min · Change at Hamamatsuchō
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡 AI Tip: Avoid expressway after 6PM — use local roads
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Also shows alternative transport (bus, metro) with cost comparison. The AI pick is pre-highlighted.

---

### 7.7 Attraction Canvas (Coral Orange `#F97316`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🏯 Attractions  Tokyo · Oct 02 · 2 Travelers           🗺 Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [All]  [Temples]  [Museums]  [Parks]  [Shopping]  [Viewpoints]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Senso-ji Temple  ★4.8                     │
  │  │  [Photo] │  Asakusa · Temple · Free Entry              │
  │  │          │  Duration: 1–2 hrs  Best time: 6–8 AM       │
  │  └──────────┘  AI Tip: Visit at dawn for crowd-free views  │
  │                                            [+ Add to Day] │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Tokyo Tower  ★4.5                         │
  │  │  [Photo] │  Minato · Viewpoint · Entry ¥1,200          │
  │  │          │  Duration: 1–2 hrs  Best time: After sunset  │
  │  └──────────┘  AI Tip: Visit after dinner for best view   │
  │                                            [+ Add to Day] │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  teamLab Borderless  ★4.9    ★ AI Pick    │
  │  │  [Photo] │  Odaiba · Digital Art · ¥3,200              │
  │  │          │  Duration: 2–3 hrs  Book in advance          │
  │  └──────────┘  AI Tip: Evening visit for best experience  │
  │                                            [+ Add to Day] │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Clicking `[+ Add to Day]` → day selector popup → adds to chosen day in timeline.

---

### 7.8 Activity Canvas (Teal `#0D9488`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← ⚡ Activities  Tokyo · Oct 02 · 2 Travelers             Filters
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [All]  [Adventure]  [Cultural]  [Food]  [Wellness]  [Classes]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Sushi Making Class  ★4.9      ★ AI Pick  │
  │  │  [Photo] │  Cultural · 2 hrs · Tsukiji Market          │
  │  │          │  ₹3,500/person · Group ≤8 · Booking needed  │
  │  └──────────┘  Provider: Tokyo Kitchen Lab  [Book Now]    │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Mount Fuji Day Trip  ★4.7                 │
  │  │  [Photo] │  Adventure · 10 hrs · Includes transport    │
  │  │          │  ₹7,200/person · Group ≤15 · Easy level     │
  │  └──────────┘  Provider: Japan Eco Tours    [Book Now]    │
  └───────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────┐
  │  ┌──────────┐  Samurai Experience  ★4.6                  │
  │  │  [Photo] │  Cultural · 1.5 hrs · Asakusa               │
  │  │          │  ₹2,800/person · All levels · Costume incl. │
  │  └──────────┘  Provider: Samurai Edo Tokyo  [Book Now]    │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 7.9 Visa Canvas (Indigo `#4338CA`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 📋 Visa Requirements  India (IN) → Japan (JP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  🇯🇵 Japan Tourist Visa Required for Indian Citizens      │
  │  ─────────────────────────────────────────────────────── │
  │  Visa Type:       Tourist Visa (Single/Multiple Entry)    │
  │  Processing Time: 5–7 business days                       │
  │  Validity:        Up to 90 days per visit                 │
  │  Fee:             ₹1,100 (Single) / ₹2,200 (Multiple)    │
  │  Where to apply:  Japan Consulate / Authorized Agency     │
  │  Official site:   [Visit Japan e-Visa Portal ↗]          │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Required Documents Checklist
  ─────────────────────────────────────────────────────────────
  ☐  Valid Passport (min. 6 months validity)
  ☐  Recent Passport-size Photographs (2)
  ☐  Visa Application Form (filled & signed)
  ☐  Bank Statement (last 3 months)
  ☐  Income Tax Returns / Salary Slips (last 3 months)
  ☐  Hotel Booking Confirmation (all nights)
  ☐  Flight Itinerary (to & from Japan)
  ☐  Travel Insurance (coverage ≥ ₹30 Lakh)
  ☐  Leave Letter from Employer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️ Apply at least 2–3 weeks before departure
  ⚠️ Japan does not offer Visa on Arrival for Indian citizens
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Status:   [Not Started ▾]     [Mark as Applied]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Status updates feed back to Pre-Journey Checklist (eVisa pill turns green when marked Applied/Approved).

---

### 7.10 Forex Canvas (Mint Green `#6EE7B7`)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 💱 Currency Exchange   INR → JPY    Live rates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ┌───────────────────────────────────────────────────────────┐
  │  1 INR = 1.83 JPY          ▲ 0.2% today                 │
  │  ─────────────────────────────────────────────────────── │
  │  [7D chart: rate trend line]                              │
  └───────────────────────────────────────────────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Calculate
  ─────────────────────────────────────────────────────────────
  You send:   [₹ 50,000    INR ▾]
  You get:    ¥ 91,500     JPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exchange Options Comparison
  ─────────────────────────────────────────────────────────────
  ┌──────────────────┬─────────────┬────────────┬────────────┐
  │ Option           │ Rate        │ Fees       │ You get    │
  ├──────────────────┼─────────────┼────────────┼────────────┤
  │ ★ Forex Card     │ 1 = 1.80    │ ₹150 once  │ ¥89,850    │
  │   (BookMyForex)  │             │            │            │
  ├──────────────────┼─────────────┼────────────┼────────────┤
  │ Bank Transfer    │ 1 = 1.71    │ ₹500       │ ¥84,500    │
  ├──────────────────┼─────────────┼────────────┼────────────┤
  │ Airport Exchange │ 1 = 1.59    │ None       │ ¥79,500    │
  └──────────────────┴─────────────┴────────────┴────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  💡 AI Tip: Load a Forex Card — best rate, no airport queues
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Status:   [Not arranged ▾]     [Mark as Arranged]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 7.11 Booking Canvas (Blue→Purple Gradient)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
← 🛒 Booking Summary  Japan Autumn Trip · 2 Travelers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  FLIGHTS
  ─────────────────────────────────────────────────────────────
  ✈ DEL → HND  Oct 01 · Indigo AI 302 · 2 Economy     ₹1,04,000
  ✈ HND → DEL  Oct 08 · ANA NH 838   · 2 Economy      ₹98,000
                                              Subtotal  ₹2,02,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOTELS
  ─────────────────────────────────────────────────────────────
  🏨 Aman Tokyo          Oct 01–04 · 3N · 1 Room       ₹1,26,000
  🏨 The Celestine Kyoto Oct 04–06 · 2N · 1 Room       ₹62,000
  🏨 Conrad Osaka        Oct 06–08 · 2N · 1 Room       ₹74,000
                                              Subtotal  ₹2,62,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TRANSPORT
  ─────────────────────────────────────────────────────────────
  🚅 Nozomi 203  Tokyo→Kyoto  Oct 04   2 Reserved Seats  ₹14,600
  🚅 Hikari 641  Kyoto→Osaka  Oct 06   2 Reserved Seats   ₹4,200
                                              Subtotal   ₹18,800
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACTIVITIES
  ─────────────────────────────────────────────────────────────
  ⚡ Sushi Making Class  Oct 02   2 persons               ₹7,000
  ⚡ Fushimi Inari Hike  Oct 04   2 persons (Free)            ₹0
  ⚡ Dotonbori Food Tour Oct 07   2 persons               ₹5,200
                                              Subtotal   ₹12,200
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUMMARY
  ─────────────────────────────────────────────────────────────
  Budget:     ₹1,75,000
  Total Cost: ₹4,95,000  ⚠️ Over budget by ₹3,20,000
  ─────────────────────────────────────────────────────────────
  [Adjust Budget]                     [Proceed to Book →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Budget conflict shown in amber/red. Each item has `[✕]` remove button. `[Proceed to Book]` → payment flow.

---

## 8. Sidebar Design

### Expanded Sidebar (Images 1 & 2)

```
┌──────────────────────────────┐
│  🌍  NeuralNomad             │
│  ─────────────────────────── │
│  [+ New Trip ▾]              │
│  ─────────────────────────── │
│  🏠  Home                    │
│  ✈️  Trips                   │
│  📋  Planner          ← active│
│  🎫  Bookings                │
│  📍  Attractions             │
│  💰  Wallet                  │
│  📄  Documents               │
│  ─────────────────────────── │
│  (scrollable workspace list) │
│  📋 Japan Autumn Trip  ←     │
│     7D · 3 Cities            │
│  📋 Goa Beach Trip           │
│     5D · 1 City              │
│  ─────────────────────────── │
│  ✦ AI Assistant       🟣     │
│  👤 Yash Premium       ›     │
└──────────────────────────────┘
```

### Collapsed Icon Sidebar (Image 3)

```
┌────┐
│ 🌍 │  ← logo
│ ── │
│ ➕ │  ← new trip
│ ── │
│ 🏠 │
│ ✈️ │
│ 📋 │  ← active (accent color dot)
│ 🎫 │
│ 📍 │
│ 💰 │
│ 📄 │
│ ── │
│ ⚙️ │
│ 👤 │
└────┘
```

Hover on icon → tooltip with label. Toggle collapse via `‹` button at sidebar edge.

---

## 9. Homepage Design

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

              [Animated gradient background — soft aurora]

              🌍  NeuralNomad

              ☀️ Good morning, Yash

                   Where would you like to go next?
              ┌─────────────────────────────────────────┐
              │  🔍  Tokyo, Japan...             [Plan] │
              └─────────────────────────────────────────┘

                          + Start Planning

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recent Trips
  ─────────────────────────────────────────────────────────────────────
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  [Japan img] │  │ [Thailand img│  │  [Goa img]   │  │  [Bali img]  │
  │              │  │              │  │              │  │              │
  │  Japan       │  │  Thailand    │  │  Goa         │  │  Bali        │
  │  Autumn Trip │  │  Winter Trip │  │  Dec Trip    │  │  Honeymoon   │
  │  Oct 01–08   │  │  Dec 15–22   │  │  Draft       │  │  Completed   │
  │  In Planning │  │  Draft       │  │              │  │              │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Empty state (no trips yet):
```
              [Travel illustration — airplane + globe]

              Ready for your next adventure?
              Tell me where you want to go.

                       [Start Planning]
```

---

## 10. Updated Component Hierarchy

```
app/planner/page.tsx
  └── PlannerShell
        ├── PlannerSidebar
        │     ├── SidebarHeader (logo + collapse toggle)
        │     ├── NewTripButton
        │     ├── SidebarNav (Home / Trips / Planner / Bookings / Wallet / Docs)
        │     ├── WorkspaceList (scrollable trip list — expanded mode only)
        │     ├── AIAssistantButton (bottom, with indicator dot)
        │     └── UserProfile
        │
        ├── PlannerTopBar
        │     ├── TripTitle (editable inline)
        │     ├── TripMeta (days · cities · budget · travelers)
        │     ├── AIAssistantToggle → sets rightSlot = 'ai-chat'
        │     ├── UndoRedo
        │     ├── ShareButton
        │     ├── ExportButton
        │     ├── BookJourneyButton → opens BookingCanvas
        │     ├── SearchButton
        │     └── MoreMenu
        │
        ├── PlanCanvas  (center, always visible, scrollable)
        │     ├── PreJourneyChecklist
        │     │     └── ChecklistPill[] (Passport / eVisa / Forex / Insurance / eSIM)
        │     │           └── click → opens relevant canvas in rightSlot
        │     ├── CitySection[]
        │     │     ├── CitySectionHeader (icon + name + nights + dates + weather + collapse)
        │     │     └── DayGroup[]
        │     │           ├── DayHeader (Day N · Date · Label)
        │     │           └── TimelineItem[]
        │     │                 ├── TimeColumn (start/end time)
        │     │                 ├── CategoryIconCircle (colored, category-specific)
        │     │                 ├── ConnectorLine
        │     │                 ├── ItemCard
        │     │                 │     ├── ItemTitle + BadgePill
        │     │                 │     ├── ItemMeta (route/address/rating/distance)
        │     │                 │     ├── AITip (accent color)
        │     │                 │     ├── ItemPrice + StatusBadge
        │     │                 │     └── MoreMenu (⋮)
        │     │                 └── TimelineItemExpanded (when selected)
        │     │                       ├── PhotoThumbnail
        │     │                       ├── FullDetails
        │     │                       └── ActionRow [Replace | Compare | Notes | Remove]
        │     ├── JourneyCard (inter-city transport, between city sections)
        │     └── AddActivityButton
        │
        └── RightSlot  (switches between 3 states via Zustand)
              │
              ├── STATE: 'info'  ← default
              │     └── RightInfoPanel
              │           ├── TripRouteMap (Mapbox/Google Maps)
              │           ├── AITripInsights
              │           │     └── InsightCard[] (weather/tip/alert + [View] btn)
              │           ├── TripSummary (budget progress bar)
              │           └── QuickAddGrid (Flight/Hotel/Activity/Restaurant/Transport/Note)
              │
              ├── STATE: 'canvas'  ← triggered by timeline item click or Quick Add
              │     └── ExecutionCanvas (lazy-loaded via registry)
              │           ├── CanvasHeader (← back + title + context + Map + Filters)
              │           └── [Canvas-specific content]
              │                 ├── FlightCanvas
              │                 ├── HotelCanvas
              │                 ├── RestaurantCanvas
              │                 ├── TrainCanvas
              │                 ├── BusCanvas
              │                 ├── CabCanvas
              │                 ├── AttractionCanvas
              │                 ├── ActivityCanvas
              │                 ├── VisaCanvas
              │                 ├── ForexCanvas
              │                 └── BookingCanvas
              │
              └── STATE: 'ai-chat'  ← triggered by top bar button
                    └── AIChatPanel
                          ├── ChatHeader (AI Assistant + close)
                          ├── QuickActionGrid (Optimize / Budget / Weather / Add Day...)
                          ├── ChatMessages (scrollable)
                          │     └── ChatMessage[]
                          │           ├── UserBubble
                          │           └── AIResponse
                          │                 ├── TextBlock
                          │                 ├── BulletList
                          │                 └── ActionButtons [Update Plan | Show Alternatives]
                          └── ChatInputBar (text + attach + mic + send)
```

---

## 11. State Management

### Zustand Store (UI state only)

```typescript
// features/planner/store/planner.store.ts

type RightSlotState = 'info' | 'ai-chat' | 'canvas';
type CanvasType = 'flight' | 'hotel' | 'restaurant' | 'train' | 'bus' |
                 'cab' | 'attraction' | 'activity' | 'visa' | 'forex' | 'booking';

interface PlannerStore {
  // Layout
  sidebarExpanded: boolean;
  toggleSidebar: () => void;

  // Right slot
  rightSlot: RightSlotState;
  activeCanvasType: CanvasType | null;
  activeCanvasItemId: string | null;    // which timeline item triggered the canvas
  activeCanvasMode: 'view' | 'search' | 'compare'; // view=existing item, search=new, compare=alternatives

  openInfoPanel: () => void;
  openAIChat: () => void;
  openCanvas: (type: CanvasType, itemId?: string, mode?: 'view' | 'search' | 'compare') => void;
  closeRightSlot: () => void;

  // Plan Canvas
  expandedCityIds: string[];           // which city sections are expanded
  selectedActivityId: string | null;   // inline expanded timeline item
  toggleCityExpanded: (cityId: string) => void;
  selectActivity: (id: string | null) => void;

  // Active workspace
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
}
```

### React Query (server state)

```typescript
// hooks/use-planner.ts
// Queries:
useWorkspace(id)           → GET /api/planner/workspaces/{id}/summary/
usePlannerMemory(id)       → GET /api/planner/workspaces/{id}/memory/
useTripPlan(id)            → GET /api/planner/workspaces/{id}/plan/
useChatMessages(id)        → GET /api/planner/workspaces/{id}/chat/
useRecommendations(id)     → GET /api/planner/workspaces/{id}/recommendations/
useCanvases(id)            → GET /api/planner/workspaces/{id}/canvases/

// Mutations:
useSendMessage(id)         → POST /api/planner/workspaces/{id}/chat/
useUpdateActivity(id)      → PATCH /api/planner/workspaces/{id}/plan/activities/{actId}/
useReorderActivities(id)   → POST /api/planner/workspaces/{id}/plan/activities/reorder/
useAddToCart(id)           → POST /api/planner/workspaces/{id}/cart/
useRemoveFromCart(id)      → DELETE /api/planner/workspaces/{id}/cart/{orderId}/
useRecalculatePlan(id)     → POST /api/planner/workspaces/{id}/plan/recalculate/
```

---

## 12. Canvas Plugin Registry

```typescript
// features/planner/canvas/canvas.registry.ts

export interface CanvasDefinition {
  type: CanvasType;
  label: string;
  icon: LucideIcon;
  accentColor: string;        // Tailwind class
  accentHex: string;          // Raw hex for dynamic styles
  component: React.LazyExoticComponent<any>;
  referenceTable?: string;    // Which reference API endpoint to query
  hasMap: boolean;            // Show Map View toggle in header
  hasSearch: boolean;         // Has search bar
  preJourneyChecklist?: boolean; // Appears in Pre-Journey Checklist
}

export const canvasRegistry: Record<CanvasType, CanvasDefinition> = {
  flight:     { type: 'flight',     label: 'Flights',     icon: Plane,           accentColor: 'text-blue-600',    accentHex: '#2563EB', component: lazy(() => import('./execution/FlightCanvas')),     referenceTable: 'airport_routes',   hasMap: false, hasSearch: true },
  hotel:      { type: 'hotel',      label: 'Hotels',      icon: Building2,       accentColor: 'text-purple-600',  accentHex: '#9333EA', component: lazy(() => import('./execution/HotelCanvas')),      referenceTable: 'hotel_master',     hasMap: true,  hasSearch: true },
  restaurant: { type: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed, accentColor: 'text-rose-500',    accentHex: '#F43F5E', component: lazy(() => import('./execution/RestaurantCanvas')), referenceTable: 'restaurant_master', hasMap: true,  hasSearch: true },
  train:      { type: 'train',      label: 'Trains',      icon: TrainFront,      accentColor: 'text-orange-600',  accentHex: '#EA580C', component: lazy(() => import('./execution/TrainCanvas')),      referenceTable: 'train_routes',     hasMap: false, hasSearch: true },
  bus:        { type: 'bus',        label: 'Buses',       icon: Bus,             accentColor: 'text-amber-600',   accentHex: '#D97706', component: lazy(() => import('./execution/BusCanvas')),        referenceTable: 'bus_routes',       hasMap: false, hasSearch: true },
  cab:        { type: 'cab',        label: 'Cab',         icon: Car,             accentColor: 'text-emerald-600', accentHex: '#059669', component: lazy(() => import('./execution/CabCanvas')),        referenceTable: undefined,          hasMap: true,  hasSearch: false },
  attraction: { type: 'attraction', label: 'Attractions', icon: Landmark,        accentColor: 'text-orange-500',  accentHex: '#F97316', component: lazy(() => import('./execution/AttractionCanvas')), referenceTable: 'attraction_master', hasMap: true,  hasSearch: true },
  activity:   { type: 'activity',   label: 'Activities',  icon: Zap,             accentColor: 'text-teal-600',    accentHex: '#0D9488', component: lazy(() => import('./execution/ActivityCanvas')),   referenceTable: 'activity_master',  hasMap: false, hasSearch: true },
  visa:       { type: 'visa',       label: 'Visa',        icon: FileCheck,       accentColor: 'text-indigo-700',  accentHex: '#4338CA', component: lazy(() => import('./execution/VisaCanvas')),       referenceTable: 'visa_requirement', hasMap: false, hasSearch: false, preJourneyChecklist: true },
  forex:      { type: 'forex',      label: 'Forex',       icon: CircleDollarSign,accentColor: 'text-emerald-400', accentHex: '#6EE7B7', component: lazy(() => import('./execution/ForexCanvas')),      referenceTable: 'currency',         hasMap: false, hasSearch: false, preJourneyChecklist: true },
  booking:    { type: 'booking',    label: 'Booking',     icon: ShoppingCart,    accentColor: 'text-blue-600',    accentHex: '#6366F1', component: lazy(() => import('./execution/BookingCanvas')),    referenceTable: undefined,          hasMap: false, hasSearch: false },
};
```

---

## 13. Timeline Item Category Map

Every activity type maps to an icon and circle color:

```typescript
export const TIMELINE_CATEGORY_MAP = {
  flight:     { icon: Plane,           bgColor: 'bg-blue-500',    label: 'Flight' },
  taxi:       { icon: Car,             bgColor: 'bg-yellow-500',  label: 'Taxi / Cab' },
  hotel:      { icon: Building2,       bgColor: 'bg-purple-600',  label: 'Hotel' },
  restaurant: { icon: UtensilsCrossed, bgColor: 'bg-rose-500',    label: 'Restaurant' },
  attraction: { icon: Landmark,        bgColor: 'bg-orange-500',  label: 'Attraction' },
  activity:   { icon: Zap,             bgColor: 'bg-teal-600',    label: 'Activity' },
  train:      { icon: TrainFront,      bgColor: 'bg-orange-600',  label: 'Train' },
  bus:        { icon: Bus,             bgColor: 'bg-amber-600',   label: 'Bus' },
  walk:       { icon: Footprints,      bgColor: 'bg-gray-400',    label: 'Walk' },
  ferry:      { icon: Ship,            bgColor: 'bg-cyan-500',    label: 'Ferry' },
  metro:      { icon: Train,           bgColor: 'bg-violet-600',  label: 'Metro' },
  photo:      { icon: Camera,          bgColor: 'bg-teal-500',    label: 'Photography' },
  note:       { icon: StickyNote,      bgColor: 'bg-gray-300',    label: 'Note' },
  checkin:    { icon: CalendarCheck,   bgColor: 'bg-purple-600',  label: 'Check-in' },
  checkout:   { icon: CalendarX,       bgColor: 'bg-purple-400',  label: 'Check-out' },
  arrival:    { icon: PlaneLanding,    bgColor: 'bg-blue-500',    label: 'Arrival' },
  departure:  { icon: PlaneTakeoff,    bgColor: 'bg-blue-500',    label: 'Departure' },
};
```

---

## 14. Workspace Event System (Backend)

```python
class WorkspaceEventType:
    # Context
    CONTEXT_UPDATED     = 'context.updated'
    DATES_CHANGED       = 'dates.changed'
    BUDGET_CHANGED      = 'budget.changed'
    TRAVELERS_CHANGED   = 'travelers.changed'

    # Canvas
    CANVAS_OPENED       = 'canvas.opened'
    CANVAS_CLOSED       = 'canvas.closed'

    # Item
    ITEM_SELECTED       = 'item.selected'    # User added to cart → triggers timeline update
    ITEM_REMOVED        = 'item.removed'
    ITEM_MODIFIED       = 'item.modified'

    # Timeline
    ACTIVITY_ADDED      = 'activity.added'
    ACTIVITY_REMOVED    = 'activity.removed'
    ACTIVITY_MOVED      = 'activity.moved'
    ACTIVITY_REORDERED  = 'activity.reordered'

    # Plan
    PLAN_RECALCULATED   = 'plan.recalculated'
    ROUTE_UPDATED       = 'route.updated'
    CONFLICT_DETECTED   = 'conflict.detected'
    CONFLICT_RESOLVED   = 'conflict.resolved'

    # Recommendations
    RECOMMENDATION_GENERATED  = 'recommendation.generated'
    RECOMMENDATION_ACCEPTED   = 'recommendation.accepted'
    RECOMMENDATION_DISMISSED  = 'recommendation.dismissed'

    # Checklist
    CHECKLIST_ITEM_UPDATED    = 'checklist.item.updated'   # visa/forex status change
```

### Event Cascade (ITEM_SELECTED example)

```
User selects Aman Tokyo hotel
  ↓
ITEM_SELECTED event published
  ↓
TimelineEngine    → adds hotel check-in/out events to TripDay
BudgetEngine      → recalculates total: ₹42,000 × 3 nights added
ConflictDetector  → checks no overlapping hotel exists for Oct 01-04
RecommendEngine   → "Book airport transfer from HND to Aman Tokyo?"
PreChecklist      → no change (hotel is not a checklist item)
  ↓
PLAN_RECALCULATED event published
  ↓
Frontend refreshes Plan Canvas and Right Info Panel
```

---

## 15. Backend Architecture (Unchanged from v2, confirmed correct)

### Planner Engine (apps/planner/engine/)

| Module | Responsibility |
|--------|---------------|
| `context_manager.py` | Stores and manages structured trip parameters |
| `memory_manager.py` | Maintains AI-readable structured memory (not raw chat) |
| `timeline_engine.py` | Builds and recalculates chronological event stream |
| `budget_engine.py` | Tracks estimated vs actual spending in real-time |
| `route_service.py` | Distance/time via Google Maps Distance Matrix |
| `conflict_detector.py` | Identifies overlaps, impossible schedules |
| `recommendation_engine.py` | Generates smart suggestions |
| `command_executor.py` | Parses and executes AI-generated commands |
| `event_bus.py` | Workspace event pub/sub |

### Command Types

```typescript
type CommandType =
  | 'SET_CONTEXT' | 'SET_DATES' | 'SET_TRAVELERS' | 'SET_BUDGET'
  | 'ADD_DESTINATION' | 'REMOVE_DESTINATION' | 'SET_TRAVEL_STYLE'
  | 'SET_INTERESTS' | 'OPEN_CANVAS' | 'SEARCH_FLIGHTS' | 'SEARCH_HOTELS'
  | 'SEARCH_TRAINS' | 'SEARCH_BUSES' | 'ADD_ACTIVITY' | 'REMOVE_ACTIVITY'
  | 'MOVE_ACTIVITY' | 'ADD_TO_CART' | 'CHECK_VISA' | 'CHECK_FOREX'
  | 'RECALCULATE_PLAN' | 'GENERATE_RECOMMENDATIONS' | 'SET_MODE'
  | 'UPDATE_CHECKLIST_STATUS';  // ← NEW: update visa/forex/insurance status
```

---

## 16. Database Design (confirmed from v2, minor additions)

### New Fields Added

**TripActivity** — add `thumbnail_url` (string, nullable): for hotel/restaurant photo shown in timeline.

**WorkspaceContext** — add `checklist_status` (JSON):
```python
{
  "passport": "completed",
  "evisa": "completed",
  "forex": "pending",
  "insurance": "completed",
  "esim": "pending"
}
```
This drives the Pre-Journey Checklist pills.

**PlannerWorkspace** — add `sidebar_expanded` (boolean, default True): persists sidebar state per workspace.

---

## 17. Updated Folder Structure

### Backend (unchanged from v2)

```
backend/
└── apps/
    ├── planner/                    (engine + models + services + providers)
    └── reference/                  (all reference data)
```

### Frontend (updated from v2)

```
frontend/src/
├── app/
│   ├── page.tsx                           → homepage
│   └── planner/
│       ├── layout.tsx                     → fullscreen layout (no default nav)
│       └── page.tsx                       → mounts PlannerShell
│
├── features/
│   ├── home/
│   │   ├── HomePage.tsx
│   │   ├── TripCard.tsx
│   │   └── SearchBar.tsx
│   │
│   └── planner/
│       ├── layout/
│       │   ├── PlannerShell.tsx            ← root orchestrator
│       │   ├── PlannerSidebar.tsx          ← expanded + collapsed modes
│       │   ├── PlannerTopBar.tsx           ← top bar with all controls
│       │   └── RightSlot.tsx               ← switches between 3 states
│       │
│       ├── canvas/
│       │   ├── plan/
│       │   │   ├── PlanCanvas.tsx
│       │   │   ├── PreJourneyChecklist.tsx
│       │   │   ├── ChecklistPill.tsx
│       │   │   ├── CitySection.tsx
│       │   │   ├── CitySectionHeader.tsx
│       │   │   ├── DayGroup.tsx
│       │   │   ├── DayHeader.tsx
│       │   │   ├── TimelineItem.tsx         ← the most important component
│       │   │   ├── TimelineItemExpanded.tsx  ← inline expand with photo
│       │   │   ├── CategoryIconCircle.tsx    ← colored icon circle
│       │   │   ├── ConnectorLine.tsx         ← vertical timeline line
│       │   │   ├── JourneyCard.tsx           ← inter-city transport card
│       │   │   └── AddActivityButton.tsx
│       │   │
│       │   ├── info-panel/
│       │   │   ├── RightInfoPanel.tsx        ← default right slot
│       │   │   ├── TripRouteMap.tsx           ← Mapbox route map
│       │   │   ├── AITripInsights.tsx
│       │   │   ├── InsightCard.tsx
│       │   │   ├── TripSummary.tsx
│       │   │   ├── BudgetProgress.tsx
│       │   │   ├── QuickAddGrid.tsx
│       │   │   └── DragDropTip.tsx
│       │   │
│       │   ├── execution/
│       │   │   ├── shared/
│       │   │   │   ├── CanvasHeader.tsx       ← back + title + context + Map + Filters
│       │   │   │   ├── CanvasSearchBar.tsx
│       │   │   │   ├── CanvasFilterTabs.tsx
│       │   │   │   ├── ResultCard.tsx         ← base card (photo + details + action)
│       │   │   │   ├── AIPickBadge.tsx
│       │   │   │   └── AddToTripButton.tsx
│       │   │   │
│       │   │   ├── FlightCanvas.tsx
│       │   │   ├── FlightDateTabBar.tsx       ← date row with prices
│       │   │   ├── FlightResultCard.tsx
│       │   │   │
│       │   │   ├── HotelCanvas.tsx
│       │   │   ├── HotelResultCard.tsx
│       │   │   │
│       │   │   ├── RestaurantCanvas.tsx
│       │   │   ├── RestaurantResultCard.tsx
│       │   │   │
│       │   │   ├── TrainCanvas.tsx
│       │   │   ├── TrainResultCard.tsx
│       │   │   │
│       │   │   ├── BusCanvas.tsx
│       │   │   ├── BusResultCard.tsx
│       │   │   ├── SeatMapOverlay.tsx         ← bus seat selection
│       │   │   │
│       │   │   ├── CabCanvas.tsx
│       │   │   ├── CabCategoryCard.tsx        ← Economy/Comfort/SUV/Premium
│       │   │   ├── AlternativeTransport.tsx   ← bus/metro comparison row
│       │   │   │
│       │   │   ├── AttractionCanvas.tsx
│       │   │   ├── AttractionResultCard.tsx
│       │   │   │
│       │   │   ├── ActivityCanvas.tsx
│       │   │   ├── ActivityResultCard.tsx
│       │   │   │
│       │   │   ├── VisaCanvas.tsx
│       │   │   ├── VisaStatusBadge.tsx
│       │   │   ├── DocumentChecklist.tsx
│       │   │   │
│       │   │   ├── ForexCanvas.tsx
│       │   │   ├── ExchangeCalculator.tsx
│       │   │   ├── ExchangeComparisonTable.tsx
│       │   │   ├── RateChart.tsx              ← 7-day rate trend
│       │   │   │
│       │   │   └── BookingCanvas.tsx
│       │   │       ├── BookingSection.tsx     ← Flights / Hotels / Transport / Activities
│       │   │       ├── BookingLineItem.tsx
│       │   │       └── BookingSummaryFooter.tsx
│       │   │
│       │   └── canvas.registry.ts             ← plugin map
│       │
│       ├── chat/
│       │   ├── AIChatPanel.tsx
│       │   ├── ChatHeader.tsx
│       │   ├── QuickActionGrid.tsx
│       │   ├── ChatMessages.tsx
│       │   ├── ChatMessage.tsx
│       │   ├── ChatInputBar.tsx
│       │   └── widgets/
│       │       ├── WidgetRenderer.tsx          ← routes JSON type → component
│       │       ├── TextWidget.tsx
│       │       ├── QuickActionsWidget.tsx
│       │       ├── UpdatePlanCard.tsx
│       │       ├── ConfirmationCard.tsx
│       │       ├── RecommendationCard.tsx
│       │       ├── DatePickerWidget.tsx
│       │       ├── BudgetSlider.tsx
│       │       ├── TravelerSelector.tsx
│       │       ├── DestinationCard.tsx
│       │       └── ChecklistWidget.tsx
│       │
│       ├── store/
│       │   └── planner.store.ts               ← Zustand (UI state only)
│       │
│       └── hooks/
│           ├── use-planner.ts                 ← React Query wrappers
│           ├── use-canvas.ts                  ← canvas data + lifecycle
│           └── use-drag-drop.ts               ← dnd-kit timeline reorder
│
├── services/
│   ├── planner.service.ts                     ← REST calls to /api/planner/
│   ├── planner.types.ts                       ← all TypeScript types
│   └── reference.service.ts                   ← REST calls to /api/reference/
│
└── store/
    └── auth.store.ts                          ← existing, reuse as-is
```

---

## 18. Key Libraries

| Library | Purpose |
|---------|---------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop timeline reordering |
| `mapbox-gl` or `@react-google-maps/api` | Route map in Right Info Panel |
| `react-query` (`@tanstack/react-query`) | All server state (workspace, plan, chat) |
| `zustand` | UI-only state (right slot, sidebar, selected activity) |
| `framer-motion` | Slide-in animations for right slot transitions |
| `recharts` | Forex rate chart (7-day trend) |
| `date-fns` | Date formatting throughout |
| `lucide-react` | All icons (consistent set) |
| `clsx` + `tailwind-merge` | Conditional classes |

---

## 19. Animations (Premium Feel)

| Transition | Animation |
|-----------|-----------|
| Right slot state change (info → canvas → chat) | Slide + fade, 250ms ease-out |
| Sidebar expand/collapse | Width transition, 200ms ease-in-out |
| Timeline item expand (inline) | Height expand, 200ms, opacity fade-in |
| Canvas loading | Skeleton shimmer placeholders |
| Item added to timeline | Slide down + green flash on left border |
| Conflict detected | Red pulse on affected items |
| AI Chat message arrive | Fade in from bottom, 150ms |
| City section collapse | Height collapse, 200ms |
| Pre-journey pill status change | Icon swap + color transition |
| Price drop insight | Subtle amber glow |

All animations respect `prefers-reduced-motion` — disable when system setting is on.

---

## 20. Implementation Roadmap (Updated)

### Phase 1 — Reference Data Module (Backend)
> Complete reference database with seed data

- [ ] Create `apps/reference/` Django app
- [ ] Define models: Country, State, City, Airport, Airline, AirportRoute
- [ ] Define models: RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation
- [ ] Define models: HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster
- [ ] Define models: VisaRequirement, Currency, HolidayCalendar, WeatherNormals, TravelSeason, GooglePlaceCache
- [ ] Create serializers + search/autocomplete views
- [ ] Register all in admin
- [ ] Run migrations
- [ ] Seed: countries, major Indian + global cities, airports, stations, attractions

---

### Phase 2 — Planner Models + API Shell (Backend)
> All planner models with ViewSets and nested routes

- [ ] Define all models in `apps/planner/models.py` (PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat, WorkspaceActivity, PlannerTrip, TripCity, TripDay, TripActivity, TripRoute, Recommendation, CanvasInstance, CanvasData, BookingOrder, SavedPlace)
- [ ] Add `checklist_status` to WorkspaceContext
- [ ] Add `thumbnail_url` to TripActivity
- [ ] Add `sidebar_expanded` to PlannerWorkspace
- [ ] Create serializers
- [ ] Create `IsWorkspaceOwner` permission
- [ ] Create thin ViewSets (delegate to services)
- [ ] URL routing with nested routes
- [ ] Register in admin
- [ ] Run migrations

---

### Phase 3 — Planner Engine (Backend)
> All intelligence lives here

- [ ] `engine/event_bus.py` — pub/sub
- [ ] `engine/context_manager.py`
- [ ] `engine/memory_manager.py`
- [ ] `engine/timeline_engine.py` — event stream + recalculation
- [ ] `engine/budget_engine.py`
- [ ] `engine/route_service.py` — Google Maps Distance Matrix
- [ ] `engine/conflict_detector.py`
- [ ] `engine/recommendation_engine.py`
- [ ] `engine/command_executor.py` — command registry + handlers
- [ ] Register all event subscriptions at app startup

---

### Phase 4 — AI Provider + Chat Service (Backend)
> Gemini integration + command flow

- [ ] `providers/base.py` — abstract AIProvider
- [ ] `providers/gemini_provider.py` — structured output with widgets + commands
- [ ] `providers/google_maps_provider.py`
- [ ] `services/chat_service.py` — orchestrates: receive → AI call → execute commands → respond
- [ ] `services/workspace_service.py`
- [ ] `services/plan_service.py`
- [ ] `commands/registry.py` + `commands/handlers.py`
- [ ] End-to-end test: message → AI → commands → engine → response with widgets

---

### Phase 5 — Frontend Shell + Layout (Frontend)
> Get the frame right before filling it

- [ ] `planner.store.ts` — Zustand with rightSlot + sidebarExpanded + selectedActivityId
- [ ] `planner.service.ts` + `planner.types.ts` + `reference.service.ts`
- [ ] `use-planner.ts` — all React Query hooks
- [ ] `PlannerShell.tsx` — icon bar + top bar + plan canvas + right slot
- [ ] `PlannerSidebar.tsx` — expanded + collapsed modes + collapse animation
- [ ] `PlannerTopBar.tsx` — title + meta + all action buttons
- [ ] `RightSlot.tsx` — state machine: renders InfoPanel | Canvas | Chat
- [ ] `app/planner/layout.tsx` — fullscreen, no default nav
- [ ] `app/planner/page.tsx`

---

### Phase 6 — Plan Canvas (Frontend)
> The heart of the product

- [ ] `PreJourneyChecklist.tsx` + `ChecklistPill.tsx` (5 items, collapsible)
- [ ] `CitySection.tsx` + `CitySectionHeader.tsx` + collapse behavior
- [ ] `DayGroup.tsx` + `DayHeader.tsx`
- [ ] `CategoryIconCircle.tsx` — colored circle per category type
- [ ] `TimelineItem.tsx` — time + icon + connector line + card (MOST IMPORTANT)
- [ ] `TimelineItemExpanded.tsx` — inline photo + Replace/Compare/Notes/Remove
- [ ] `JourneyCard.tsx` — inter-city transport
- [ ] `AddActivityButton.tsx`
- [ ] `PlanCanvas.tsx` — assembles all above, scrollable
- [ ] Drag-and-drop reorder with `@dnd-kit` (activities within a day)

---

### Phase 7 — Right Info Panel (Frontend)
> Default right slot content

- [ ] `TripRouteMap.tsx` — Mapbox map with city markers + dashed route
- [ ] `AITripInsights.tsx` + `InsightCard.tsx`
- [ ] `TripSummary.tsx` + `BudgetProgress.tsx`
- [ ] `QuickAddGrid.tsx` — 6 quick add buttons → open canvas in search mode
- [ ] `RightInfoPanel.tsx` — assembles all above

---

### Phase 8 — AI Chat Panel (Frontend)
> Right slot: AI state

- [ ] `AIChatPanel.tsx` + `ChatHeader.tsx`
- [ ] `QuickActionGrid.tsx` — 6 quick action buttons
- [ ] `ChatMessages.tsx` + `ChatMessage.tsx` — user bubble + AI response
- [ ] All chat widgets: `WidgetRenderer`, `TextWidget`, `QuickActionsWidget`, `UpdatePlanCard`, `ConfirmationCard`, `DatePickerWidget`, `BudgetSlider`, `TravelerSelector`, `DestinationCard`, `RecommendationCard`
- [ ] `ChatInputBar.tsx` — text + attach + mic + send
- [ ] Wire to `POST /workspaces/{id}/chat/`
- [ ] Optimistic updates + message streaming (if using SSE)

---

### Phase 9 — Execution Canvases (Frontend)
> Right slot: canvas state — one by one

**Shared framework first:**
- [ ] `CanvasHeader.tsx` — back arrow + title + context chips + Map toggle + Filters
- [ ] `CanvasFilterTabs.tsx`
- [ ] `ResultCard.tsx` — base card with photo slot + details + action button
- [ ] `AIPickBadge.tsx`
- [ ] `AddToTripButton.tsx` → publishes ITEM_SELECTED → triggers timeline update

**Then each canvas:**
- [ ] `FlightCanvas.tsx` + `FlightDateTabBar.tsx` + `FlightResultCard.tsx`
- [ ] `HotelCanvas.tsx` + `HotelResultCard.tsx`
- [ ] `RestaurantCanvas.tsx` + `RestaurantResultCard.tsx`
- [ ] `TrainCanvas.tsx` + `TrainResultCard.tsx`
- [ ] `BusCanvas.tsx` + `BusResultCard.tsx` + `SeatMapOverlay.tsx`
- [ ] `CabCanvas.tsx` + `CabCategoryCard.tsx` + `AlternativeTransport.tsx`
- [ ] `AttractionCanvas.tsx` + `AttractionResultCard.tsx`
- [ ] `ActivityCanvas.tsx` + `ActivityResultCard.tsx`
- [ ] `VisaCanvas.tsx` + `DocumentChecklist.tsx` + status update → PreJourneyChecklist sync
- [ ] `ForexCanvas.tsx` + `ExchangeCalculator.tsx` + `ExchangeComparisonTable.tsx` + `RateChart.tsx`
- [ ] `BookingCanvas.tsx` + `BookingSection.tsx` + `BookingSummaryFooter.tsx`
- [ ] `canvas.registry.ts` — all 11 canvases registered

---

### Phase 10 — Polish, Animations & Homepage (Frontend)
> Make it feel premium

- [ ] `framer-motion` transitions for right slot state changes
- [ ] Sidebar expand/collapse animation
- [ ] Timeline item expand animation
- [ ] Skeleton loading states for all canvases
- [ ] Toast notifications (item added, conflict detected, plan updated)
- [ ] `ConflictAlert.tsx` — red banner when schedule conflict detected
- [ ] Error states for all API calls
- [ ] `HomePage.tsx` — gradient background + search bar + recent trips
- [ ] Empty state illustrations
- [ ] Dark mode (CSS variables already set up for this)
- [ ] Responsive collapse behavior (mobile: single panel, tab through)
- [ ] `prefers-reduced-motion` support

---

## Verification Checklist

### Backend
```bash
python manage.py makemigrations && python manage.py migrate
python manage.py shell < apps/reference/seed/seed_countries.py
# Test: POST /api/planner/workspaces/{id}/chat/ → verify commands execute
# Test: Add flight → ITEM_SELECTED cascade → timeline + budget updated
# Test: /api/docs/ (Swagger) shows all endpoints
```

### Frontend
```bash
npx tsc --noEmit          # zero type errors
# Manual: Right slot switches correctly (info → canvas → chat)
# Manual: Timeline items open correct canvas (flight item → FlightCanvas)
# Manual: Checklist pill click → correct canvas (Forex pill → ForexCanvas)
# Manual: Quick Add buttons → correct canvas in empty search state
# Manual: Sidebar collapses correctly
# Manual: Drag-drop reorders activities
# Manual: AI chat updates plan and refreshes Plan Canvas
```
