export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </section>
  );
}
