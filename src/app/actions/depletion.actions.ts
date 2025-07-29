

'use server';

import { cookies } from 'next/headers';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  DepletionData,
  SalesTargetInput,
  SalesTarget,
  ProductDepletionCoreData,
  FetchDepletionReportParams,
  FullDepletionReportEntry,
  PastSalesData,
  UpcomingPurchaseOrder,
} from '@/lib/types';
import { depletionSettingsService } from '@/server/services/depletionSettingsService';
import { productsService } from '@/server/services/products';
import { format, subDays, startOfDay, parseISO, addDays } from 'date-fns';

export async function fetchDepletionDataForProductAction(productId: string): Promise<DepletionData | null> {
  const supabase = createServerSupabaseClient(cookies());
  try {
    return await depletionSettingsService.getDepletionDataForProduct(supabase, productId);
  } catch (error) {
    console.error(`Error fetching depletion data for product ${productId} via action:`, error);
    return null;
  }
}

export async function saveDepletionDataForProductAction(
  productId: string,
  coreData: ProductDepletionCoreData,
  salesTargetsData: SalesTargetInput[]
): Promise<{ success: boolean; message: string }> {
  const supabase = createServerSupabaseClient(cookies());
  try {
    const cleanSalesTargets: Omit<SalesTarget, 'id' | 'productId' | 'createdOn' | 'modifiedOn'>[] = salesTargetsData.map(({ clientId, salesForecast, startDate, endDate, channel }) => ({
        startDate,
        endDate,
        salesForecast,
        channel,
    }));
    await depletionSettingsService.saveDepletionDataForProduct(supabase, productId, coreData, cleanSalesTargets);
    return { success: true, message: "Depletion settings and sales targets saved successfully." };
  } catch (error: any) {
    console.error(`Error saving depletion data for product ${productId} via action:`, error);
    let specificErrorMessage = "An unknown error occurred during saving.";

    if (error && typeof error === 'object') {
      if (error.message && typeof error.message === 'string') {
        specificErrorMessage = error.message;
      } else {
        try {
          specificErrorMessage = JSON.stringify(error);
        } catch (e) {
          specificErrorMessage = "Could not stringify the error object.";
        }
      }
    } else if (typeof error === 'string') {
      specificErrorMessage = error;
    } else if (error instanceof Error) {
      specificErrorMessage = error.message;
    }

    if (typeof specificErrorMessage !== 'string' || specificErrorMessage.trim() === '{}' || specificErrorMessage.trim() === '""') {
        specificErrorMessage = "Error object could not be converted to a readable message. Check server logs for details.";
    }

    return { success: false, message: `Failed to save depletion settings: ${specificErrorMessage}` };
  }
}

export async function fetchDepletionReportDataAction(
  params: FetchDepletionReportParams
): Promise<{ data: FullDepletionReportEntry[]; pageCount: number; totalCount: number }> {
  try {
    return await depletionSettingsService.getDepletionReport(params);
  } catch (error) {
    console.error("Error fetching depletion report data via action:", error);
    return { data: [], pageCount: 0, totalCount: 0 };
  }
}

export async function findProductForDepletionAction(searchTerm: string): Promise<{ productCode: string | null; error?: string; }> {
    if (!searchTerm || !searchTerm.trim() || searchTerm.trim().length < 2) {
        return { productCode: null, error: "Please enter a search term (at least 2 characters)." };
    }
    try {
        const product = await productsService.findOneProductByTerm(searchTerm.trim());

        if (product && product.productCode) {
            return { productCode: product.productCode };
        } else {
             // findOneProductByTerm now returns null if >1 match, so we don't need a separate check for ambiguity here.
            return { productCode: null, error: `No single, unique product found for "${searchTerm}".` };
        }
    } catch (e) {
        console.error("Error in findProductForDepletionAction:", e);
        return { productCode: null, error: "An error occurred while searching." };
    }
}


