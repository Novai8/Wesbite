import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="content" className="container-page py-24">
      <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
        404
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">This page is not in the prototype.</h1>
      <p className="mt-3 max-w-md text-muted">
        The link may be old, or the pattern no longer exists in the library.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/demos">View patterns</Link>
        </Button>
      </div>
    </main>
  );
}
