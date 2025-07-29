
import { type SupabaseClient } from '@supabase/supabase-js';
import type { MarketingDataEntry, FetchMarketingDataParams, SortingState as ClientSortingState } from '@/lib/types'; // Assuming SortingState might be different from Supabase's expectation if not careful
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { subDays, formatISO } from 'date-fns';

const toSnakeCase = (entry: Partial<MarketingDataEntry>): any => {
  const result: any = {};
  if (entry.id !== undefined) result.id = entry.id;
  if (entry.date !== undefined) result.date = entry.date;
  if (entry.asin !== undefined) result.asin = entry.asin;
  if (entry.productCode !== undefined) result.product_code = entry.productCode;
  if (entry.productDescription !== undefined) result.product_description = entry.productDescription;
  if (entry.person !== undefined) result.person = entry.person;
  if (entry.portfolio !== undefined) result.portfolio = entry.portfolio;
  if (entry.subPortfolio !== undefined) result.sub_portfolio = entry.subPortfolio;
  if (entry.totalQtySold !== undefined) result.total_qty_sold = entry.totalQtySold;
  if (entry.totalAdvUnitsSold !== undefined) result.total_adv_units_sold = entry.totalAdvUnitsSold;
  if (entry.totalRevenueExVatCp !== undefined) result.total_revenue_ex_vat_cp = entry.totalRevenueExVatCp;
  if (entry.totalSalesRevenueExVatSp !== undefined) result.total_sales_revenue_ex_vat_sp = entry.totalSalesRevenueExVatSp;
  if (entry.totalAdvSpend !== undefined) result.total_adv_spend = entry.totalAdvSpend;
  if (entry.totalAdvSales !== undefined) result.total_adv_sales = entry.totalAdvSales;
  if (entry.perUnitAdvSpendOnTotalQtySold !== undefined) result.per_unit_adv_spend_on_total_qty_sold = entry.perUnitAdvSpendOnTotalQtySold;
  if (entry.perUnitAdvSpendOnAdvQtySold !== undefined) result.per_unit_adv_spend_on_adv_qty_sold = entry.perUnitAdvSpendOnAdvQtySold;
  if (entry.marketingPercent !== undefined) result.marketing_percent = entry.marketingPercent;
  if (entry.acosPercent !== undefined) result.acos_percent = entry.acosPercent;
  if (entry.zeroAdvProfitSc !== undefined) result.zero_adv_profit_sc = entry.zeroAdvProfitSc;
  if (entry.zeroAdvProfitVc !== undefined) result.zero_adv_profit_vc = entry.zeroAdvProfitVc;
  if (entry.totalZeroAdvGrossProfit !== undefined) result.total_zero_adv_gross_profit = entry.totalZeroAdvGrossProfit;
  if (entry.totalGp !== undefined) result.total_gp = entry.totalGp;
  if (entry.gpPercent !== undefined) result.gp_percent = entry.gpPercent;
  if (entry.fbaStock !== undefined) result.fba_stock = entry.fbaStock;
  if (entry.bwwActualStock !== undefined) result.bww_actual_stock = entry.bwwActualStock;
  if (entry.vcStock !== undefined) result.vc_stock = entry.vcStock;
  if (entry.totalStock !== undefined) result.total_stock = entry.totalStock;
  if (entry.moh !== undefined) result.moh = entry.moh;
  if (entry.advMarketplace !== undefined) result.adv_marketplace = entry.advMarketplace;
  // created_at is handled by DB default
  return result;
};

