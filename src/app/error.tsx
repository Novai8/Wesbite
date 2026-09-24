"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error;
  }, [error]);

  return (
    <main className="container-page py-24">
      <h1 className="text-4xl font-medium tracking-tight">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted">
        The page failed to render. You can try again, or go back to a working page.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  );
}
