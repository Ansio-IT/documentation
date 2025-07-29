
'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { ParsedSalesForecastUploadRow, ProductListingUploadSummary, SalesTargetInput } from '@/lib/types';
import { productsService } from '@/server/services/products';
import { depletionSettingsService } from '@/server/services/depletionSettingsService';
import { parseExcelSheet } from '@/lib/excelUtils';
import { parseISO } from 'date-fns';

export async function processSalesForecastDataUploadAction(
  batch: ParsedSalesForecastUploadRow[]
): Promise<ProductListingUploadSummary> {
  const supabase = createClient(cookies());
  const summary: ProductListingUploadSummary = {
    totalRowsProcessed: batch.length,
    productsCreated: 0,
    productsUpdated: 0,
    listingsCreated: 0,
    listingsUpdated: 0,
    cartonSpecsSaved: 0,
    errorsEncountered: [],
  };

  if (!batch || batch.length === 0) {
    return { ...summary, errorsEncountered: [{ rowIndexInExcel: 0, error: 'No data rows found in the file to process.' }] };
  }
  
  const salesTargetsToProcess: SalesTargetInput[] = [];

  for (const row of batch) {
    try {
      if (!row.sku || !row.startDate || !row.endDate || row.expectedSalesPerDay == null) {
        summary.errorsEncountered.push({
          rowIndexInExcel: row.rowIndexInExcel,
          productCode: row.sku,
          error: "Row skipped due to missing required fields (SKU, Start Date, End Date, or Expected Sales).",
        });
        continue;
      }
      
      const startDate = parseISO(row.startDate);
      const endDate = parseISO(row.endDate);

      if (startDate >= endDate) {
        // Silently skip rows where the start date is not before the end date
        continue;
      }

      const product = await productsService.getProductByCode(row.sku);
      if (!product) {
        summary.errorsEncountered.push({
          rowIndexInExcel: row.rowIndexInExcel,
          productCode: row.sku,
          error: `Product with SKU '${row.sku}' not found.`,
        });
        continue;
      }
      
      salesTargetsToProcess.push({
        productId: product.id,
        startDate: row.startDate,
        endDate: row.endDate,
        salesForecast: row.expectedSalesPerDay,
        channel: row.channel || null,
        productCode: row.sku, // Pass this along for error reporting
        rowIndexInExcel: row.rowIndexInExcel, // Pass this along for error reporting
      });

    } catch (e: any) {
      summary.errorsEncountered.push({
        rowIndexInExcel: row.rowIndexInExcel,
        productCode: row.sku,
        error: e.message || 'An unknown error occurred while processing this row.',
      });
    }
  }

  if (salesTargetsToProcess.length > 0) {
    const { success, count, errorsEncountered } = await depletionSettingsService.mergeSalesForecastBatch(salesTargetsToProcess);
    summary.listingsUpdated = count; // Using this field to track number of DB operations
    if (!success) {
      summary.errorsEncountered.push(...errorsEncountered.map((err: any) => ({
        rowIndexInExcel: err.rowIndexInExcel || 0,
        productCode: err.productCode || 'BATCH',
        error: `Batch upsert failed: ${err.message || 'Unknown server error'}`
      })));
    }
  }

  return summary;
}
