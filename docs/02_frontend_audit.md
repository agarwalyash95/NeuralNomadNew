# Frontend Audit: Neural Nomad

This is a comprehensive UI/UX and React page-level component audit of the Neural Nomad frontend.

---

## Page 1: Dashboard / Homepage (`app/page.tsx`)

- **Components**: `HomePage`, `Hero`, `SmartInsightsBar`, `MoodDestinationSection`, `AIFeaturesStrip`.
- **Reusable Components**: `AppShell` (`components/ui-custom/app-shell.tsx`), `Button` (Shadcn), `GlassCard` (`components/ui-custom/glass-card.tsx`).
- **Unused Components**: None (highly cohesive landing page).
- **Dead Code**: Minor unused CSS utility imports in `globals.css` that are not actively used by homepage grids.
- **Duplicate Components**: Some custom layout wrappers replicate structural styles available in standard `AppShell`.
- **Missing Components**: Component-level loading Skeletons for seasonal trends and active travel tiles.
- **Static Data**: Description sub-headers, AI Features tiles list fallbacks, CTA buttons navigation routing.
- **Dynamic Data**: Dynamic recommended destination cards, dynamic travel mood categorization chips, seasonal insight ribbons.
- **State Management**: Local active mood chip state, coordinated via `useHomepage` custom hook.
- **API Hooks**: `useHomepage` (coordinates endpoints `/api/homepage/destinations/`, `/api/homepage/mood-categories/`, etc.).
- **Missing API Hooks**: Hook to query personalized destination selections matching user-preferred hobbies or search histories.
- **Missing Skeletons**: Skeletons for `SmartInsightsBar` and `AIFeaturesStrip`.
- **Missing Empty States**: Illustration fallback if zero recommended holiday deals are returned by the endpoint.
- **Missing Error States**: A simple text message appears on error instead of a structural retry block.
- **Accessibility Issues**: Poor color contrast on certain dynamic background hero text elements under specific images. No explicit ARIA landmarks on mood category list buttons.
- **Responsive Issues**: High-density feature cards stack vertically on small devices but lack proper spacing, resulting in text crowding on screens under 360px.
- **Performance Issues**: Image loads are not fully optimized (large, uncompressed Unsplash imagery); causes noticeable layout shift on mobile networks.
- **Animations**: Uses subtle hover transitions (`hover:scale-[1.02]`, `hover:shadow-lg`, transition durations).
- **Overall UI Score**: **8.5/10** (Clean, appealing visual layout, but can improve on loading performance and skeletons).

---

## Page 2: Attractions List (`app/attractions/page.tsx`)

- **Components**: `AttractionsPage`, `PlaceCard`, `DetailsModal`.
- **Reusable Components**: `Navigation`, `MapPin`, `Search` (Lucide icons).
- **Unused Components**: `PlaceList` is defined in some local directories but is unused here in favor of a Masonry Grid.
- **Dead Code**: Several unused filter variables (`selectedPlaceId` commented out but kept as metadata).
- **Duplicate Components**: `DetailsModal` duplicates some text structures that also exist in `PlaceCard`.
- **Missing Components**: Mapbox interactive integration (there is a placeholder map but no active pins rendering).
- **Static Data**: Standard categories lists and static banner background images.
- **Dynamic Data**: Location autocomplete suggestions lists, places details (ratings, category tags, images, reviews).
- **State Management**: React state hooks (`searchQuery`, `suggestions`, `activeFilter`, `isModalOpen`).
- **API Hooks**: `useExplore` (fetches autocomplete and places list), `useExploreDetails` (fetches place profile details).
- **Missing API Hooks**: Dynamic user reviews submit hook.
- **Missing Skeletons**: Shimmer loaders for attraction cards inside the grid during scouting states.
- **Missing Empty States**: High-quality empty-state graphics when no search predictions are returned.
- **Missing Error States**: Error alerts are thrown via standard developer `console.error` rather than user-facing warning banners.
- **Accessibility Issues**: Inputs lack form labels (rely solely on placeholders), which fails screen-reader requirements.
- **Responsive Issues**: Sticky category navbar can overflow horizontally on narrow mobile screens without visible scroll arrows, leaving filters hidden off-screen.
- **Performance Issues**: Large Unsplash images load concurrently in the grid, causing high memory usage and sluggish scrolling.
- **Animations**: Framer Motion entrance slide-in effects on grid items.
- **Overall UI Score**: **9.0/10** (Incredibly polished Masonry discovery grid and excellent dynamic hero sections).

