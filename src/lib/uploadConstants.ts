
import type { StockEntry, MarketingDataEntry, ParsedProductListingUploadRow, ParsedSalesForecastUploadRow, ParsedKeywordUploadRow, ParsedVcSaleRow, ParsedScSaleRow, ParsedBwwStockRow, ParsedVcStockRow, ParsedScFbaStockRow } from '@/lib/types';


export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_EXCEL_FORMATS = ".xlsx, .xls";
export const ALLOWED_CSV_FORMATS = ".csv";
export const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv']; // Used for validation messages
export const BATCH_SIZE = 500;

// Stock Report Constants
export const stockSheetHeaderMapping: { [key: string]: keyof StockEntry } = {
    'Product Code': 'productCode', 'ASIN': 'asin', 'Product Description': 'productDescription',
    'Person': 'person', 'Portfolio': 'portfolio', 'Sub Portfolio': 'subPortfolio',
    'BWW Actual Stock': 'bwwActualStock', 'BWW ( Available Stock )': 'bwwAvailableStock',
    'Global Stock-BWW': 'globalStockBww', 'BWW Harrier (Available Stock)': 'bwwHarrierAvailableStock',
    'BWW Stirling (Available Stock)': 'bwwStirlingAvailableStock', 'FBA GB': 'fbaGbStock',
    'FBA DE': 'fbaDeStock', 'FBA FR': 'fbaFrStock', 'FBA IT': 'fbaItStock',
    'FBA ES': 'fbaEsStock', 'FBA NL': 'fbaNlStock', 'FBA PL': 'fbaPlStock', 'VC Stock': 'vcStock',
};
export const stockNumericFields: (keyof StockEntry)[] = [
    'bwwActualStock', 'bwwAvailableStock', 'globalStockBww', 'bwwHarrierAvailableStock',
    'bwwStirlingAvailableStock', 'fbaGbStock', 'fbaDeStock', 'fbaFrStock', 'fbaItStock',
    'fbaEsStock', 'fbaNlStock', 'fbaPlStock', 'vcStock'
];
export const stockMandatoryKey: keyof StockEntry = 'productCode';
export const stockMandatoryName = 'Product Code';


// Advertisement Details Constants
export const advertisementHeaderMapping: { [key: string]: keyof MarketingDataEntry } = {
  'DATE': 'date', 'ASIN': 'asin', 'Product Code': 'productCode', 'Product Description': 'productDescription',
  'Person': 'person', 'Portfolio': 'portfolio', 'Sub Portfolio': 'subPortfolio',
  'Total Qty Sold (SC + VC)': 'totalQtySold', 'Total Adv Units Sold': 'totalAdvUnitsSold',
  'Total Revenue Ex VAT (CP)': 'totalRevenueExVatCp', 'Total Sales Revenue Ex VAT (SP)': 'totalSalesRevenueExVatSp',
  'Total Adv Spend': 'totalAdvSpend', 'Total Adv Sales': 'totalAdvSales',
  'per unit Adv Spend on Total Qty Sold': 'perUnitAdvSpendOnTotalQtySold',
  'per unit Adv Spend on Adv Qty Sold': 'perUnitAdvSpendOnAdvQtySold',
  'Marketing%': 'marketingPercent', 'ACOS%': 'acosPercent',
  'Zero Adv Profit SC': 'zeroAdvProfitSc', 'Zero Adv Profit VC': 'zeroAdvProfitVc',
  'Total (SC + VC) Zero Adv Gross Profit': 'totalZeroAdvGrossProfit', 'Total GP': 'totalGp', 'GP%': 'gpPercent',
  'FBA Stock': 'fbaStock', 'BWW Actual Stock': 'bwwActualStock', 'VC Stock': 'vcStock',
  'Total Stock': 'totalStock', 'MOH': 'moh', 'Adv Marketplace': 'advMarketplace',
};
export const marketingNumericFields: (keyof MarketingDataEntry)[] = [
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalSalesRevenueExVatSp',
  'totalAdvSpend', 'totalAdvSales', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold',
  'marketingPercent', 'acosPercent', 'zeroAdvProfitSc', 'zeroAdvProfitVc',
  'totalZeroAdvGrossProfit', 'totalGp', 'gpPercent', 'fbaStock', 'bwwActualStock',
  'vcStock', 'totalStock', 'moh'
];
export const advertisementMandatoryKey: keyof MarketingDataEntry = 'date';
export const advertisementMandatoryName = 'DATE';


