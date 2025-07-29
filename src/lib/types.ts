

// Core Product information (stored in 'products' table)
export interface Product {
  id: string; // UUID from Supabase, primary key
  name?: string | null;
  barcode: string;
  productCode: string; // Internal SKU, UNIQUE
  portfolioId?: string | null; // FK to a 'portfolios' table
  portfolioName?: string | null; // Populated from join
  subPortfolioId?: string | null; // FK to a 'portfolios' table
  subPortfolioName?: string | null; // Populated from join
  description?: string | null;
  properties?: Record<string, any> | null; // JSONB for product properties, was 'dimensions'
  imageUrl?: string | null;
  brand?: string | null;
  keywords?: string[] | null; // Array of UUIDs linking to 'keywords' table
  isActive: boolean; // Default true
  createdOn?: string; // ISO string timestamp (created_on in DB)
  modifiedOn?: string | null; // ISO string timestamp (modified_on in DB)

  // Depletion Report related fields now directly on Product
  associatedProducts?: string[] | null; // Now stores product IDs (UUIDs)
  localWarehouseLeadTime?: number | null; // Default 14
  reorderLeadTime?: number | null; // Default 100

  // --- Fields below are dynamically populated for UI from its primary ProductListing by services ---
  market?: string | null; // Market name
  marketId?: string | null; // UUID of the primary listing's market
  marketDomainIdentifier?: string | null; // e.g., www.amazon.co.uk, from primary listing's market
  price?: number | null; // current_price from primary listing
  listPrice?: number | null; // list_price from primary listing
  discount?: number | null; // discount from primary listing
  currency?: string | null; // Currency symbol from market setting
  url?: string | null; // URL from primary listing
  asinCode?: string | null; // asin from primary listing
  
  dealType?: string | null;
  dispatchedFrom?: string | null;
  soldBy?: string | null;
  deliveryInfo?: string | null;
  categoryRanks?: Record<string, any> | null;

  // AI-related fields from primary listing's data field
  targetAudience?: string | null; 

  // Common tracking fields from primary listing
  attentionNeeded?: boolean;
  dataAiHint?: string | null;
  lastUpdated?: string | null; // updated_on from primary listing

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
  asin: string | null;
  currentPrice?: number | null;
  listPrice?: number | null;
  discount?: number | null;
  dealType?: string | null;
  categoryRanks?: Record<string, any> | null; // JSONB
  dispatchedFrom?: string | null;
  soldBy?: string | null;
  deliveryInfo?: string | null;
  brand?: string | null; // Brand name, if applicable
  productName?: string | null; // Name of the product, if applicable
  isCompetitor: boolean; // Default false
  createdOn?: string; // ISO string timestamp (created_on in DB)
  updatedOn?: string; // ISO string timestamp (updated_on in DB)
  data?: any;
}

// Structure for the 'data' JSONB field in ProductListing (for unstructured data)
export interface ProductListingData {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  url?: string | null;

  // Fields below are derived from joins and are for convenience in UI components
  marketName?: string | null;
  currencySymbol?: string | null;
  marketDomainIdentifier?: string | null;
  managerName?: string | null;
  
  // AI-related fields
  targetAudience?: string | null; 

  // Other miscellaneous data from webhook
  [key: string]: any; 
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
    parentId?: string | null;
    createdOn?: string;
    modifiedOn?: string | null;
}

// Matches 'product_carton_specifications' table
export interface ProductCartonSpecification {
  id: string; // UUID from Supabase
  productId: string; // FK to products.id
  marketId: string; // FK to markets.id
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  cartonsPerContainer?: number | null;
  cbmPerCarton?: number | null;
  unitsPerCarton?: number | null;
  cartonsPerPallet?: number | null;
  unitsPerPallet?: number | null;
  palletWeightKg?: number | null;
  palletLoadingHeightCm?: number | null;
  containerQuantity?: number | null;
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
  rowIndexInExcel?: number;
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
  productCode?: string | null;
}
// Forward declaration for SortingState and DateRange if not already globally available
// Minimal type definition if full import isn't desired here.
export type SortingState = Array<{ id: string; desc: boolean }>;
export type DateRange = { from?: Date; to?: Date };


// Depletion Report and Sales Target Types

// Core fields for depletion that are now part of the Product interface
// This type is used by the modal and save action to group these specific fields.
export interface ProductDepletionCoreData {
  associatedProducts?: string[] | null; // Array of product IDs
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
  channel?: string | null; // Optional channel field
  createdOn?: string;
  modifiedOn?: string | null;
}

export type SalesTargetInput = Omit<SalesTarget, 'id' | 'createdOn' | 'modifiedOn'> & {
  clientId?: string; // For client-side identification before saving
  productCode?: string; // For error reporting
  rowIndexInExcel?: number; // For error reporting
};

