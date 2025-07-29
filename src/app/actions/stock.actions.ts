
'use server';

import { createClient } from '@/lib/supabase/server';
import type { StockEntry } from '@/lib/types';
// import { stockService } from '@/server/services/stockService';
import { cookies } from 'next/headers';

// export async function fetchStockDataByProductCodeAction(
//   productCode: string
// ): Promise<StockEntry | null> {
//     try {
//         if (!productCode) return null;
//         return await stockService.getStockByProductCode(productCode);
//     } catch (error) {
//         console.error(`Error fetching stock for product code ${productCode} via action:`, error);
//         return null;
//     }
// }

export async function fetchProductStockDetailsAction(
  productId: string
): Promise<StockEntry | null> {
  const supabase = createClient(cookies());
  
  if (!productId) {
    console.warn("fetchProductStockDetailsAction called with no productId.");
    return null;
  }
  
  const { data: warehouseId, error: warehouseError } = await supabase
    .from('warehouses')
    .select('id')
    .eq('warehouse_code', 'BWW')
    .single();
  if (warehouseError) console.error("Error fetching warehouse ID:", warehouseError.message);

  const { data: bwwStock, error: bwwError } = await supabase
    .from('warehouse_stocks')
    .select('available_stock, last_updated')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId?.id)
    .maybeSingle();
  if (bwwError) console.error("Error fetching BWW stock:", bwwError.message);

  const { data: FBAchannelId, error: FBAchannelError } = await supabase
    .from('channels')
    .select('id')
    .eq('channel_code', 'FBA_UK')
    .single();
  if (FBAchannelError) console.error("Error fetching channel ID:", FBAchannelError.message);

  const { data: fbaStock, error: fbaError } = await supabase
    .from('channel_stocks')
    .select('current_stock, last_updated')
    .eq('product_id', productId)
    .eq('channel_id', FBAchannelId?.id)
    .maybeSingle();
  if (fbaError) console.error("Error fetching FBA GB stock:", fbaError.message);

  const { data: VCchannelId, error: VCchannelError } = await supabase
    .from('channels')
    .select('id')
    .eq('channel_code', 'VC_UK')
    .single();
  if (VCchannelError) console.error("Error fetching channel ID:", VCchannelError.message);

  const { data: vcStock, error: vcError } = await supabase
    .from('channel_stocks')
    .select('current_stock, last_updated')
    .eq('product_id', productId)
    .eq('channel_id', VCchannelId?.id)
    .maybeSingle();
  if (vcError) console.error("Error fetching VC stock:", vcError.message);

  const timestamps = [
    bwwStock?.last_updated,
    fbaStock?.last_updated,
    vcStock?.last_updated
  ].filter(Boolean).map(ts => new Date(ts!));

  const latestTimestamp = timestamps.length > 0 ? new Date(Math.max.apply(null, timestamps.map(d => d.getTime()))) : null;

  return {
    productCode: productId, // Placeholder, actual product code not fetched here.
    bwwAvailableStock: bwwStock?.available_stock ?? null,
    fbaGbStock: fbaStock?.current_stock ?? null,
    vcStock: vcStock?.current_stock ?? null,
    updatedOn: latestTimestamp ? latestTimestamp.toISOString() : null
  } as StockEntry;
}
