export default function DemosLoading() {
  return (
    <main id="content" className="container-page py-12 sm:py-16" aria-busy="true" aria-live="polite">
      <div className="h-4 w-20 rounded-full skeleton" />
      <div className="mt-4 h-12 max-w-lg rounded-2xl skeleton" />
      <div className="mt-8 h-48 rounded-[1.35rem] skeleton" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-72 rounded-[1.35rem] skeleton" />
        <div className="h-72 rounded-[1.35rem] skeleton" />
        <div className="hidden h-72 rounded-[1.35rem] skeleton xl:block" />
      </div>
      <p className="sr-only">Loading demos</p>
    </main>
  );
}
