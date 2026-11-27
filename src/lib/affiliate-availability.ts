export type ProductAvailability = "in_stock" | "out_of_stock" | "unknown";

export type AffiliateButtonState =
  | { kind: "disabled"; label: "Currently unavailable" }
  | {
      kind: "link";
      label: "Buy at merchant — Affiliate" | "Check availability at merchant — Affiliate";
    };

/**
 * Unknown stock must never be presented as confirmed out of stock.
 * Keep the tracked merchant link available so the shopper can check the
 * seller's live stock and delivery options. Only an explicit out_of_stock
 * source value disables the purchase action.
 */
export function getAffiliateButtonState(
  availability: ProductAvailability,
): AffiliateButtonState {
  if (availability === "out_of_stock") {
    return { kind: "disabled", label: "Currently unavailable" };
  }

  if (availability === "in_stock") {
    return { kind: "link", label: "Buy at merchant — Affiliate" };
  }

  return { kind: "link", label: "Check availability at merchant — Affiliate" };
}