---

## Page 3: Attraction Details (`app/attractions/[id]/page.tsx`)

- **Components**: `AttractionsPage` (Details sub-view).
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: Inline mock list components.
- **Dead Code**: Legacy routing functions from previous versions of Next.js app router.
- **Duplicate Components**: Custom back button replicates layout from other detail views.
- **Missing Components**: Carousel indicator showing multiple views of the attraction place.
- **Static Data**: Default operating hours, ticket costs guidelines, and cancellation policies.
- **Dynamic Data**: Target attraction name, rating, address, reviews list, and location parameters.
- **State Management**: Simple page level loading states.
- **API Hooks**: `useExploreDetails` hook.
- **Missing API Hooks**: Dynamic pricing checkout integrations hook.
- **Missing Skeletons**: Receipt shimmer skeletons.
- **Missing Empty States**: Review section empty state is missing (shows a blank space instead of "Be the first to review!").
- **Missing Error States**: Silent error handling if attraction detail ID does not exist.
- **Accessibility Issues**: Keyboard tab navigation skips back-button element.
- **Responsive Issues**: Dual column layouts stack into single columns but leave high whitespace gaps on tablet landscape viewports.
- **Performance Issues**: No lazy-loading for off-screen reviews images.
- **Animations**: Standard slide-ups.
- **Overall UI Score**: **8.0/10** (Rich information display, but lacks polished sub-layouts and media carousels).

---

## Page 4: Checkout & Bookings (`app/book-now/page.tsx`)

- **Components**: `BookNowPage`.
- **Reusable Components**: `AppShell`.
- **Unused Components**: Custom check-out forms backup blocks.
- **Dead Code**: Mock payment submit functions.
- **Duplicate Components**: Custom error message banners duplicate the global alert UI wrapper styles.
- **Missing Components**: Real-time payment gateway form fields (e.g. Stripe card number field, expiration field).
- **Static Data**: Passenger nationality defaults, booking terms and conditions checklist text.
- **Dynamic Data**: Target travel segment details (flights, trains, hotels, buses, cabs), provider specifications, price quotes.
- **State Management**: Managed via Zustand store `useBookingSelectionStore`.
- **API Hooks**: `bookingService` API client mappings.
- **Missing API Hooks**: Dynamic payment verification hooks.
- **Missing Skeletons**: Comprehensive secure checkout card shimmers.
- **Missing Empty States**: Empty state when no booking selection is found.
- **Missing Error States**: Inline error message is displayed below the header but lacks a dynamic retry option.
- **Accessibility Issues**: Input fields on the form lack explicit labels.
- **Responsive Issues**: Header section gradients look squeezed on landscape mobile devices.
- **Performance Issues**: Large form blocks trigger minor rendering lags during input changes.
- **Animations**: Simple loading spinner rotations.
- **Overall UI Score**: **8.5/10** (Extremely clean, modern design, but requires real-time input fields validation).

---

## Page 5: Booking Success Confirmation (`app/booking-success/page.tsx`)

- **Components**: `BookingSuccessPage`.
- **Reusable Components**: `AppShell`.
- **Unused Components**: Return to planning redirect helpers.
- **Dead Code**: None.
- **Duplicate Components**: None.
- **Missing Components**: Printable ticket generation trigger button.
- **Static Data**: Success congratulatory message, default instructions.
- **Dynamic Data**: Generated booking reference number, total price, and redirect routing links.
- **State Management**: Simple router redirection logic.
- **API Hooks**: None (data is retrieved from preceding search states).
- **Missing API Hooks**: Direct email ticket receipt trigger hook.
- **Missing Skeletons**: Not applicable (static layout page).
- **Missing Empty States**: Not applicable.
- **Missing Error States**: Not applicable.
- **Accessibility Issues**: SVG tick marks lack correct screen-reader description tags.
- **Responsive Issues**: Text elements can run off-center on extreme ultra-wide computer displays.
- **Performance Issues**: Excellent load performance (very low footprint).
- **Animations**: Scale-in pop animations on the check icon.
- **Overall UI Score**: **9.2/10** (Simple, effective, satisfying success message with clear reference codes).

---

## Page 6: Travel Search & Cart (`app/bookings/page.tsx`)