const fromSnakeCase = (dbEntry: any): MarketingDataEntry => {
  if (!dbEntry) return {} as MarketingDataEntry;
  return {
    id: dbEntry.id,
    date: dbEntry.date,
    asin: dbEntry.asin,
    productCode: dbEntry.product_code,
    productDescription: dbEntry.product_description,
    person: dbEntry.person,
    portfolio: dbEntry.portfolio,
    subPortfolio: dbEntry.sub_portfolio,
    totalQtySold: dbEntry.total_qty_sold,
    totalAdvUnitsSold: dbEntry.total_adv_units_sold,
    totalRevenueExVatCp: dbEntry.total_revenue_ex_vat_cp,
    totalSalesRevenueExVatSp: dbEntry.total_sales_revenue_ex_vat_sp,
    totalAdvSpend: dbEntry.total_adv_spend,
    totalAdvSales: dbEntry.total_adv_sales,
    perUnitAdvSpendOnTotalQtySold: dbEntry.per_unit_adv_spend_on_total_qty_sold,
    perUnitAdvSpendOnAdvQtySold: dbEntry.per_unit_adv_spend_on_adv_qty_sold,
    marketingPercent: dbEntry.marketing_percent,
    acosPercent: dbEntry.acos_percent,
    zeroAdvProfitSc: dbEntry.zero_adv_profit_sc,
    zeroAdvProfitVc: dbEntry.zero_adv_profit_vc,
    totalZeroAdvGrossProfit: dbEntry.total_zero_adv_gross_profit,
    totalGp: dbEntry.total_gp,
    gpPercent: dbEntry.gp_percent,
    fbaStock: dbEntry.fba_stock,
    bwwActualStock: dbEntry.bww_actual_stock,
    vcStock: dbEntry.vc_stock,
    totalStock: dbEntry.total_stock,
    moh: dbEntry.moh,
    advMarketplace: dbEntry.adv_marketplace,
    createdAt: dbEntry.created_at,
  };
};

const getDbSortColumn = (clientSortId: string): string => {
  const tempObjForConversion = { [clientSortId]: '' };
  const snakedTempObj = toSnakeCase(tempObjForConversion as Partial<MarketingDataEntry>);
  const dbColumnName = Object.keys(snakedTempObj)[0];
  return dbColumnName || clientSortId; 
};

class MarketingDataService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async addMarketingDataBulk(entries: Omit<MarketingDataEntry, 'id' | 'createdAt'>[]): Promise<{ success: boolean; count: number; errorsEncountered: any[] }> {
    const supabase = this.getSupabaseClient();
    if (!entries || entries.length === 0) {
      return { success: true, count: 0, errorsEncountered: [] };
    }

    const dataToUpsert = entries.map(entry => toSnakeCase(entry));
    // console.log('[MarketingDataService] Data being upserted to marketing_data table:', JSON.stringify(dataToUpsert, null, 2));
    
    const { data: upsertedData, error } = await supabase
      .from('marketing_data')
      .upsert(dataToUpsert, { onConflict: 'date,asin' })
      .select(); // Add .select()

    if (error) {
      console.error("Error upserting marketing data in bulk to Supabase:", error);
      // console.log('[MarketingDataService] Failed upsert payload for marketing_data:', JSON.stringify(dataToUpsert, null, 2));
      return { success: false, count: 0, errorsEncountered: [error] };
    }
    
    // console.log('[MarketingDataService] Upserted marketing data returned from Supabase:', JSON.stringify(upsertedData, null, 2));
    const processedCount = upsertedData ? upsertedData.length : 0;
    
