
import { type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedVcSaleRow, ParsedScSaleRow, ProductListingUploadError, DailySale } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { parseExcelDate } from '@/lib/excelUtils';

class SalesDataService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  private async getProductIdsForAsins(supabase: SupabaseClient, asins: string[]): Promise<Map<string, string>> {
    if (!asins || asins.length === 0) {
      return new Map();
    }
    console.log(`[SalesDataService] Looking up Product IDs for ${asins.length} unique ASINs.`);

    // More robust case-insensitive query using .or with .ilike
    const orFilter = asins.map(a => `asin.ilike.${a}`).join(',');

    const { data, error } = await supabase
      .from('product_listings')
      .select('asin, product_id')
      .eq('is_competitor', false)
      .or(orFilter);

    if (error) {
        console.error('[SalesDataService] Error fetching product ids for ASINs:', error);
        return new Map();
    }

    const asinToProductIdMap = new Map<string, string>();
    if (data) {
      console.log(`[SalesDataService] Found ${data.length} matching non-competitor listings from the database.`);
      for (const mapping of data) {
          if (mapping.asin && mapping.product_id) {
              // Standardize the key in the map to be safe (trimmed and lowercased)
              asinToProductIdMap.set(mapping.asin.trim().toLowerCase(), mapping.product_id);
          }
      }
    }
    return asinToProductIdMap;
  }

  private async getChannelIdByType(supabase: SupabaseClient, channelType: 'VC' | 'SC'): Promise<string | null> {
    const { data, error } = await supabase
        .from('channels')
        .select('id')
        .eq('channel_type', channelType)
        .limit(1)
        .maybeSingle();
    
    if (error) {
        console.error(`[SalesDataService] Error fetching channel ID for type '${channelType}':`, error);
        return null;
    }
    return data?.id || null;
  }

  async processVcSalesBatch(batch: ParsedVcSaleRow[]): Promise<{ count: number; errors: ProductListingUploadError[] }> {
    const supabase = this.getSupabaseClient();
    const errors: ProductListingUploadError[] = [];

    const vcChannelId = await this.getChannelIdByType(supabase, 'VC');
    if (!vcChannelId) {
        errors.push({ rowIndexInExcel: 0, error: `Critical setup error: 'VC' channel not found in channels table.` });
        return { count: 0, errors };
    }

    const asinsInBatch = [...new Set(batch.map(row => row.ASIN?.trim().toLowerCase()).filter(Boolean))];
    const asinToProductIdMap = await this.getProductIdsForAsins(supabase, asinsInBatch);
    
    const aggregatedSales = new Map<string, { quantity: number; originalRows: number[], asin: string }>();

    for (const row of batch) {
      if (!row.ASIN) {
          errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Row skipped. Missing required value for ASIN.`, asin: row.ASIN || 'N/A' });
          continue;
      }
      
      const saleDate = parseExcelDate(row.Date);
      if (!saleDate) {
        errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Row skipped due to invalid or missing Date.`, asin: row.ASIN });
        continue;
      }
      
      const productId = asinToProductIdMap.get(row.ASIN.trim().toLowerCase());
      if (!productId) {
        errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Product with ASIN '${row.ASIN}' not found in your non-competitor listings.`, asin: row.ASIN });
        continue;
      }
      
      const key = `${productId}|${saleDate}`;

      if (!aggregatedSales.has(key)) {
        aggregatedSales.set(key, { quantity: 0, originalRows: [], asin: row.ASIN });
      }

      const existing = aggregatedSales.get(key)!;
      const orderedUnits = row['Ordered units'] !== null && !isNaN(Number(row['Ordered units'])) ? Number(row['Ordered units']) : 0;
      existing.quantity += orderedUnits;
      existing.originalRows.push(row.rowIndexInExcel);
    }

    if (aggregatedSales.size === 0) {
      return { count: 0, errors };
    }

    const dbPayload = Array.from(aggregatedSales.entries()).map(([key, { quantity }]) => {
        const [productId, saleDate] = key.split('|');
        return {
            product_id: productId,
            channel_id: vcChannelId,
            sale_date: saleDate,
            units_sold: quantity,
            revenue_amount: null,
        };
    });
    
    const { count, error } = await supabase
      .from('daily_sales')
      .upsert(dbPayload, { onConflict: 'product_id,channel_id,sale_date' });

    if (error) {
      console.error('Error upserting VC sales data:', error);
      errors.push({ rowIndexInExcel: 0, error: `Database error on VC batch insert: ${error.message}` });
      return { count: 0, errors };
    }

    return { count: count || 0, errors };
  }

  async processScSalesBatch(batch: ParsedScSaleRow[]): Promise<{ count: number; errors: ProductListingUploadError[] }> {
    const supabase = this.getSupabaseClient();
    const errors: ProductListingUploadError[] = [];
    
    const scChannelId = await this.getChannelIdByType(supabase, 'SC');
    if (!scChannelId) {
        errors.push({ rowIndexInExcel: 0, error: `Critical setup error: 'SC' channel not found in channels table.` });
        return { count: 0, errors };
    }
    
    const asinsInBatch = [...new Set(batch.map(row => row.asin?.trim().toLowerCase()).filter(Boolean))];
    if (asinsInBatch.length === 0) {
        errors.push({ rowIndexInExcel: 0, error: 'No valid ASINs found in the uploaded file.' });
        return { count: 0, errors };
    }
    
    const asinToProductIdMap = await this.getProductIdsForAsins(supabase, asinsInBatch);
    
    const aggregatedSales = new Map<string, { quantity: number; originalRows: number[] }>();

    for (const row of batch) {
      if (!row.asin || !row['purchase-date']) {
          errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Row skipped. Missing required value for 'asin' or 'purchase-date'.`, asin: row.asin || 'N/A' });
          continue;
      }
      
      const standardizedAsin = row.asin.trim().toLowerCase();
      const productId = asinToProductIdMap.get(standardizedAsin);
      
      if (!productId) {
          errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Product with ASIN '${row.asin}' not found in your non-competitor listings.`, asin: row.asin });
          continue;
      }

      const saleDate = parseExcelDate(row['purchase-date']);
      if (!saleDate) {
        errors.push({ rowIndexInExcel: row.rowIndexInExcel, error: `Row skipped due to invalid or missing 'purchase-date'.`, asin: row.asin });
        continue;
      }
      
      const aggregationKey = `${productId}|${saleDate}`;

      if (!aggregatedSales.has(aggregationKey)) {
        aggregatedSales.set(aggregationKey, { quantity: 0, originalRows: [] });
      }
      
      const entry = aggregatedSales.get(aggregationKey)!;
      const quantity = row.quantity !== null && !isNaN(Number(row.quantity)) ? Number(row.quantity) : 0;
      entry.quantity += quantity;
      entry.originalRows.push(row.rowIndexInExcel);
    }
    
    if (aggregatedSales.size === 0) {
      return { count: 0, errors };
    }

    const dbPayload = Array.from(aggregatedSales.entries()).map(([key, { quantity }]) => {
      const [productId, saleDate] = key.split('|');
      return {
        product_id: productId,
        channel_id: scChannelId,
        sale_date: saleDate,
        units_sold: quantity,
        revenue_amount: null
      };
    });

    console.log(`[SalesDataService] Upserting ${dbPayload.length} aggregated SC sales records to daily_sales.`);

    const { count, error: upsertError } = await supabase
      .from('daily_sales')
      .upsert(dbPayload, { onConflict: 'product_id,channel_id,sale_date' });

    if (upsertError) {
      console.error('Error upserting SC sales data:', upsertError);
      errors.push({ rowIndexInExcel: 0, error: `Database error on SC batch insert: ${upsertError.message}` });
      return { count: 0, errors };
    }

    console.log(`[SalesDataService] Successfully upserted ${count || 0} SC sales records.`);
    return { count: count || 0, errors };
  }
}

export const salesDataService = new SalesDataService();
