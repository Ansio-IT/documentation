import { useCallback } from 'react';
import { BATCH_SIZE, type UploadType } from '@/lib/uploadConstants';
import type { StockEntry, MarketingDataEntry, ParsedProductListingUploadRow, ParsedSalesForecastUploadRow, ProductListingUploadSummary, ProductListingUploadError, ParsedKeywordUploadRow } from '@/lib/types';
import { batchUpsertStockEntriesAction, processAndStoreMarketingData, processProductListingUploadBatchAction, processSalesForecastDataUploadAction, processSalesReportUploadBatchAction } from '@/app/actions/index';
import { batchUpsertKeywordsAction } from '@/app/actions/keyword.actions';
import { processStocksReportUploadBatchAction } from '@/app/actions/stocks-report.actions';
import { processBrandAnalyticsUploadBatchAction } from '@/app/actions/brand-analytics.actions';

export function useBatchUploader(uploadType: UploadType) {
  const update_batch_size = uploadType === 'salesForecast' ? 100 : BATCH_SIZE;
  const uploadBatches = useCallback(async (rawDataToProcess: any[], onBatchProgress?: (batchNum: number, totalBatches: number) => void) => {
    const numBatches = Math.ceil(rawDataToProcess.length / update_batch_size);
    let aggregatedSummary: ProductListingUploadSummary | null = (uploadType === 'productListing' || uploadType === 'salesForecast' || uploadType.startsWith('salesReport') || uploadType === 'brandAnalytics') ? {
      totalRowsProcessed: rawDataToProcess.length, // Initialize with total rows to process
      processedCount: 0,
      productsCreated: 0, productsUpdated: 0,
      listingsCreated: 0, listingsUpdated: 0, cartonSpecsSaved: 0, errorsEncountered: []
    } : null;

    let serverErrorsEncountered: ProductListingUploadError[] = [];
    let totalSuccessfullyProcessed = 0;

    for (let i = 0; i < rawDataToProcess.length; i += update_batch_size) {
      const chunk = rawDataToProcess.slice(i, i + update_batch_size);
      const currentBatchNum = Math.floor(i / update_batch_size) + 1;
      if (onBatchProgress) onBatchProgress(currentBatchNum, numBatches);
      let result: any;
      try {
        if (uploadType === 'advertisement') {
          result = await processAndStoreMarketingData(chunk as Omit<MarketingDataEntry, 'id' | 'createdAt'>[]);
        } else if (uploadType === 'productListing') {
          result = await processProductListingUploadBatchAction(chunk as ParsedProductListingUploadRow[]);
        } else if (uploadType === 'salesForecast') {
          result = await processSalesForecastDataUploadAction(chunk as ParsedSalesForecastUploadRow[]);
        } else if (uploadType.startsWith('salesReport')) {
          const subType = uploadType.split('_')[1] as 'vc' | 'sc';
          result = await processSalesReportUploadBatchAction(chunk, subType);
        } else if (uploadType.startsWith('stocksReport')) {
            const subType = uploadType.split('_')[1] as 'bww' | 'vc' | 'sc_fba';
            result = await processStocksReportUploadBatchAction(chunk, subType);
        } else if (uploadType === 'keyword') {
            const keywords = chunk.map((c: ParsedKeywordUploadRow) => c.keyword);
            result = await batchUpsertKeywordsAction(keywords);
            if (result.success) {
                totalSuccessfullyProcessed += result.countAdded;
                if (result.countDuplicates > 0) {
                    serverErrorsEncountered.push({
                        rowIndexInExcel: 0, // Not applicable for summary
                        error: `${result.countDuplicates} duplicate keywords were skipped.`
                    });
                }
            }
             if (result.errors?.length > 0) {
                serverErrorsEncountered.push(...result.errors.map((e: any) => ({ rowIndexInExcel: 0, error: `Keyword Server Error: ${e.message || String(e)}` })));
             }
             continue; // Skip the generic result processing below
        } else if (uploadType === 'brandAnalytics') {
          result = await processBrandAnalyticsUploadBatchAction(chunk);
        }
      } catch (batchError) {
        result = { success: false, count: 0, errorsEncountered: [{ message: `Server error during batch ${currentBatchNum}: ${batchError instanceof Error ? batchError.message : String(batchError)}` }] };
      }

      // This block handles result for most upload types
      if (result && typeof result.success === 'boolean') {
        if (result.success) totalSuccessfullyProcessed += result.count || 0;
        if (result.errorsEncountered?.length) {
          serverErrorsEncountered.push(...result.errorsEncountered.map((e: any) => ({ rowIndexInExcel: e.rowIndexInExcel || 0, productCode: e.productCode, error: `${uploadType} Server Error (Batch ${currentBatchNum}): ${typeof e === 'string' ? e : e.message || String(e)}` })));
        }
      } else if (result && typeof result.totalRowsProcessed === 'number' && aggregatedSummary) {
          // This block specifically handles the detailed summary from brandAnalyticsService
          const summary = result as ProductListingUploadSummary;
          aggregatedSummary.processedCount += summary.processedCount || 0;
          aggregatedSummary.errorsEncountered.push(...summary.errorsEncountered);
      }
       else {
        serverErrorsEncountered.push({ rowIndexInExcel: 0, error: `${uploadType} Batch ${currentBatchNum} error: Unexpected response from server.` });
      }
    }
    
    if (aggregatedSummary) {
        // Final aggregation
        aggregatedSummary.errorsEncountered = [...(aggregatedSummary.errorsEncountered || []), ...serverErrorsEncountered];
        return { totalSuccessfullyProcessed: aggregatedSummary.processedCount, serverErrorsEncountered: aggregatedSummary.errorsEncountered, aggregatedSummary };
    }

    return { totalSuccessfullyProcessed, serverErrorsEncountered, aggregatedSummary: null };
  }, [uploadType]);

  return { uploadBatches };
}
