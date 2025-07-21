
// Core Product information (stored in 'products' table)
export interface Product {
  id: string; // UUID from Supabase, primary key
  name?: string | null;
  barcode: string;
  productCode: string; // Internal SKU, UNIQUE
  portfolioId?: string | null; // FK to a 'portfolios' table
  description?: string | null;
  properties?: Record<string, any> | null; // JSONB for product properties, was 'dimensions'
  imageUrl?: string | null; // Direct image URL for the core product (coalesced with primary listing image by service)
  isActive: boolean; // Default true
  createdOn?: string; // ISO string timestamp (created_on in DB)
  modifiedOn?: string | null; // ISO string timestamp (modified_on in DB)

  // Depletion Report related fields now directly on Product
  associatedProducts?: string[] | null;
  localWarehouseLeadTime?: number | null; // Default 14
  reorderLeadTime?: number | null; // Default 100

  // --- Fields below are dynamically populated for UI from its primary ProductListing.data by services ---
  market?: string | null; // Market name
  marketDomainIdentifier?: string | null; // e.g., www.amazon.co.uk, from primary listing's market
  price?: number | null; // Selling price from primary listing
  currency?: string | null; // Currency symbol from primary listing
  url?: string | null; // URL of the primary listing
  asinCode?: string | null; // The ASIN specific to this product's primary listing

  // BSR Fields from primary listing
  rootBsCategory?: string | null;
  rootBsRank?: number | null;
  bsCategory?: string | null;
  bsRank?: number | null;
  subcategoryRanks?: Array<{ subcategoryName: string; subcategoryRank: number; }> | null;

  // Listing-specific details populated from primary listing
  brand?: string | null;
  sellerName?: string | null; // From ProductListingData.sellerName
  category?: string | null; // From ProductListingData.category
  categories?: string[] | null; // From ProductListingData.categories
  listingImages?: string[] | null; // From ProductListingData.images (distinct from core Product.imageUrl)
  initial_price?: number | null;
  deal_type?: string | null;
  ships_from?: string | null;
  buybox_seller?: string | null; // From ProductListingData.buybox_seller
  delivery?: string[] | null;
  targetAudience?: string | null;
  keywords?: string | null;

  // Common tracking fields from primary listing
  attentionNeeded?: boolean;
  dataAiHint?: string | null;
  lastUpdated?: string | null; // From primary listing

  // Populated by joining/fetching ProductListing(s)
  product_listings?: ProductListing[]; // Holds all listings (own and competitor) for this product.
  competitorListings?: ProductListing[]; // Populated in getProductByIdWithListings specifically for competitor=true

  // Populated for dashboard display - manager of the primary listing
  primaryListingManagerName?: string | null;
  managerId?: string | null; // managerId of the primary listing, used for filtering & edit modal prefill
}

// Represents an entry in the 'product_listings' table
export interface ProductListing {
  id: string; // UUID from Supabase, primary key
  productId: string; // Foreign key to 'products' table
  marketId: string; // Foreign key to 'markets' table
  managerId: string; // Foreign key to 'managers' table (REQUIRED)
  data: ProductListingData; // JSONB field for market-specific details
  isCompetitor: boolean; // Default false
  createdOn?: string; // ISO string timestamp (created_on in DB)
  updatedOn?: string; // ISO string timestamp (updated_on in DB)
}

// Structure for the 'data' JSONB field in ProductListing
export interface ProductListingData {
  asinCode?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | null; // This should be the final_price from webhook
  currency?: string | null; // Currency code, e.g., "USD", "GBP"
  brand?: string | null;
  sellerName?: string | null; // Fallback for sold by if buybox_seller is not present
  category?: string | null; 
  categories?: string[] | null;
  imageUrl?: string | null; 
  images?: string[] | null;
  url?: string | null; // Product URL on Amazon

  // Market specific info, usually derived by joining with 'markets' table via marketId on ProductListing
  marketName?: string | null; 
  currencySymbol?: string | null; // e.g., "$", "£"
  marketDomainIdentifier?: string | null; 
  
  // Manager specific info, usually derived by joining with 'managers' table via managerId on ProductListing
  managerName?: string | null; 

  // BSR Fields from webhook
  rootBsCategory?: string | null;
  rootBsRank?: number | null;
  bsCategory?: string | null;
  bsRank?: number | null;
  subcategoryRanks?: Array<{ subcategoryName: string; subcategoryRank: number; }> | null;

  // Additional fields for competitor table display from webhook
  initial_price?: number | null; // List price
  deal_type?: string | null;
  ships_from?: string | null; // Dispatched from
  buybox_seller?: string | null; // Sold by
  delivery?: string[] | null; // Array of delivery strings, parse for "Fastest Delivery"

