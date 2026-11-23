export type ApprovalStatus = "approved" | "pending" | "rejected";

export type DataSource = "manual" | "api" | "csv_import" | "n8n_workflow";

/**
 * Lifecycle of a generated 3D product model.
 *
 * `image_fallback` means generation was deliberately skipped (for example a
 * placeholder or non-raster image) and the original product photo is shown
 * instead. It is a terminal state, not an error to retry.
 */
export type ModelStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "quota_exhausted"
  | "image_fallback";

export type ModelFormat = "glb";

export type ModelType = "single_image_generative" | "manual";

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
  /** Public URL of the generated GLB. Only set when modelStatus is completed. */
  modelUrl?: string;
  modelFormat?: ModelFormat;
  modelType?: ModelType;
  modelStatus?: ModelStatus;
  /** e.g. `huggingface:stabilityai/stable-fast-3d` */
  modelProvider?: string;
  modelGeneratedAt?: string;
  /** Human-readable failure reason. Never contains credentials or internal research data. */
  modelError?: string;
  /** SHA-256 of the source image, used to deduplicate generation jobs. */
  sourceImageHash?: string;
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
