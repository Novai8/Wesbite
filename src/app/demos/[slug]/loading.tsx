export default function DemoLoading() {
  return (
    <main className="container-page py-10 sm:py-14" aria-busy="true" aria-live="polite">
      <div className="h-4 w-24 rounded-full bg-orange-100" />
      <div className="mt-6 h-12 max-w-xl rounded-2xl bg-white" />
      <div className="mt-4 h-6 max-w-lg rounded-full bg-orange-50" />
      <div className="mt-6 aspect-video rounded-[1.1rem] bg-white" />
      <p className="sr-only">Loading demo</p>
    </main>
  );
}
