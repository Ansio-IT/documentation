
import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { ParsedBwwStockRow, ParsedVcStockRow, ParsedScFbaStockRow, ProductListingUploadError } from '@/lib/types';

class StocksReportService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  private async getWarehouseIdMap(supabase: SupabaseClient): Promise<Map<string, string>> {
    const { data, error } = await supabase.from('warehouses').select('id, warehouse_code');
    if (error) {
        console.error("Error fetching warehouse IDs:", error);
        throw new Error("Could not fetch warehouse information from the database.");
    }
    return new Map(data.map(w => [w.warehouse_code, w.id]));
  }

  private async getChannelIdMap(supabase: SupabaseClient): Promise<Map<string, string>> {
    const { data, error } = await supabase.from('channels').select('id, channel_type');
    if (error) {
        console.error("Error fetching channel IDs:", error);
        throw new Error("Could not fetch channel information from the database.");
    }
    const map = new Map<string, string>();
    // This maps a channel_type to the FIRST id found for it, per user instruction for "any entry".
    if (data) {
      data.forEach(c => {
          if (!map.has(c.channel_type)) {
              map.set(c.channel_type, c.id);
          }
      });
    }
    return map;
  }
  
  private async getProductIdsForAsins(supabase: SupabaseClient, asins: string[]): Promise<Map<string, string>> {
    if (!asins || asins.length === 0) {
        return new Map();
    }
    
    const asinToProductIdMap = new Map<string, string>();
    const CHUNK_SIZE = 250;

    for (let i = 0; i < asins.length; i += CHUNK_SIZE) {
        const chunk = asins.slice(i, i + CHUNK_SIZE);
        const orFilter = chunk.map(a => `asin.ilike.${a}`).join(',');

        const { data, error } = await supabase
            .from('product_listings')
            .select('asin, product_id')
            .eq('is_competitor', false)
            .or(orFilter);

        if (error) {
            console.error('[StocksReportService] Error fetching product ids for ASINs chunk:', error);
            throw new Error(`Database error while validating ASINs: ${error.message}`);
        }

        if (data) {
            for (const mapping of data) {
                if (mapping.asin && mapping.product_id) {
                    asinToProductIdMap.set(mapping.asin.trim().toLowerCase(), mapping.product_id);
                }
            }
        }
    }
    
    return asinToProductIdMap;
  }

  async processBwwStockBatch(batch: ParsedBwwStockRow[]): Promise<{ count: number; errors: ProductListingUploadError[] }> {
    const supabase = this.getSupabaseClient();
    const errors: ProductListingUploadError[] = [];

    const warehouseIdMap = await this.getWarehouseIdMap(supabase);
    const bwwWarehouseId = warehouseIdMap.get('BWW');
    if (!bwwWarehouseId) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'Critical setup error: Warehouse with code "BWW" not found.' }] };
    }

    const aggregatedStock = new Map<string, { productCode: string; bwwActualStock: number; rowIndexInExcel: number }>();
    for (const row of batch) {
        if (row.productCode) {
            const trimmedCode = String(row.productCode).trim();
            if (trimmedCode) {
                aggregatedStock.set(trimmedCode, {
                    productCode: trimmedCode,
                    bwwActualStock: row.bwwActualStock ?? 0,
                    rowIndexInExcel: row.rowIndexInExcel,
                });
            }
        }
    }
    const uniqueBatch = Array.from(aggregatedStock.values());
    const productCodesInBatch = [...new Set(uniqueBatch.map(row => row.productCode).filter(Boolean))];

    if (productCodesInBatch.length === 0) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'No valid product codes found in the batch.' }] };
    }
    
    const productCodeToIdMap = new Map<string, string>();
    const CHUNK_SIZE = 500;
    for (let i = 0; i < productCodesInBatch.length; i += CHUNK_SIZE) {
        const chunk = productCodesInBatch.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
            .from('products')
            .select('product_code, id')
            .in('product_code', chunk);

        if (error) {
            errors.push({ rowIndexInExcel: 0, error: `Database error while validating product codes: ${error.message}` });
            return { count: 0, errors };
        }
        if (data) data.forEach(p => productCodeToIdMap.set(p.product_code, p.id));
    }

    const dataToUpsert: { product_id: string; warehouse_id: string; current_stock: number; last_updated: string }[] = [];
    for (const row of uniqueBatch) {
        const productId = productCodeToIdMap.get(row.productCode);
        if (productId) {
            dataToUpsert.push({
                product_id: productId,
                warehouse_id: bwwWarehouseId,
                current_stock: row.bwwActualStock,
                last_updated: new Date().toISOString()
            });
        } else {
            errors.push({
                rowIndexInExcel: row.rowIndexInExcel,
                productCode: row.productCode,
                error: `Product Code '${row.productCode}' not found in the products table.`,
            });
        }
    }

    if (dataToUpsert.length === 0) {
      return { count: 0, errors };
    }

    const { data, error } = await supabase
      .from('warehouse_stocks')
      .upsert(dataToUpsert, { onConflict: 'product_id,warehouse_id' })
      .select('product_id');

    if (error) {
        errors.push({ rowIndexInExcel: 0, error: `Database error during BWW stock upsert: ${error.message}` });
        return { count: 0, errors };
    }
    
    return { count: data?.length || 0, errors };
  }
  
  async processVcStockBatch(batch: ParsedVcStockRow[]): Promise<{ count: number; errors: ProductListingUploadError[] }> {
    const supabase = this.getSupabaseClient();
    const errors: ProductListingUploadError[] = [];

    const channelIdMap = await this.getChannelIdMap(supabase);
    const vcChannelId = channelIdMap.get('VC');
    if (!vcChannelId) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'Critical setup error: Channel with type "VC" not found.' }] };
    }

    const aggregatedStock = new Map<string, { asin: string; vcStock: number; rowIndexInExcel: number }>();
    for (const row of batch) {
        if (row.asin) {
            const trimmedAsin = String(row.asin).trim().toLowerCase();
            if (trimmedAsin) {
                aggregatedStock.set(trimmedAsin, {
                    asin: row.asin, 
                    vcStock: row.vcStock ?? 0,
                    rowIndexInExcel: row.rowIndexInExcel,
                });
            }
        }
    }
    const uniqueBatch = Array.from(aggregatedStock.values());
    const asinsInBatch = [...new Set(uniqueBatch.map(row => row.asin.trim().toLowerCase()))];

    if (asinsInBatch.length === 0) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'No valid ASINs found in the VC stock batch.' }] };
    }

    const asinToProductIdMap = await this.getProductIdsForAsins(supabase, asinsInBatch);

    const dataToUpsert: { product_id: string; channel_id: string; current_stock: number; last_updated: string }[] = [];
    for (const row of uniqueBatch) {
        const productId = asinToProductIdMap.get(row.asin.trim().toLowerCase());
        if (productId) {
            dataToUpsert.push({
                product_id: productId,
                channel_id: vcChannelId,
                current_stock: row.vcStock,
                last_updated: new Date().toISOString()
            });
        } else {
            errors.push({
                rowIndexInExcel: row.rowIndexInExcel,
                asin: row.asin,
                error: `Product mapping not found for ASIN '${row.asin}'.`,
            });
        }
    }

    if (dataToUpsert.length === 0) {
      return { count: 0, errors };
    }

    const { data, error } = await supabase
      .from('channel_stocks')
      .upsert(dataToUpsert, { onConflict: 'product_id,channel_id' })
      .select('product_id');

    if (error) {
        errors.push({ rowIndexInExcel: 0, error: `Database error during VC stock upsert: ${error.message}` });
        return { count: 0, errors };
    }
    
    return { count: data?.length || 0, errors };
  }
  
  async processScFbaStockBatch(batch: ParsedScFbaStockRow[]): Promise<{ count: number; errors: ProductListingUploadError[] }> {
    const supabase = this.getSupabaseClient();
    const errors: ProductListingUploadError[] = [];
    const channelIdMap = await this.getChannelIdMap(supabase);
    const fbaChannelId = channelIdMap.get('FBA');

    if (!fbaChannelId) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'Critical setup error: Channel with type "FBA" not found.' }] };
    }

    const aggregatedStock = new Map<string, { asin: string; fbaStock: number; rowIndexInExcel: number }>();
    for (const row of batch) {
        if (row.asin) {
            const trimmedAsin = String(row.asin).trim().toLowerCase();
            if (trimmedAsin) {
                aggregatedStock.set(trimmedAsin, {
                    asin: row.asin,
                    fbaStock: row.fbaStock ?? 0,
                    rowIndexInExcel: row.rowIndexInExcel,
                });
            }
        }
    }
    const uniqueBatch = Array.from(aggregatedStock.values());
    const asinsInBatch = [...new Set(uniqueBatch.map(row => row.asin.trim().toLowerCase()))];

    if (asinsInBatch.length === 0) {
        return { count: 0, errors: [{ rowIndexInExcel: 0, error: 'No valid ASINs found in the SC FBA stock batch.' }] };
    }

    const asinToProductIdMap = await this.getProductIdsForAsins(supabase, asinsInBatch);

    const dataToUpsert: { product_id: string; channel_id: string; current_stock: number; last_updated: string }[] = [];
    for (const row of uniqueBatch) {
      const productId = asinToProductIdMap.get(row.asin.trim().toLowerCase());
      if (productId) {
        dataToUpsert.push({
          product_id: productId,
          channel_id: fbaChannelId,
          current_stock: row.fbaStock,
          last_updated: new Date().toISOString()
        });
      } else {
        errors.push({
          rowIndexInExcel: row.rowIndexInExcel,
          asin: row.asin,
          error: `Product mapping not found for ASIN '${row.asin}'.`,
        });
      }
    }

    if (dataToUpsert.length === 0) {
      return { count: 0, errors };
    }

    const { data, error } = await supabase
      .from('channel_stocks')
      .upsert(dataToUpsert, { onConflict: 'product_id,channel_id' })
      .select('product_id');

    if (error) {
      errors.push({ rowIndexInExcel: 0, error: `Database error during SC FBA stock upsert: ${error.message}` });
      return { count: 0, errors };
    }

    return { count: data?.length || 0, errors };
  }
}

export const stocksReportService = new StocksReportService();
