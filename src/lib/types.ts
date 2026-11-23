export type ApprovalStatus = "approved" | "pending" | "rejected";

export type DataSource = "manual" | "api" | "csv_import" | "n8n_workflow";

/**
 * Programme identifiers are plain strings so new affiliate networks can be
 * added without widening a union. Known values today: `aliexpress`, `admitad`.
 */
export type ProgramSlug = string;

export interface Category {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  categorySlug: string;
  subcategory?: string;
  imageUrls: string[];
  merchant: string;
  programSlug: ProgramSlug;
  affiliateUrl: string;
  sourceUrl?: string;
  price: number;
  /** ISO 4217 code. Wildcard keeps room for Admitad programme currencies. */
  currency: string;
  previousPrice?: number;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
  availability: "in_stock" | "out_of_stock" | "unknown";
  region: string[];
  keywords: string[];
  useCases: string[];
  budgetTier: "budget" | "mid" | "premium";
  priceVerifiedAt: string;
  approvalStatus: ApprovalStatus;
  dataSource: DataSource;
  createdAt: string;
  updatedAt: string;
  /** Affiliate network that supplied this record, when it was imported. */
  source?: "manual" | "aliexpress" | "admitad";
  /** Stable id from the source network (e.g. Admitad feed product id). */
  externalProductId?: string;
  /** Admitad advertiser / campaign id. */
  advertiserId?: string;
  /** Pre-discount price, when the feed supplies one. */
  originalPrice?: number;
  /** Last successful sync from the source network. */
  lastSyncedAt?: string;
  /** AI-written copy only. Never a source of product facts. */
  aiHeadline?: string;
  aiDescription?: string;
  aiQualityFlags?: string[];
}

export interface AffiliateProgram {
  slug: string;
  name: string;
  network: string;
  destinationDomain: string;
  active: boolean;
  commissionNote?: string;
}

export interface ShoppingRequest {
  goal: string;
  problem?: string;
  budget?: number;
  currency: string;
  country?: string;
  preferences?: string[];
  mode: "assistant" | "setup-builder" | "problem-solver" | "discover";
}

export interface ScoredProduct {
  product: Product;
  score: number;
  scoreBreakdown: {
    relevance: number;
    budget: number;
    features: number;
    dataQuality: number;
    freshness: number;
    category: number;
  };
  reasons: string[];
}

export interface Recommendation {
  primary: ScoredProduct;
  alternatives: ScoredProduct[];
  explanation: string;
  generatedBy: "deterministic" | "groq";
  remainingBudget?: number;
  warnings: string[];
}