    return { success: true, count: processedCount, errorsEncountered: [] };
  }

  async getAllMarketingData(options: FetchMarketingDataParams): Promise<{ data: MarketingDataEntry[]; pageCount: number; totalCount: number }> {
    const supabase = this.getSupabaseClient();
    const { 
        pageIndex, 
        pageSize, 
        sorting, 
        globalFilter, 
        selectedDatePreset,
        customDateRange,
        selectedOwner,
        selectedPortfolio,
        productCode 
    } = options;

    let query = supabase
      .from('marketing_data')
      .select('*', { count: 'exact' });

    // Product Code Filter (for product-specific page)
    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    // Date Filtering
    let fromDate: string | undefined;
    let toDate: string | undefined;
    const today = new Date();

    if (selectedDatePreset === 'custom' && customDateRange) {
      if (customDateRange.from) fromDate = formatISO(customDateRange.from, { representation: 'date' });
      if (customDateRange.to) toDate = formatISO(customDateRange.to, { representation: 'date' });
    } else if (selectedDatePreset === 'last7days') {
      fromDate = formatISO(subDays(today, 6), { representation: 'date' }); 
      toDate = formatISO(today, { representation: 'date' });
    } else if (selectedDatePreset === 'last30days') {
      fromDate = formatISO(subDays(today, 29), { representation: 'date' });
      toDate = formatISO(today, { representation: 'date' });
    } else if (selectedDatePreset === 'last90days') {
      fromDate = formatISO(subDays(today, 89), { representation: 'date' });
      toDate = formatISO(today, { representation: 'date' });
    }
    

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }
    
    // Owner (Person) Filter
    if (selectedOwner) {
      query = query.eq('person', selectedOwner);
    }

    // Portfolio Filter
    if (selectedPortfolio) {
      query = query.eq('portfolio', selectedPortfolio);
    }

    // Apply global filter
    if (globalFilter) {
      const filterColumns = [
        'asin', 'product_code', 'product_description', 'person', 
        'portfolio', 'sub_portfolio', 'adv_marketplace'
      ];
      // Also try to filter numeric columns if globalFilter is a number
      const numericGlobalFilter = parseFloat(globalFilter);
      let numericOrFilterString = '';
      if (!isNaN(numericGlobalFilter)) {
        const numericDbColsForSearch = [ // A subset of numeric columns suitable for direct numeric search
          'total_qty_sold', 'total_adv_units_sold', 'total_revenue_ex_vat_cp', 'total_sales_revenue_ex_vat_sp', 
          'total_adv_spend', 'total_adv_sales', 'fba_stock', 'bww_actual_stock', 'vc_stock', 'total_stock'
        ];
        numericOrFilterString = numericDbColsForSearch.map(col => `${col}.eq.${numericGlobalFilter}`).join(',');
      }

      const textOrFilterString = filterColumns.map(col => `${col}.ilike.%${globalFilter}%`).join(',');
      const finalOrFilter = numericOrFilterString ? `${textOrFilterString},${numericOrFilterString}` : textOrFilterString;
      query = query.or(finalOrFilter);
    }

    // Apply sorting
    if (sorting && sorting.length > 0) {
      sorting.forEach(sort => {
        const dbColumnName = getDbSortColumn(sort.id);
        query = query.order(dbColumnName, { ascending: !sort.desc, nullsLast: true });
      });
    } else {
      // Default sort
      query = query.order('date', { ascending: false, nullsLast: true })
                   .order('created_at', { ascending: false, nullsLast: true });
    }

    // Apply pagination
    const start = pageIndex * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching marketing data from Supabase:", error);
      throw new Error(`Failed to fetch marketing data: ${error.message}`);
    }

    const totalCount = count || 0;
    const pageCount = Math.ceil(totalCount / pageSize);

    return {
      data: data ? data.map(fromSnakeCase) : [],
      pageCount,
      totalCount,
    };
  }

  async getDistinctMarketingFieldValues(fieldName: 'person' | 'portfolio'): Promise<string[]> {
    const supabase = this.getSupabaseClient();
    
    let dbFieldName = fieldName;
    if (fieldName === 'person') dbFieldName = 'person'; 
    if (fieldName === 'portfolio') dbFieldName = 'portfolio'; 

    const { data, error } = await supabase
      .from('marketing_data')
      .select(dbFieldName); 
      

    if (error) {
      console.error(`Error fetching distinct ${fieldName} values:`, error);
      throw new Error(`Failed to fetch distinct ${fieldName} values: ${error.message}`);
    }

    if (!data) return [];

    const distinctValues = Array.from(new Set(data.map(item => item[dbFieldName]).filter(Boolean) as string[]));
    return distinctValues.sort();
  }
}

export const marketingDataService = new MarketingDataService();
