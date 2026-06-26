import GradientButton from '@/components/ui-custom/gradient-button';

export default function CTASection() {
  return (
    <section className="py-24 text-center">
      <h2 className="text-5xl font-bold">Ready for your next adventure?</h2>

      <p className="mt-4 text-slate-500">Let NeuralNomad build your perfect trip.</p>

      <div className="mt-8">
        <GradientButton>Start Planning Now</GradientButton>
      </div>
    </section>
  );
}
