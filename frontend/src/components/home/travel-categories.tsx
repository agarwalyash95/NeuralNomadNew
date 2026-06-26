import GlassCard from '@/components/ui-custom/glass-card';

const categories = ['Luxury', 'Adventure', 'Family', 'Weekend', 'Business', 'Honeymoon'];

export default function TravelCategories() {
  return (
    <section className="py-20">
      <h2 className="text-3xl font-bold">Explore by Category</h2>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {categories.map((item) => (
          <GlassCard key={item} className="p-8 text-center">
            <h3 className="text-xl font-semibold">{item}</h3>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
