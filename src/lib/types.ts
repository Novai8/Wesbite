export type ApprovalStatus = "approved" | "pending" | "rejected";

export type DataSource = "manual" | "api" | "csv_import" | "n8n_workflow";

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
  programSlug: string;
  affiliateUrl: string;
  sourceUrl?: string;
  price: number;
  currency: "USD" | "EUR" | "GBP";
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
  currency: "USD" | "EUR" | "GBP";
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
