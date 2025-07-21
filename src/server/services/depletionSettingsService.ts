
import { type SupabaseClient } from '@supabase/supabase-js';
import type { SalesTarget, SalesTargetInput, ProductDepletionCoreData, DepletionData } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
// productsService is not directly needed here anymore for fetching, but for updating.

// SalesTarget remains largely the same for DB interaction
const salesTargetFromSnakeCase = (dbTarget: any): SalesTarget => {
  if (!dbTarget) return {} as SalesTarget;
  return {
    id: dbTarget.id,
    productId: dbTarget.product_id,
    startDate: dbTarget.start_date,
    endDate: dbTarget.end_date,
    salesForecast: dbTarget.sales_forecast,
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
  };
};

class DepletionSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getDepletionDataForProduct(productId: string): Promise<DepletionData | null> {
    const supabase = this.getSupabaseClient();

    // Fetch core depletion fields from the products table
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('associated_products, local_warehouse_lead_time, reorder_lead_time')
      .eq('id', productId)
      .single();

    if (productError && productError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error(`Error fetching product core depletion data for product ${productId}:`, productError);
      throw productError;
    }

    // Fetch sales targets
    const { data: targetsData, error: targetsError } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('product_id', productId)
      .order('start_date', { ascending: true });

    if (targetsError) {
      console.error(`Error fetching sales targets for product ${productId}:`, targetsError);
      throw targetsError;
    }
    
    // If productData is null (product not found or no depletion fields),
    // and there are no sales targets, then it's truly no settings.
    if (!productData && (!targetsData || targetsData.length === 0)) {
        console.warn(`No depletion core data or sales targets found for product ${productId}.`);
        return null;
    }

    return {
      productId: productId,
      associatedProducts: productData?.associated_products || [],
      localWarehouseLeadTime: productData?.local_warehouse_lead_time ?? 14, // Default if null
      reorderLeadTime: productData?.reorder_lead_time ?? 100, // Default if null
      salesTargets: targetsData ? targetsData.map(salesTargetFromSnakeCase) : [],
    };
  }

  async saveDepletionDataForProduct(
    productId: string,
    coreData: ProductDepletionCoreData,
    salesTargets: Omit<SalesTarget, 'id' | 'productId' | 'createdOn' | 'modifiedOn'>[]
  ): Promise<void> {
    const supabase = this.getSupabaseClient();

    // Update core depletion fields on the products table
    // Ensure that null values are explicitly passed if that's the intent,
    // or provide defaults if the table columns don't have them / nullable.
    const productUpdates: any = {
      associated_products: coreData.associatedProducts ?? null, // Use null if undefined
      local_warehouse_lead_time: coreData.localWarehouseLeadTime ?? null,
      reorder_lead_time: coreData.reorderLeadTime ?? null,
      // Supabase trigger on 'products' table handles 'modified_on'
    };
    
    const { error: productUpdateError } = await supabase
      .from('products')
      .update(productUpdates)
      .eq('id', productId);

    if (productUpdateError) {
      console.error(`Error updating core depletion fields on product ${productId}:`, productUpdateError);
      throw productUpdateError;
    }

    // Delete existing sales targets for this product
    const { error: deleteError } = await supabase
      .from('sales_targets')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      console.error(`Error deleting existing sales targets for product ${productId}:`, deleteError);
      throw deleteError;
    }

    // Insert new sales targets if any
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
}

export const depletionSettingsService = new DepletionSettingsService();
