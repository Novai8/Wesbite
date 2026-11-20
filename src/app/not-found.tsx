import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl">This page didn&apos;t make the shortlist.</h1>
      <p className="mt-3 max-w-md text-muted">
        The link may be old, or the page moved. Try the catalogue or the
        assistant instead.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/discover" className="btn btn-primary">Browse the catalogue</Link>
        <Link href="/assistant" className="btn btn-secondary">Ask the assistant</Link>
      </div>
    </div>
  );
}