// Product + Listing Template Constants
export const productListingHeaderMapping: { [key: string]: keyof ParsedProductListingUploadRow } = {
  'Product Name (Optional)': 'productName',
  'Product Code (SKU) (Required)': 'productCode',
  'Barcode (GTIN/EAN) (Required)': 'barcode',
  'Product Description (Optional)': 'productDescription',
  'Image URL (Optional)': 'productImageUrl',
  'Portfolio (Optional)': 'productPortfolioName',
  'Sub-Portfolio (Optional)': 'productSubPortfolioName',
  'Item Length (cm) (Optional)': 'productPropertiesLengthCm',
  'Item Width (cm) (Optional)': 'productPropertiesWidthCm',
  'Item Height (cm) (Optional)': 'productPropertiesHeightCm',
  'Item Weight (kg) (Optional)': 'productPropertiesWeightKg',
  'Brand (Optional)': 'brand',
  'Market (Primary Listing) (Required)': 'marketNameOrCode',
  'Manager for this Listing (Required)': 'managerName',
  'ASIN for this Market (Optional but must be unique if provided)': 'asin',
  'Cartons Per Container (Optional)': 'cartonsPerContainer',
  'CBM Per Carton (Optional)': 'cbmPerCarton',
  'Units Per Carton (Optional)': 'unitsPerCarton',
  'Cartons Per Pallet (Optional)': 'cartonsPerPallet',
  'Units Per Pallet (Optional)': 'unitsPerPallet',
  'Pallet Weight (kg) (Optional)': 'palletWeightKg',
  'Pallet Loading Height (cm) (Optional)': 'palletLoadingHeightCm',
  'Container Quantity (Optional)': 'containerQuantity',
  'Carton Length (cm) (Optional)': 'cartonLengthCm',
  'Carton Width (cm) (Optional)': 'cartonWidthCm',
  'Carton Height (cm) (Optional)': 'cartonHeightCm',
  'Carton Weight (kg) (Optional)': 'cartonWeightKg',
  'CBM (40 HQ)': 'cbm40hq', 
  'Container Weight': 'containerWeight',
  'Associated Products (SKUs) (Optional) (Note: Input comma-separated SKUs here)': 'associatedProductsSkuList',
  'Local Warehouse Lead Time (days) (Optional)': 'localWarehouseLeadTimeDays',
  'Re-Ordering Lead Time (days) (Optional)': 'reorderingLeadTimeDays',
  'Keywords (Optional) (comma-separated)': 'keywordsRaw',
  'Keywords': 'keywordsRaw',
  'Competitor Details (ASINs, comma-separated)': 'competitorDetails',
  'Competitors': 'competitorDetails',
  'Competitor Details': 'competitorDetails'
};
export const productListingNumericFields: (keyof ParsedProductListingUploadRow)[] = [
  'productPropertiesLengthCm', 'productPropertiesWidthCm', 'productPropertiesHeightCm', 'productPropertiesWeightKg',
  'cartonLengthCm', 'cartonWidthCm', 'cartonHeightCm', 'cartonWeightKg', 'cbm40hq', 'containerWeight',
  'cartonsPerContainer', 'cbmPerCarton', 'unitsPerCarton',
  'cartonsPerPallet', 'unitsPerPallet', 'palletWeightKg',
  'palletLoadingHeightCm', 'containerQuantity',
  'localWarehouseLeadTimeDays', 'reorderingLeadTimeDays',
];
export const productListingMandatoryKey: keyof ParsedProductListingUploadRow = 'productCode';
export const productListingMandatoryName = 'Product Code (SKU) (Required)';
export const productListingMandatoryKeyBarcode: keyof ParsedProductListingUploadRow = 'barcode';
export const productListingMandatoryNameBarcode = 'Barcode (GTIN/EAN) (Required)';
export const productListingMandatoryKeyMarket: keyof ParsedProductListingUploadRow = 'marketNameOrCode';
export const productListingMandatoryNameMarket = 'Market (Primary Listing) (Required)';
export const productListingMandatoryKeyManager: keyof ParsedProductListingUploadRow = 'managerName';
export const productListingMandatoryNameManager = 'Manager for this Listing (Required)';