export async function fetchPast14DaysSalesDataAction(productCode: string): Promise<PastSalesData[]> {
    const supabase = createServerSupabaseClient(cookies());
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('id')
        .eq('product_code', productCode)
        .maybeSingle();
    
    if (productError) {
        console.error(`Database error fetching product ID for product code ${productCode}:`, productError.message);
        return [];
    }
    if (!product) {
        console.warn(`Product with code ${productCode} not found.`);
        return [];
    }
    const productId = product.id;
    
    const { data: warehouseStocks, error: warehouseError } = await supabase
        .from('warehouse_stocks')
        .select('available_stock')
        .eq('product_id', productId);

    if (warehouseError) {
        console.error(`Error fetching warehouse stock for product ${productId}:`, warehouseError.message);
    }

    const { data: channelStocks, error: channelError } = await supabase
        .from('channel_stocks')
        .select('current_stock')
        .eq('product_id', productId);

    if (channelError) {
        console.error(`Error fetching channel stock for product ${productId}:`, channelError.message);
    }
    
    const totalWarehouseStock = warehouseStocks?.reduce((sum, s) => sum + (s.available_stock ?? 0), 0) ?? 0;
    const totalChannelStock = channelStocks?.reduce((sum, s) => sum + (s.current_stock ?? 0), 0) ?? 0;
    const stockAtStartOfToday = totalWarehouseStock + totalChannelStock;

    const today = startOfDay(new Date());
    const thirteenDaysAgo = subDays(today, 13);
    
    const { data: salesData, error: salesError } = await supabase
      .from('daily_sales')
      .select('sale_date, units_sold')
      .eq('product_id', productId)
      .gte('sale_date', format(thirteenDaysAgo, 'yyyy-MM-dd'))
      .lte('sale_date', format(today, 'yyyy-MM-dd'));

    if (salesError) {
        console.error(`Error fetching historical sales from daily_sales for product ${productId}:`, salesError.message);
        return [];
    }

    // Fetch sales targets for the past 14 days
    const { data: salesTargets, error: targetsError } = await supabase
        .from('sales_targets')
        .select('start_date, end_date, sales_forecast')
        .eq('product_id', productId)
        .lte('start_date', format(today, 'yyyy-MM-dd'))
        .gte('end_date', format(thirteenDaysAgo, 'yyyy-MM-dd'));

    if (targetsError) {
        console.error(`Error fetching historical sales targets for product ${productId}:`, targetsError.message);
    }
    
    const forecastByDate = new Map<string, number>();
    if (salesTargets) {
        for (const target of salesTargets) {
            let currentDate = parseISO(target.start_date);
            const endDate = parseISO(target.end_date);
            while (currentDate <= endDate) {
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                if (currentDate >= thirteenDaysAgo && currentDate <= today) {
                    forecastByDate.set(dateKey, target.sales_forecast);
                }
                currentDate = addDays(currentDate, 1);
            }
        }
    }

    const salesByDate = new Map<string, number>();
    if (salesData) {
        for (const sale of salesData) {
            if (sale.sale_date && sale.units_sold != null) {
                const existingSales = salesByDate.get(sale.sale_date) || 0;
                salesByDate.set(sale.sale_date, existingSales + Number(sale.units_sold));
            }
        }
    }

    const historicalReport: PastSalesData[] = [];
    
    // Calculate EOD stock for today first
    const todaySales = salesByDate.get(format(today, 'yyyy-MM-dd')) ?? 0;
    let endOfDayStock = stockAtStartOfToday - todaySales;
    
    historicalReport.push({
        date: format(today, 'yyyy-MM-dd'),
        day: format(today, 'EEEE'),
        unitsSold: todaySales,
        remainingStock: endOfDayStock,
        dailyForecast: forecastByDate.get(format(today, 'yyyy-MM-dd')) ?? null,
    });
    
    // Loop backwards from yesterday for 13 days to calculate previous EOD stocks
    for (let i = 1; i < 14; i++) {
        const dateToCalculate = subDays(today, i);
        const dateString = format(dateToCalculate, 'yyyy-MM-dd');
        
        const nextDayDateString = format(subDays(today, i - 1), 'yyyy-MM-dd');
        const salesOnNextDay = salesByDate.get(nextDayDateString) ?? 0;
        
        endOfDayStock = endOfDayStock + salesOnNextDay;

        historicalReport.push({
            date: dateString,
            day: format(dateToCalculate, 'EEEE'),
            unitsSold: salesByDate.get(dateString) ?? 0,
            remainingStock: endOfDayStock,
            dailyForecast: forecastByDate.get(dateString) ?? null,
        });
    }

    return historicalReport.reverse();
}

export async function fetchProductUpdateTimestampsAction(
  productCode: string
): Promise<{ stockUpdatedAt: string | null; forecastUpdatedAt: string | null }> {
  const supabase = createServerSupabaseClient(cookies());

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('product_code', productCode)
    .single();

  if (productError || !product) {
    console.error(`Error finding product for timestamps with code ${productCode}:`, productError);
    return { stockUpdatedAt: null, forecastUpdatedAt: null };
  }

  const productId = product.id;

  const { data: stockUpdate, error: stockError } = await supabase
    .from('daily_sales')
    .select('created_on')
    .eq('product_id', productId)
    .order('created_on', { ascending: false })
    .limit(1)
    .single();

  const { data: forecastUpdate, error: forecastError } = await supabase
    .from('sales_targets')
    .select('created_on')
    .eq('product_id', productId)
    .order('created_on', { ascending: false })
    .limit(1)
    .single();

  if (stockError && stockError.code !== 'PGRST116') {
      console.error('Error fetching stock update timestamp:', stockError.message);
  }
  if (forecastError && forecastError.code !== 'PGRST116') {
      console.error('Error fetching forecast update timestamp:', forecastError.message);
  }

  return {
    stockUpdatedAt: stockUpdate?.created_on || null,
    forecastUpdatedAt: forecastUpdate?.created_on || null,
  };
}

export async function fetchAllUpcomingPurchaseOrdersAction(
  productId: string
): Promise<UpcomingPurchaseOrder[]> {
  if (!productId) {
    return [];
  }
  const supabase = createServerSupabaseClient(cookies());
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('purchase_order_products')
    .select('total_order_quantity, purchase_orders!inner(po_date, latest_arrival_date, original_arrival_date)')
    .eq('product_id', productId)
    .not('total_order_quantity', 'is', null)
    .gte('purchase_orders.original_arrival_date', today)
    .order('po_date', { referencedTable: 'purchase_orders', ascending: false });

  if (error) {
    console.error(`Error fetching upcoming POs for product ${productId}:`, error.message);
    return [];
  }
  
  if (!data) {
    return [];
  }
  
  return data.map(item => {
    const po = item.purchase_orders;
    if (typeof po !== 'object' || po === null) {
      return null;
    }
    
    const typedPo = po as { po_date?: string | null, latest_arrival_date?: string | null, original_arrival_date?: string | null };
   
    return {
      poDate: typedPo.po_date ?? null,
      etaDate: typedPo.latest_arrival_date ?? typedPo.original_arrival_date ?? null,
      incomingQty: item.total_order_quantity ?? null,
    };
  }).filter((item): item is UpcomingPurchaseOrder => item !== null);
}

export async function refreshDepletionReportAction(): Promise<{ success: boolean; message?: string }> {
  try {
    return await depletionSettingsService.refreshDepletionReport();
  } catch (error: any) {
    console.error("Error refreshing depletion report via action:", error);
    return { success: false, message: error.message || "An unknown error occurred." };
  }
}
