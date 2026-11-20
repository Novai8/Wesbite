const LABEL = "Buy at merchant — Affiliate";

export function AffiliateButton({
  href,
  available,
}: {
  href: string;
  available: boolean;
}) {
  if (!available) {
    return (
      <span className="btn btn-secondary cursor-not-allowed opacity-60" aria-disabled="true">
        Currently unavailable
      </span>
    );
  }

  return (
    <a href={href} rel="nofollow sponsored noopener" className="btn btn-primary">
      {LABEL}
    </a>
  );
}