// Sales Forecast Constants
export const salesForecastHeaderMapping: { [key: string]: keyof ParsedSalesForecastUploadRow } = {
  'SKU (Product Code)': 'sku',
  'Start Date': 'startDate',
  'End Date': 'endDate',
  'Expected Sales per Day': 'expectedSalesPerDay',
  'Channel': 'channel',
};
export const salesForecastNumericFields: (keyof ParsedSalesForecastUploadRow)[] = ['expectedSalesPerDay'];
export const salesForecastMandatoryKey: keyof ParsedSalesForecastUploadRow = 'sku';
export const salesForecastMandatoryName = 'SKU (Product Code)';
export const salesForecastSecondaryMandatoryKeys: Array<{key: keyof ParsedSalesForecastUploadRow; name: string}> = [
    { key: 'startDate', name: 'Start Date'},
    { key: 'endDate', name: 'End Date'},
    { key: 'expectedSalesPerDay', name: 'Expected Sales per Day'},
];

// Keyword Master Constants
export const keywordHeaderMapping: { [key: string]: keyof ParsedKeywordUploadRow } = {
    'Keyword': 'keyword',
};
export const keywordNumericFields: (keyof ParsedKeywordUploadRow)[] = [];
export const keywordMandatoryKey: keyof ParsedKeywordUploadRow = 'keyword';
export const keywordMandatoryName = 'Keyword';

// Sales Report (VC) Constants
export const salesReportVcHeaderMapping: { [key: string]: keyof ParsedVcSaleRow } = {
  'ASIN': 'ASIN',
  'Ordered units': 'Ordered units',
  'Date': 'Date',
};
export const salesReportVcNumericFields: (keyof ParsedVcSaleRow)[] = ['Ordered units'];
export const salesReportVcMandatoryKey: keyof ParsedVcSaleRow = 'ASIN';
export const salesReportVcMandatoryName = 'ASIN';
export const salesReportVcSecondaryMandatoryKeys: Array<{key: keyof ParsedVcSaleRow; name: string}> = [
    { key: 'Ordered units', name: 'Ordered units' },
    { key: 'Date', name: 'Date' }
];

// Sales Report (SC) Constants
export const salesReportScHeaderMapping: { [key: string]: keyof ParsedScSaleRow } = {
  'purchase-date': 'purchase-date',
  'sku': 'sku',
  'asin': 'asin',
  'quantity': 'quantity',
};
export const salesReportScNumericFields: (keyof ParsedScSaleRow)[] = ['quantity'];
export const salesReportScMandatoryKey: keyof ParsedScSaleRow = 'asin';
export const salesReportScMandatoryName = 'asin';
export const salesReportScSecondaryMandatoryKeys: Array<{key: keyof ParsedScSaleRow; name: string}> = [
    { key: 'purchase-date', name: 'purchase-date' },
    { key: 'quantity', name: 'quantity' }
];

