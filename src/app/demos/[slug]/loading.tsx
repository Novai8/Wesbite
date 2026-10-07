export default function DemoLoading() {
  return (
    <main id="content" className="container-page py-10 sm:py-14" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 rounded-full skeleton" />
      <div className="mt-6 h-12 max-w-xl rounded-2xl skeleton" />
      <div className="mt-4 h-6 max-w-lg rounded-full skeleton" />
      <div className="mt-6 aspect-video rounded-[1.1rem] skeleton" />
      <p className="sr-only">Loading demo</p>
    </main>
  );
}