  attentionNeeded?: boolean; // For our internal tracking
  dataAiHint?: string | null;
  targetAudience?: string | null; // For AI description generation
  keywords?: string | null; // For AI description generation
  lastUpdated?: string | null; // Timestamp of last webhook update for this listing

  [key: string]: any; // Allow any other fields from Bright Data
}

// Represents an entry in the 'external_api_data' table
export interface ExternalApiData {
  id: string; // UUID from Supabase, primary key
  productListingId: string; // Foreign key to 'product_listings' table
  provider?: string | null;
  data?: Record<string, any> | null; // Raw JSON payload
  createdAt?: string; // ISO string timestamp (created_at in DB)
}

// Matches 'markets' table
export interface MarketSetting {
  id: string; // UUID from Supabase
  marketName: string;
  currencySymbol: string;
  domainIdentifier: string; // e.g., "https://www.amazon.com" or "www.amazon.com"
  isActive: boolean;
  createdOn?: string;
  modifiedOn?: string | null;
}

// Matches 'managers' table (was OwnerSetting)
export interface ManagerSetting {
  id: string; // UUID from Supabase
  name: string;
  role?: string | null;
  isActive: boolean;
  createdOn?: string;
  modifiedOn?: string | null;
}

// Matches 'portfolios' table
export interface PortfolioSetting {
    id: string;
    name: string;
    createdOn?: string;
    modifiedOn?: string | null;
}

// New type for Marketing Data
export interface MarketingDataEntry {
  id?: number; // Auto-incremented by Supabase
  date?: string | null; // Store as ISO string or YYYY-MM-DD
  asin?: string | null;
  productCode?: string | null;
  productDescription?: string | null;
  person?: string | null; // This will be used for "Owner" filter
  portfolio?: string | null; // This will be used for "Portfolio" filter
  subPortfolio?: string | null;
  totalQtySold?: number | null;
  totalAdvUnitsSold?: number | null;
  totalRevenueExVatCp?: number | null;
  totalSalesRevenueExVatSp?: number | null;
  totalAdvSpend?: number | null;
  totalAdvSales?: number | null;
  perUnitAdvSpendOnTotalQtySold?: number | null;
  perUnitAdvSpendOnAdvQtySold?: number | null;
  marketingPercent?: number | null;
  acosPercent?: number | null;
  zeroAdvProfitSc?: number | null;
  zeroAdvProfitVc?: number | null;
  totalZeroAdvGrossProfit?: number | null;
  totalGp?: number | null;
  gpPercent?: number | null;
  fbaStock?: number | null;
  bwwActualStock?: number | null;
  vcStock?: number | null;
  totalStock?: number | null;
  moh?: number | null;
  advMarketplace?: string | null;
  createdAt?: string | null; // Handled by Supabase default

  // Add any other fields if "Total Adv Sales per unit" and "Adv Spend on Total Qty Sold" are truly new
  // For now, assuming they map to perUnitAdvSpendOnAdvQtySold and perUnitAdvSpendOnTotalQtySold respectively
}

// For server-side fetch options
export interface FetchMarketingDataParams {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  globalFilter?: string;
  selectedDatePreset?: string;
  customDateRange?: DateRange;
  selectedOwner?: string;
  selectedPortfolio?: string;
}
// Forward declaration for SortingState and DateRange if not already globally available
// Minimal type definition if full import isn't desired here.
export type SortingState = Array<{ id: string; desc: boolean }>;
export type DateRange = { from?: Date; to?: Date };


// Depletion Report and Sales Target Types

// Core fields for depletion that are now part of the Product interface
// This type is used by the modal and save action to group these specific fields.
export interface ProductDepletionCoreData {
  associatedProducts?: string[] | null;
  localWarehouseLeadTime?: number | null;
  reorderLeadTime?: number | null;
}

// For fetching depletion data for a product, combining product fields and sales targets
// This is what the fetch action will return and what the modal will use to populate.
export interface DepletionData extends ProductDepletionCoreData {
  productId: string;
  salesTargets: SalesTarget[];
}


export interface SalesTarget {
  id?: string; // UUID, PK for sales_targets table (client-side generated for new items)
  productId: string; // FK to products.id (will be set by server)
  startDate: string; // DATE (YYYY-MM-DD)
  endDate: string; // DATE (YYYY-MM-DD)
  salesForecast: number; // INTEGER, renamed from salesTarget
  createdOn?: string;
  modifiedOn?: string | null;
}

export type SalesTargetInput = Omit<SalesTarget, 'id' | 'productId' | 'createdOn' | 'modifiedOn'> & {
  clientId?: string; // For client-side identification before saving
};