// Stocks Report (BWW) Constants
export const stocksReportBwwHeaderMapping: { [key: string]: keyof ParsedBwwStockRow } = {
    'Product Code': 'productCode',
    'BWW Actual Stock': 'bwwActualStock',
};
export const stocksReportBwwNumericFields: (keyof ParsedBwwStockRow)[] = ['bwwActualStock'];
export const stocksReportBwwMandatoryKey: keyof ParsedBwwStockRow = 'productCode';
export const stocksReportBwwMandatoryName = 'Product Code';

// Stocks Report (VC) Constants
export const stocksReportVcHeaderMapping: { [key: string]: keyof ParsedVcStockRow } = {
    'ASIN': 'asin',
    'Sellable On Hand Units': 'vcStock',
};
export const stocksReportVcNumericFields: (keyof ParsedVcStockRow)[] = ['vcStock'];
export const stocksReportVcMandatoryKey: keyof ParsedVcStockRow = 'asin';
export const stocksReportVcMandatoryName = 'ASIN';

// Stocks Report (SC FBA) Constants
export const stocksReportScFbaHeaderMapping: { [key: string]: keyof ParsedScFbaStockRow } = {
    'asin': 'asin',
    'available': 'fbaStock',
};
export const stocksReportScFbaNumericFields: (keyof ParsedScFbaStockRow)[] = ['fbaStock'];
export const stocksReportScFbaMandatoryKey: keyof ParsedScFbaStockRow = 'asin';
export const stocksReportScFbaMandatoryName = 'asin';


export type UploadType = 
  | 'stock' 
  | 'advertisement' 
  | 'productListing' 
  | 'salesForecast' 
  | 'keyword' 
  | 'salesReport_vc' 
  | 'salesReport_sc' 
  | 'keywordAndSov'
  | 'stocksReport_bww'
  | 'stocksReport_vc'
  | 'stocksReport_sc_fba'
  | 'brandAnalytics';

export interface HeaderConfig {
  mapping: { [key: string]: string };
  numericFields: string[];
  mandatoryKey?: string;
  mandatoryName?: string;
  secondaryMandatoryKeys?: Array<{key: string; name: string}>;
  dataTypeForParser: string; // Keep this general string
}

