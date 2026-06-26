import TripCard from '@/components/ui-custom/trip-card';

export default function ItineraryPreview() {
  return (
    <section className="py-20">
      <h2 className="text-3xl font-bold">AI Generated Itineraries</h2>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <TripCard title="7 Days Japan" budget="₹1,20,000" />

        <TripCard title="5 Days Bali" budget="₹60,000" />

        <TripCard title="4 Days Dubai" budget="₹75,000" />
      </div>
    </section>
  );
}