- **Components**: `BookingPage`, `SearchField`, `SelectField`, `SearchResults`, `LocationAutocomplete`.
- **Reusable Components**: `AppShell`, `SearchDivider`.
- **Unused Components**: Unused old category tabs.
- **Dead Code**: Legacy filter variables.
- **Duplicate Components**: `SelectField` has duplicate HTML definitions that can be refactored into a single template.
- **Missing Components**: Calendar date pickers overlays (rely on browser input types).
- **Static Data**: Services list (Flights, Hotels, Trains, Bus, Cabs) dropdown options.
- **Dynamic Data**: Active travel search matches list.
- **State Management**: Managed via custom `useTravelSearch` hook.
- **API Hooks**: `useTravelSearch` (coordinating `/api/bookings/inventory/search/`).
- **Missing API Hooks**: Dynamic location auto-completer lists.
- **Missing Skeletons**: Real loading skeletons for search result slots.
- **Missing Empty States**: Better graphical layout for no flights found.
- **Missing Error States**: Failures lead to silent empty boards.
- **Accessibility Issues**: Low contrast on placeholder texts.
- **Responsive Issues**: Form columns look extremely narrow on vertical tablets.
- **Performance Issues**: Highly optimized, though could reduce search result renders during scrolling.
- **Animations**: Framer motion blobs in background.
- **Overall UI Score**: **8.7/10** (Unified hub concept works extremely well, though search filter columns can look busy).

---

## Page 7: Booking Detail Reference (`app/bookings/[id]/page.tsx`)

- **Components**: `BookingDetailPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: None.
- **Dead Code**: None.
- **Duplicate Components**: Ticket formatting duplicates card designs from search list results.
- **Missing Components**: Live barcode generator module.
- **Static Data**: Policy details.
- **Dynamic Data**: Real ticket statuses, dates, times, prices.
- **State Management**: Page state holding booking detail response.
- **API Hooks**: Active booking fetch.
- **Missing API Hooks**: Active boarding status checker hook.
- **Missing Skeletons**: Ticket details shimmer.
- **Missing Empty States**: Not applicable.
- **Missing Error States**: Alert boxes on loading failures.
- **Accessibility Issues**: Focus tags missing.
- **Responsive Issues**: QR code is forced to the bottom on mobile viewports.
- **Performance Issues**: Clean render speeds.
- **Animations**: Standard fade-ins.
- **Overall UI Score**: **8.0/10** (Provides excellent, readable ticket details, but layout can be optimized).

---

## Page 8: AI Copilot Screen (`app/copilot/page.tsx`)

- **Components**: `CopilotPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: Entire screen is a lightweight template.
- **Dead Code**: None.
- **Duplicate Components**: None.
- **Missing Components**: Unified Chat Feed, message history, widget cards renderers.
- **Static Data**: Placeholder textarea prompt message ("Plan a 10-day Japan trip under ₹1.5 lakh...").
- **Dynamic Data**: None.
- **State Management**: None.
- **API Hooks**: None.
- **Missing API Hooks**: Direct connection to AI Copilot conversation views on backend.
- **Missing Skeletons**: Loading chats indicators.
- **Missing Empty States**: Empty chat history illustrator.
- **Missing Error States**: Error handler on generation failure.
- **Accessibility Issues**: Focus indicators missing on input fields.
- **Responsive Issues**: Too much layout whitespace on large screen displays.
- **Performance Issues**: Fast loading because of minimal content.
- **Animations**: None.
- **Overall UI Score**: **3.0/10** (This page is a placeholder shell; all interactive conversational planning resides in `app/planner/page.tsx`).

---

## Page 9: Alerts Feed (`app/notifications/page.tsx`)