// New type for Stock Data, matching public.stocks table
export interface StockEntry {
  id?: string; // UUID, primary key
  productCode: string; // Unique identifier
  asin?: string | null;
  productDescription?: string | null;
  person?: string | null;
  portfolio?: string | null;
  subPortfolio?: string | null;
  bwwActualStock?: number | null;
  bwwAvailableStock?: number | null; // From "BWW ( Available Stock )"
  globalStockBww?: number | null;
  bwwHarrierAvailableStock?: number | null;
  bwwStirlingAvailableStock?: number | null;
  fbaGbStock?: number | null;
  fbaDeStock?: number | null;
  fbaFrStock?: number | null;
  fbaItStock?: number | null;
  fbaEsStock?: number | null;
  fbaNlStock?: number | null;
  fbaPlStock?: number | null;
  vcStock?: number | null;
  updatedOn?: string | null; // ISO string timestamp
  createdOn?: string; // ISO string timestamp
  rowIndexInExcel?: number;
}

// Type for parsed Product + Listing + Carton data from Excel
export interface ParsedProductListingUploadRow {
  rowIndexInExcel: number; // To help map errors back to the source file

  // Product fields
  productCode: string; // Mandatory (SKU)
  barcode?: string | null; // Mandatory for new products
  productName?: string | null;
  productDescription?: string | null;
  productImageUrl?: string | null;
  productPortfolioName?: string | null; // To be looked up against portfolios table
  productSubPortfolioName?: string | null; // To be looked up against portfolios table
  productPropertiesLengthCm?: number | null;
  productPropertiesWidthCm?: number | null;
  productPropertiesHeightCm?: number | null;
  productPropertiesWeightKg?: number | null;
  brand?: string | null;

  // Listing fields
  marketNameOrCode: string; // Mandatory (e.g., "UK" or "www.amazon.co.uk")
  managerName: string; // Mandatory
  asin?: string | null;

  // Carton Specification fields
  cartonLengthCm?: number | null;
  cartonWidthCm?: number | null;
  cartonHeightCm?: number | null;
  cartonWeightKg?: number | null;
  cartonsPerContainer?: number | null;
  cbmPerCarton?: number | null;
  unitsPerCarton?: number | null;
  cartonsPerPallet?: number | null;
  unitsPerPallet?: number | null;
  palletWeightKg?: number | null;
  palletLoadingHeightCm?: number | null;
  containerQuantity?: number | null;
  cbm40hq?: number | null;
  containerWeight?: number | null;

  // Depletion related fields
  associatedProductsSkuList?: string | null; // Comma-separated SKUs
  localWarehouseLeadTimeDays?: number | null;
  reorderingLeadTimeDays?: number | null;

  // Keyword and competitor fields
  keywordsRaw?: string | null;
  competitorDetails?: string | null;
}

export interface ProductListingUploadError {
  rowIndexInExcel: number;
  productCode?: string | null;
  asin?: string | null;
  market?: string | null;
  error: string;
  fieldName?: string;
  invalidValue?: any;
  expectedFormat?: string;
}

export interface ProductListingUploadSummary {
  fileName?: string;
  totalRowsProcessed: number;
  processedCount?: number; // Number of rows successfully processed/inserted
  productsCreated: number;
  productsUpdated: number;
  listingsCreated: number;
  listingsUpdated: number;
  cartonSpecsSaved: number; // Could be created or updated
  errorsEncountered: ProductListingUploadError[];
}

// Keyword and SOV related types (for Product Detail page)
export interface TopKeyword {
  keyword: string;
  search_volume: number | null; // Changed from searchVolume
}

export interface KeywordMetric {
  organic_rank?: number | null; // Changed from organicRank
  sov_percentage?: number | null; // Changed from sovPercentage
  placement_id?: string | null; // Changed from placementId
  placement_name?: string | null; // Changed from placementName
}

// Maps a composite key (ASIN_Keyword) to its metrics
export interface KeywordMetricsMap {
  [asinKeywordKey: string]: KeywordMetric;
}

export interface FetchTopKeywordsParams {
  date: string; // YYYY-MM-DD
  marketId: string;
}

export interface FetchKeywordMetricsParams {
  asins: string[];
  keywords: string[];
  date: string; // YYYY-MM-DD
  placement: string | null; // Specific placement_id or null for all/aggregated
  marketId: string;
}

// Type for 'owner' settings, using the 'managers' table schema.
// Kept for backward compatibility if 'OwnerSetting' is used elsewhere,
// but it maps to 'ManagerSetting' in practice.
export type OwnerSetting = ManagerSetting;

// Upload types for useExcelUploadHandler
export type UploadType = 
  | 'advertisement' 
  | 'productListing' 
  | 'salesForecast' 
  | 'keyword' 
  | 'salesReport_vc' 
  | 'salesReport_sc'
  | 'stocksReport_bww'
  | 'stocksReport_vc'
  | 'stocksReport_sc_fba'
  | 'brandAnalytics';


// Type for Sales Forecast Upload from Excel
export interface ParsedSalesForecastUploadRow {
  rowIndexInExcel: number;
  sku: string; // Corresponds to products.product_code
  startDate: string; // Should be parsed to YYYY-MM-DD string
  endDate: string; // Should be parsed to YYYY-MM-DD string
  expectedSalesPerDay: number; // Corresponds to sales_targets.sales_forecast
  channel?: string | null; // Optional
}

