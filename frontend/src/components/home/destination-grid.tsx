import DestinationCard from '@/components/ui-custom/destination-card';
import SectionHeader from '@/components/ui-custom/section-header';

export default function DestinationGrid() {
  return (
    <section className="py-20">
      <SectionHeader title="Trending Destinations" subtitle="Recommended by NeuralNomad AI" />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <DestinationCard name="Tokyo" country="Japan" price="₹89,999" days="7 Days" />

        <DestinationCard name="Bali" country="Indonesia" price="₹45,000" days="5 Days" />

        <DestinationCard name="Dubai" country="UAE" price="₹39,999" days="4 Days" />

        <DestinationCard name="Singapore" country="Singapore" price="₹55,000" days="5 Days" />
      </div>
    </section>
  );
}
