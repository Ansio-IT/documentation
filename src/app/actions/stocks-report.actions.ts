'use server';

import { stocksReportService } from '@/server/services/stocksReportService';

export async function processStocksReportUploadBatchAction(
  batch: any[],
  subType: 'bww' | 'vc' | 'sc_fba'
): Promise<{ count: number; errors: any[] }> {
  try {
    if (subType === 'bww') {
      return await stocksReportService.processBwwStockBatch(batch);
    } else if (subType === 'vc') {
      return await stocksReportService.processVcStockBatch(batch);
    } else if (subType === 'sc_fba') {
      return await stocksReportService.processScFbaStockBatch(batch);
    } else {
      throw new Error(`Invalid stocks report subtype: ${subType}`);
    }
  } catch (error) {
    console.error(`Error processing stocks report batch (subType: ${subType}):`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return { count: 0, errors: [{ error: errorMessage }] };
  }
}
