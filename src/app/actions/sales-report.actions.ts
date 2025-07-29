"use server";

import type { ProductListingUploadSummary } from '@/lib/types';
import { salesDataService } from '@/server/services/salesDataService';

export async function processSalesReportUploadBatchAction(
  batch: any[],
  subType: 'vc' | 'sc'
): Promise<ProductListingUploadSummary> {
  const summary: ProductListingUploadSummary = {
    totalRowsProcessed: batch.length,
    productsCreated: 0,
    productsUpdated: 0,
    listingsCreated: 0,
    listingsUpdated: 0,
    cartonSpecsSaved: 0,
    errorsEncountered: [],
  };

  try {
    let result;
    if (subType === 'vc') {
      result = await salesDataService.processVcSalesBatch(batch);
    } else { // subType === 'sc'
      result = await salesDataService.processScSalesBatch(batch);
    }
    
    summary.listingsUpdated = result.count; // Use listingsUpdated to store the count of upserted sales
    if (result.errors.length > 0) {
      summary.errorsEncountered.push(...result.errors.map(err => ({
        rowIndexInExcel: err.rowIndexInExcel,
        error: err.error,
        asin: err.asin
      })));
    }
    
  } catch (e: any) {
    console.error(`Error processing sales report batch (subType: ${subType}):`, e);
    summary.errorsEncountered.push({
      rowIndexInExcel: 0,
      error: e.message || `Unknown error during ${subType.toUpperCase()} sales batch processing.`
    });
  }

  return summary;
}