- **Components**: `NotificationsPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: Custom filters arrays.
- **Dead Code**: Unused notification icons imports.
- **Duplicate Components**: Item list cards layout styles.
- **Missing Components**: Bulk clean-all button (only mark-as-read is available).
- **Static Data**: Static helper headers.
- **Dynamic Data**: User alerts list (e.g. flight delays, price drops, visas updates).
- **State Management**: Simple page lists states.
- **API Hooks**: `notificationService` integrations.
- **Missing API Hooks**: Dynamic alert deletion hook.
- **Missing Skeletons**: Loading shimmer bars.
- **Missing Empty States**: Beautiful checkmark page rendered on zero notifications.
- **Missing Error States**: Quiet failures.
- **Accessibility Issues**: Low target tap dimensions on notifications mark-as-read circles on small devices.
- **Responsive Issues**: Notification description sentences are truncated too early on horizontal phone views.
- **Performance Issues**: Large list scroll lag.
- **Animations**: Subtle fade-in lists.
- **Overall UI Score**: **8.8/10** (Excellent empty states, intuitive filters, and beautiful type-specific icons).

---

## Page 10: Canvas Planner (`app/planner/page.tsx`)

- **Components**: `PlannerPage`, `PlannerChat`, `PlannerWorkspace`, `FloatingChat`, `ItineraryTimeline`, `PreJourneyChecklist`, `NodeWrapper`, `CityHeaderNode`, `DayHeaderNode`, `FlightNode`, `TransitNode`, `GenericNode`.
- **Reusable Components**: Custom sidebar interfaces, layout managers.
- **Unused Components**: Unused nodes in features archive folders.
- **Dead Code**: Heavy comments and logs left during canvas debugging.
- **Duplicate Components**: Custom icons definitions.
- **Missing Components**: Multi-city transition maps widgets, live collaborative pointers.
- **Static Data**: Suggested question triggers, standard prompts templates, mock details inside `mockData.ts`.
- **Dynamic Data**: AI-generated travel timelines (flight numbers, cities, coordinates, duration).
- **State Management**: Managed via central Zustand store `planner.store.ts` handling canvas, panel states, and workspace IDs.
- **API Hooks**: TanStack Query custom hooks managing backend workspace data.
- **Missing API Hooks**: Dynamic maps routing calculation hooks.
- **Missing Skeletons**: Shimmer loaders for nodes inside the timeline.
- **Missing Empty States**: Missing "No plan generated yet" guide.
- **Missing Error States**: Error messages display raw JSON on generation crash.
- **Accessibility Issues**: Screen-readers get lost inside complex canvas grid columns.
- **Responsive Issues**: Full-screen grid is unusable on screen widths under 768px, prompting a recommendation to switch to portrait view.
- **Performance Issues**: Large timeline lists cause browser stuttering when zoom states are changed.
- **Animations**: Rich framer-motion entrance and exit transitions.
- **Overall UI Score**: **9.0/10** (Highly immersive canvas interface, though performance and mobile adaptation require polishing).

---

## Page 11: Personal Profile (`app/settings/profile/page.tsx`)

- **Components**: `ProfileSettingsPage`.
- **Reusable Components**: `Loader2`, `Save` (Icons).
- **Unused Components**: Avatar edit popups.
- **Dead Code**: None.
- **Duplicate Components**: Style classes duplicate some general settings wrappers.
- **Missing Components**: Dynamic city dropdown list.
- **Static Data**: Theme support details.
- **Dynamic Data**: User name, phone number, email, avatar image, and default currency selections.
- **State Management**: Coordinated directly via global store `useAuthStore`.
- **API Hooks**: `userService` client functions.
- **Missing API Hooks**: Active email re-verification hook.
- **Missing Skeletons**: Loader shimmers.
- **Missing Empty States**: Not applicable.
- **Missing Error States**: Basic error banners.
- **Accessibility Issues**: High color contrast requirements are missed on help guide labels.
- **Responsive Issues**: Avatar selection flows wrap awkwardly on thin smartphones.
- **Performance Issues**: Perfect loading speeds.
- **Animations**: Spinner rotations.
- **Overall UI Score**: **8.5/10** (Clean forms, easy inputs, and reliable avatar upload integrations).

---

## Page 12: Pre-travel Preparation (`app/travel-prep/page.tsx`)

- **Components**: `TravelPrepPage`, `ForexTab`, `VisaTab`, `ConversionBar`, `VendorCard`, `VisaDetailsCard`.
- **Reusable Components**: `AppShell`.
- **Unused Components**: Local calculation widgets are defined but commented out.
- **Dead Code**: Legacy conversions scripts.
- **Duplicate Components**: Country selectors can be unified.
- **Missing Components**: Dynamic currency rate graphs.
- **Static Data**: Guidelines.
- **Dynamic Data**: Real visa status maps, active forex conversion rates.
- **State Management**: Simple tab page state selectors.
- **API Hooks**: Forex and Visa services client hooks.
- **Missing API Hooks**: Custom dealer rating submission hook.
- **Missing Skeletons**: Loading cards skeleton lists.
- **Missing Empty States**: Generic fallback banners.
- **Missing Error States**: Silent page freezes on timeout.
- **Accessibility Issues**: Lack of standard aria headers.
- **Responsive Issues**: Dual visa checklist stacks look crammed on portrait screens.
- **Performance Issues**: Minor conversion delays on heavy typing.
- **Animations**: Smooth fade tabs selectors.
- **Overall UI Score**: **8.8/10** (Provides excellent travel prep information in a clear visual layout).

---

## Page 13: Vault Bookings Summary (`app/vault/bookings/page.tsx`)

- **Components**: `VaultBookingsPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: None.
- **Dead Code**: Commented out ticket links.
- **Duplicate Components**: Card layouts duplicate design formats of search results list page.
- **Missing Components**: Sort bookings dropdown.
- **Static Data**: Default helper titles.
- **Dynamic Data**: Active travel bookings listings history.
- **State Management**: Simple local list states.
- **API Hooks**: `bookingService` lists queries.
- **Missing API Hooks**: Dynamic PDF receipt generation hook.
- **Missing Skeletons**: Receipt shimmers.
- **Missing Empty States**: Direct redirect hooks when bookings count is zero.
- **Missing Error States**: Quiet failures.
- **Accessibility Issues**: High-contrast guidelines failures.
- **Responsive Issues**: Ticket layouts collapse heavily on small viewport mobile screens.
- **Performance Issues**: Normal.
- **Animations**: Standard fade transitions.
- **Overall UI Score**: **8.2/10** (Solid, readable summary listing of secure bookings).