export const UPLOAD_CONFIGS: Record<string, HeaderConfig> = {
  stock: {
    mapping: stockSheetHeaderMapping as { [key: string]: string },
    numericFields: stockNumericFields as string[],
    mandatoryKey: stockMandatoryKey as string,
    mandatoryName: stockMandatoryName,
    dataTypeForParser: 'Stock',
  },
  advertisement: {
    mapping: advertisementHeaderMapping as { [key: string]: string },
    numericFields: marketingNumericFields as string[],
    mandatoryKey: advertisementMandatoryKey as string,
    mandatoryName: advertisementMandatoryName,
    dataTypeForParser: 'advertisement',
  },
  productListing: {
    mapping: productListingHeaderMapping as { [key: string]: string },
    numericFields: productListingNumericFields as string[],
    mandatoryKey: productListingMandatoryKey as string,
    mandatoryName: productListingMandatoryName,
    secondaryMandatoryKeys: [
        { key: productListingMandatoryKeyBarcode as string, name: productListingMandatoryNameBarcode},
        // { key: productListingMandatoryKeyMarket as string, name: productListingMandatoryNameMarket},
        // { key: productListingMandatoryKeyManager as string, name: productListingMandatoryNameManager},
    ],
    dataTypeForParser: 'Product Listing',
  },
  salesForecast: {
    mapping: salesForecastHeaderMapping as { [key: string]: string },
    numericFields: salesForecastNumericFields as string[],
    mandatoryKey: salesForecastMandatoryKey as string,
    mandatoryName: salesForecastMandatoryName,
    secondaryMandatoryKeys: salesForecastSecondaryMandatoryKeys as Array<{key: string; name: string}>,
    dataTypeForParser: 'salesForecast',
  },
  keyword: {
    mapping: keywordHeaderMapping as { [key: string]: string },
    numericFields: keywordNumericFields as string[],
    mandatoryKey: keywordMandatoryKey as string,
    mandatoryName: keywordMandatoryName,
    dataTypeForParser: 'keyword',
  },
  salesReport_vc: {
    mapping: salesReportVcHeaderMapping as { [key: string]: string },
    numericFields: salesReportVcNumericFields as string[],
    mandatoryKey: salesReportVcMandatoryKey as string,
    mandatoryName: salesReportVcMandatoryName,
    secondaryMandatoryKeys: salesReportVcSecondaryMandatoryKeys as Array<{key: string; name: string}>,
    dataTypeForParser: 'salesReport_vc',
  },
  salesReport_sc: {
    mapping: salesReportScHeaderMapping as { [key: string]: string },
    numericFields: salesReportScNumericFields as string[],
    mandatoryKey: salesReportScMandatoryKey as string,
    mandatoryName: salesReportScMandatoryName,
    secondaryMandatoryKeys: salesReportScSecondaryMandatoryKeys as Array<{key: string; name: string}>,
    dataTypeForParser: 'salesReport_sc',
  },
  stocksReport_bww: {
    mapping: stocksReportBwwHeaderMapping as { [key: string]: string },
    numericFields: stocksReportBwwNumericFields as string[],
    mandatoryKey: stocksReportBwwMandatoryKey as string,
    mandatoryName: stocksReportBwwMandatoryName,
    dataTypeForParser: 'stocksReport_bww',
  },
  stocksReport_vc: {
    mapping: stocksReportVcHeaderMapping as { [key: string]: string },
    numericFields: stocksReportVcNumericFields as string[],
    mandatoryKey: stocksReportVcMandatoryKey as string,
    mandatoryName: stocksReportVcMandatoryName,
    dataTypeForParser: 'stocksReport_vc',
  },
  stocksReport_sc_fba: {
    mapping: stocksReportScFbaHeaderMapping as { [key: string]: string },
    numericFields: stocksReportScFbaNumericFields as string[],
    mandatoryKey: stocksReportScFbaMandatoryKey as string,
    mandatoryName: stocksReportScFbaMandatoryName,
    dataTypeForParser: 'stocksReport_sc_fba',
  },
  keywordAndSov: { // Placeholder, logic is custom in modal
    mapping: {},
    numericFields: [],
    dataTypeForParser: 'keywordAndSov'
  },
  brandAnalytics: {
    mapping: {
      'Search Term': 'search_term_text',
      'Search Frequency Rank': 'frequency_rank',
      'Reporting Date': 'reporting_date',
      'Top Clicked Product No. 1: ASIN': 'asin_1',
      'Top Clicked Brand No. 1': 'brand_1',
      'Top Clicked Product No. 1: Click Share': 'click_share_1',
      'Top Clicked Product No. 1: Conversion Share': 'conversion_share_1',
      'Top Clicked Product No. 2: ASIN': 'asin_2',
      'Top Clicked Brands No. 2': 'brand_2',
      'Top Clicked Product No. 2: Click Share': 'click_share_2',
      'Top Clicked Product No. 2: Conversion Share': 'conversion_share_2',
      'Top Clicked Product No. 3: ASIN': 'asin_3',
      'Top Clicked Brands No. 3': 'brand_3',
      'Top Clicked Product No. 3: Click Share': 'click_share_3',
      'Top Clicked Product No. 3: Conversion Share': 'conversion_share_3',
    },
    numericFields: [
      'frequency_rank',
      'click_share_1', 'conversion_share_1',
      'click_share_2', 'conversion_share_2',
      'click_share_3', 'conversion_share_3',
    ],
    mandatoryKey: 'Search Term',
    mandatoryName: 'Search Term',
    dataTypeForParser: 'brandAnalytics',
  },
};
