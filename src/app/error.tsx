"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-24">
      <h1 className="text-4xl">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-muted">
        The page failed to render. You can try again, or go back to a working page.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">Back home</Link>
      </div>
    </div>
  );
}
