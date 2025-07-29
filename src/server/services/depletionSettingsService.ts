

import { type SupabaseClient } from '@supabase/supabase-js';
import type { SalesTarget, SalesTargetInput, ProductDepletionCoreData, DepletionData, FetchDepletionReportParams, FullDepletionReportEntry } from '@/lib/types';
import { productsService } from './products'; 
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { parseISO, isWithinInterval, max, min } from 'date-fns';

const salesTargetFromSnakeCase = (dbTarget: any): SalesTarget => {
  if (!dbTarget) return {} as SalesTarget;
  return {
    id: dbTarget.id,
    productId: dbTarget.product_id,
    startDate: dbTarget.start_date,
    endDate: dbTarget.end_date,
    salesForecast: dbTarget.sales_forecast,
    channel: dbTarget.channel,
    createdOn: dbTarget.created_on,
    modifiedOn: dbTarget.modified_on,
  };
};

const salesTargetToSnakeCase = (target: Omit<SalesTarget, 'id' | 'createdOn' | 'modifiedOn'>): any => {
  return {
    product_id: target.productId,
    start_date: target.startDate,
    end_date: target.endDate,
    sales_forecast: target.salesForecast,
    channel: target.channel,
  };
};

class DepletionSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }
  
  async getDepletionDataForProduct(supabase: SupabaseClient, productId: string): Promise<DepletionData | null> {
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('associated_products, local_warehouse_lead_time, reorder_lead_time')
      .eq('id', productId)
      .single();

    if (productError && productError.code !== 'PGRST116') { 
      console.error(`Error fetching product core depletion data for product ${productId}:`, productError);
      throw productError;
    }

    const { data: targetsData, error: targetsError } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('product_id', productId)
      .order('start_date', { ascending: true });

    if (targetsError) {
      console.error(`Error fetching sales targets for product ${productId}:`, targetsError);
      throw targetsError;
    }
    
    if (!productData && (!targetsData || targetsData.length === 0)) {
        console.warn(`No depletion core data or sales targets found for product ${productId}.`);
        return null;
    }

    return {
      productId: productId,
      associatedProducts: productData?.associated_products || [],
      localWarehouseLeadTime: productData?.local_warehouse_lead_time ?? 14, 
      reorderLeadTime: productData?.reorder_lead_time ?? 100, 
      salesTargets: targetsData ? targetsData.map(salesTargetFromSnakeCase) : [],
    };
  }

  async saveDepletionDataForProduct(
    supabase: SupabaseClient,
    productId: string,
    coreData: ProductDepletionCoreData,
    salesTargets: Omit<SalesTarget, 'id' | 'productId' | 'createdOn' | 'modifiedOn'>[]
  ): Promise<void> {
    const productUpdates: any = {
      associated_products: coreData.associatedProducts ?? null,
      local_warehouse_lead_time: coreData.localWarehouseLeadTime ?? null,
      reorder_lead_time: coreData.reorderLeadTime ?? null,
    };
    
    const { error: productUpdateError } = await supabase
      .from('products')
      .update(productUpdates)
      .eq('id', productId);

    if (productUpdateError) {
      console.error(`Error updating core depletion fields on product ${productId}:`, productUpdateError);
      throw productUpdateError;
    }

    const { error: deleteError } = await supabase
      .from('sales_targets')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      console.error(`Error deleting existing sales targets for product ${productId}:`, deleteError);
      throw deleteError;
    }

    if (salesTargets.length > 0) {
      const targetsToInsert = salesTargets.map(target => salesTargetToSnakeCase({ ...target, productId }));
      const { error: insertError } = await supabase
        .from('sales_targets')
        .insert(targetsToInsert);

      if (insertError) {
        console.error(`Error inserting new sales targets for product ${productId}:`, insertError);
        throw insertError;
      }
    }
  }

  async mergeSalesForecastBatch(targets: SalesTargetInput[]): Promise<{ success: boolean; count: number; errorsEncountered: any[] }> {
    if (!targets || targets.length === 0) {
      return { success: true, count: 0, errorsEncountered: [] };
    }
    const supabase = this.getSupabaseClient();
    const productIds = [...new Set(targets.map(t => t.productId))];
    
    const { data: existingTargetsDb, error: fetchError } = await supabase
        .from('sales_targets')
        .select('*')
        .in('product_id', productIds);

    if (fetchError) {
        console.error("Error fetching existing sales targets:", fetchError);
        return { success: false, count: 0, errorsEncountered: [{ message: fetchError.message }] };
    }
    
    const existingTargets = (existingTargetsDb || []).map(salesTargetFromSnakeCase);
    
    const updates: Partial<SalesTarget>[] = [];
    const inserts: SalesTargetInput[] = [];

    for (const newTarget of targets) {
        let isOverlapped = false;
        const newStart = parseISO(newTarget.startDate);
        const newEnd = parseISO(newTarget.endDate);

        for (const existing of existingTargets) {
            if (existing.productId === newTarget.productId) {
                const existingStart = parseISO(existing.startDate);
                const existingEnd = parseISO(existing.endDate);
                
                if (newStart <= existingEnd && newEnd >= existingStart) { // Overlap detected
                    isOverlapped = true;
                    if (existing.salesForecast !== newTarget.salesForecast) {
                        updates.push({ ...existing, salesForecast: newTarget.salesForecast });
                    }
                    break; 
                }
            }
        }
        if (!isOverlapped) {
            inserts.push(newTarget);
        }
    }

    let operationsCount = 0;
    const errors: any[] = [];

    if (updates.length > 0) {
        const updatePayloads = updates.map(u => ({ id: u.id, sales_forecast: u.salesForecast }));
        for (const payload of updatePayloads) {
            const { error: updateError } = await supabase
                .from('sales_targets')
                .update({ sales_forecast: payload.sales_forecast })
                .eq('id', payload.id);
            if (updateError) errors.push({ message: `Update failed for target ${payload.id}: ${updateError.message}` });
            else operationsCount++;
        }
    }

    if (inserts.length > 0) {
        const insertPayloads = inserts.map(i => salesTargetToSnakeCase({ ...i, productId: i.productId! }));
        const { error: insertError, count } = await supabase
            .from('sales_targets')
            .insert(insertPayloads);
        if (insertError) errors.push({ message: `Bulk insert failed: ${insertError.message}` });
        else operationsCount += count || 0;
    }
    
    if (errors.length > 0) {
      return { success: false, count: operationsCount, errorsEncountered: errors };
    }

    return { success: true, count: operationsCount, errorsEncountered: [] };
  }


  async getDepletionReport(
    params: FetchDepletionReportParams
  ): Promise<{ data: FullDepletionReportEntry[]; pageCount: number; totalCount: number }> {
    const supabase = this.getSupabaseClient();
    let query = supabase.from('dynamic_depletion_report').select('*', { count: 'exact' });
    
    if (params.productCode) {
        query = query.eq('product_code', params.productCode);
    } else {
        return { data: [], pageCount: 0, totalCount: 0 };
    }

    if (params.sorting && params.sorting.length > 0) {
        const sort = params.sorting[0];
        let dbColumn = sort.id;
        if (sort.id === 'productInfo') dbColumn = 'product_name';
        if (sort.id === 'forecastDate') dbColumn = 'forecast_date';
        if (sort.id === 'remainingStock') dbColumn = 'remaining_stock';
        if (sort.id === 'poDate') dbColumn = 'po_date';
        if (sort.id === 'etaDate') dbColumn = 'eta_date';
        if (sort.id === 'incomingQuantity') dbColumn = 'incoming_quantity';
        
        query = query.order(dbColumn, { ascending: !sort.desc });
    }
    
    const start = params.pageIndex * params.pageSize;
    const end = start + params.pageSize - 1;
    // query = query.range(start, end);

    const { data: viewData, error, count } = await query;

    if (error) {
        console.error("Error fetching data from dynamic_depletion_report view:", error);
        throw error;
    }
    
    const totalCount = count || 0;
    const pageCount = Math.ceil(totalCount / params.pageSize);

    const reportData: FullDepletionReportEntry[] = (viewData || []).map(row => ({
        id: `${row.product_id}-${row.forecast_date}`,
        productId: row.product_id,
        productCode: row.product_code,
        productName: row.product_name,
        imageUrl: row.image_url,
        currentStock: row.current_stock,
        reorderLeadTime: row.reorder_lead_time,
        forecastDate: row.forecast_date,
        dayName: row.day_name,
        isWeekend: row.is_weekend,
        dailyForecast: row.daily_forecast,
        remainingStock: row.remaining_stock,
        statusFlag: row.status_flag,
        poDate: row.po_date,
        etaDate: row.eta_date,
        incomingQuantity: row.incoming_quantity,
        requiredOrderQuantity: row.required_order_quantity,
        updatedAt: row.updated_at,
    }));

    return {
      data: reportData,
      pageCount,
      totalCount,
    };
  }

  async refreshDepletionReport(): Promise<{ success: boolean; message?: string }> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase.rpc('refresh_depletion_report');
    if (error) {
      console.error("Error refreshing depletion report view:", error);
      return { success: false, message: error.message };
    }
    return { success: true };
  }
}

export const depletionSettingsService = new DepletionSettingsService();
