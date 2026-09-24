export default function DemosLoading() {
  return (
    <main className="container-page py-12 sm:py-16" aria-busy="true" aria-live="polite">
      <div className="h-4 w-20 rounded-full bg-accent-soft" />
      <div className="mt-4 h-12 max-w-lg rounded-2xl bg-white" />
      <div className="mt-8 h-48 rounded-[1.35rem] bg-white" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-72 rounded-[1.35rem] bg-white" />
        <div className="h-72 rounded-[1.35rem] bg-white" />
        <div className="hidden h-72 rounded-[1.35rem] bg-white xl:block" />
      </div>
      <p className="sr-only">Loading demos</p>
    </main>
  );
}