export interface FullDepletionReportEntry {
  // Key for React
  id: string;
  
  // Identifying info
  productId: string;
  productCode: string;
  productName: string | null;
  imageUrl: string | null;

  // Date-specific info
  forecastDate: string; // YYYY-MM-DD
  dayName: string | null;
  isWeekend: boolean;
  
  // Forecast and stock numbers
  dailyForecast: number | null;
  remainingStock: number | null;

  // Status
  statusFlag: string | null; // 'Depletion Alert' | 'Place Order'

  // New fields from view
  currentStock?: number | null;
  reorderLeadTime?: number | null;
  poDate?: string | null;
  etaDate?: string | null;
  incomingQuantity?: number | null;
  requiredOrderQuantity?: number | null;
  updatedAt?: string | null; // The new field
}


export interface FetchDepletionReportParams {
  pageIndex: number;
  pageSize: number;
  sorting: SortingState;
  productCode?: string;
}

// Keyword Master
export interface Keyword {
  id: string;
  keyword: string;
  portfolio_id?: string | null;
  portfolioName?: string | null;
  subPortfolioName?: string | null;
  subportfolio_id?: string | null;
  priority_id?: string | null;
  createdAt?: string;
  updatedOn?: string | null;
}

export interface Priority {
    priority_id: string;
    priority_name: string;
    priority_description?: string | null;
    pattern_id?: string | null;
    is_active: boolean;
}

export interface AssociatedStockItem {
  productId: string;
  productCode: string;
  stockEntry: StockEntry | null;
  productName?: string | null;
  brand?: string | null;
  asinCode?: string | null;
}

export interface PlacementType {
  placement_id: number;
  placement_name: string;
}

export interface ParsedKeywordUploadRow {
    rowIndexInExcel: number;
    keyword: string;
}

export interface KeywordWithVolume {
  id: string;
  keyword: string;
  searchVolume: number | null;
}
// Sales Report Types
export interface Channel {
    id: string;
    channelCode: string;
    channelName: string;
    channelType: string;
    marketId: string;
    isActive: boolean;
    defaultLeadTimeDays?: number | null;
    costPerUnit?: number | null;
    createdOn?: string;
    modifiedOn?: string | null;
}

export interface DailySale {
    id: string;
    productId: string;
    channelId: string | null;
    saleDate: string; // YYYY-MM-DD
    unitsSold: number;
    revenueAmount?: number | null;
    createdOn?: string;
}

export interface ParsedVcSaleRow {
    rowIndexInExcel: number;
    ASIN: string;
    'Ordered units': number;
    Date: string; // will be parsed
}

export interface ParsedScSaleRow {
    rowIndexInExcel: number;
    'purchase-date': string; // will be parsed
    sku: string;
    asin: string;
    quantity: number;
}


// Stocks Report Upload Types
export interface ParsedBwwStockRow {
    rowIndexInExcel: number;
    productCode: string;
    bwwActualStock: number;
}

export interface ParsedVcStockRow {
    rowIndexInExcel: number;
    asin: string;
    vcStock: number;
}

export interface ParsedScFbaStockRow {
    rowIndexInExcel: number;
    asin: string;
    fbaStock: number;
}

// Channel Stocks Type
export interface ChannelStock {
    id: string;
    productId: string;
    channelId: string;
    currentStock: number;
    reservedStock?: number | null;
    inboundStock?: number | null;
    strandedStock?: number | null;
    lastSyncDate?: string | null;
    lastUpdated?: string;
    createdOn?: string;
}

export interface PastSalesData {
  date: string; // YYYY-MM-DD
  day: string; // 'Mon', 'Tue', etc.
  unitsSold: number;
  remainingStock: number;
  dailyForecast?: number | null;
}

export interface UpcomingPurchaseOrder {
  poDate: string | null;
  etaDate: string | null;
  incomingQty: number | null;
}

// Updated type for the joined Brand Analytics data
export interface BrandAnalyticsData {
  'Search Term': string | null;
  'Brand': string | null;
  'Competitor ASIN': string | null;
  'Keyword Status': string | null;
  'ASIN Status': string | null;
  'Title'?: string | null;
  'Type'?: string | null;
  'Search Frequency Rank': number | null;
  'Click Share (ASIN)': number | null;
  'Conversion Share (ASIN)': number | null;
  'Top Clicked Brand': string | null;
  'Reporting Date'?: string | null;
  'Amazon Choice': boolean | null;
  'Organic Rank': number | null;
  'Spons Rank': number | null;
  'All Rank': number | null;
  'SOV Ads Top of Search': number | null;
  'SOV (TOS & 4 stars and above Ads)': number | null;
  'SOV Ads Rest of Search (> 20 ranks)': number | null;
  'SOV Ads All': number | null;
  'SOV Only Organic': number | null;
  'SOV All (both Ads and Organic)': number | null;
  'Crawl Timestamp'?: string | null;
}
  