---

## Page 14: Secure Digital Transit Passes (`app/vault/pass/page.tsx`)

- **Components**: `VaultTravelPassPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: Custom travel card mockup layouts.
- **Dead Code**: Outdated metro rules listings.
- **Duplicate Components**: None.
- **Missing Components**: Recharge amount fields validations.
- **Static Data**: Regional metro maps guidelines.
- **Dynamic Data**: Live pass details, remaining balances.
- **State Management**: Simple react state lists.
- **API Hooks**: Travelpass service queries.
- **Missing API Hooks**: Dynamic pass transaction logs queries.
- **Missing Skeletons**: Pass shimmer.
- **Missing Empty States**: Standard "No passes linked" message.
- **Missing Error States**: Alerts on recharge errors.
- **Accessibility Issues**: Screen-readers struggle with the barcode layout.
- **Responsive Issues**: Barcode layout breaks on screens narrower than 320px.
- **Performance Issues**: Excellent load performance.
- **Animations**: Subtle card flip transitions.
- **Overall UI Score**: **8.5/10** (Premium-feeling card graphics and solid recharge interface).

---

## Page 15: Vault Account Transactions (`app/vault/transactions/page.tsx`)

- **Components**: `VaultTransactionsPage`.
- **Reusable Components**: `AppShell`, `GlassCard`.
- **Unused Components**: None.
- **Dead Code**: None.
- **Duplicate Components**: Transaction card matches style formats from notifications list page.
- **Missing Components**: Filter transactions by date range options.
- **Static Data**: Transaction lists headers.
- **Dynamic Data**: Money transaction records logs.
- **State Management**: Local list arrays state.
- **API Hooks**: Wallet transactions query.
- **Missing API Hooks**: Download transactional summaries.
- **Missing Skeletons**: Transactions row shimmers.
- **Missing Empty States**: Visual empty states.
- **Missing Error States**: Silent loading hangs.
- **Accessibility Issues**: Missing table focus markers.
- **Responsive Issues**: Dense transaction table columns hide on mobile portrait screens.
- **Performance Issues**: Fast loading.
- **Animations**: Smooth page load.
- **Overall UI Score**: **8.0/10** (Clean financial details log table, but lacks advanced search options).

---

## Page 16: Vault Payment Sources (`app/vault/wallet/page.tsx`)

- **Components**: `VaultWalletPage`, `PaymentMethodModal`.
- **Reusable Components**: `GlassCard`.
- **Unused Components**: None.
- **Dead Code**: Legacy payment forms.
- **Duplicate Components**: Delete prompt triggers.
- **Missing Components**: Interactive credit card number validator masks.
- **Static Data**: Card provider listings.
- **Dynamic Data**: Linked cards, UPI IDs, digital wallets list.
- **State Management**: Coordinated via local payment states.
- **API Hooks**: `walletService` client.
- **Missing API Hooks**: Linked bank balance checker hook.
- **Missing Skeletons**: Payment sources block skeletons.
- **Missing Empty States**: Text fallbacks on empty groups.
- **Missing Error States**: Alerts on saving failures.
- **Accessibility Issues**: Inputs lack explicit labels on modal forms.
- **Responsive Issues**: Grid cards warp spacing unevenly on medium tablets.
- **Performance Issues**: Fast loading speeds.
- **Animations**: Scale-up modal overlays.
- **Overall UI Score**: **8.3/10** (Clean interface, very secure layout design, but requires inline validation enhancements).
