import {
  getAffiliateButtonState,
  type ProductAvailability,
} from "@/lib/affiliate-availability";

export function AffiliateButton({
  href,
  availability,
}: {
  href: string;
  availability: ProductAvailability;
}) {
  const state = getAffiliateButtonState(availability);

  if (state.kind === "disabled") {
    return (
      <span className="btn btn-secondary cursor-not-allowed opacity-60" aria-disabled="true">
        {state.label}
      </span>
    );
  }

  return (
    <a href={href} rel="nofollow sponsored noopener" className="btn btn-primary">
      {state.label}
    </a>
  );
}
