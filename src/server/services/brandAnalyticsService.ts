import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { ProductListingUploadSummary, ProductListingUploadError } from '@/lib/types';
import { parseExcelDate } from '@/lib/excelUtils';

class BrandAnalyticsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async processUploadBatch(batch: any[]): Promise<ProductListingUploadSummary> {
    const supabase = this.getSupabaseClient();
    const summary: ProductListingUploadSummary = {
      totalRowsProcessed: batch.length,
      processedCount: 0,
      productsCreated: 0,
      productsUpdated: 0,
      listingsCreated: 0,
      listingsUpdated: 0,
      cartonSpecsSaved: 0,
      errorsEncountered: [],
    };
  
    const validSearchTerms: any[] = [];
    const validTopProducts: any[] = [];
  
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = row.rowIndexInExcel || i + 2;

      const reportingDate = parseExcelDate(row.reporting_date);

      if (!reportingDate) {
        summary.errorsEncountered.push({
          rowIndexInExcel: rowIndex,
          error: "Missing or invalid 'Reporting Date'. This column is mandatory.",
        });
        continue;
      }
      
      if (!row.search_term_text) {
        summary.errorsEncountered.push({
            rowIndexInExcel: rowIndex,
            error: "Missing required data: 'Search Term' must be present.",
        });
        continue;
      }

      if (row.frequency_rank === null || row.frequency_rank === undefined) {
         summary.errorsEncountered.push({
            rowIndexInExcel: rowIndex,
            error: "Missing required data: 'Search Frequency Rank' must be present.",
        });
        continue;
      }

      let frequencyRank: number;
      try {
        frequencyRank = parseInt(row.frequency_rank, 10);
        if (isNaN(frequencyRank)) {
          throw new Error('Invalid frequency_rank - must be a number');
        }
      } catch (e) {
        summary.errorsEncountered.push({
          rowIndexInExcel: rowIndex,
          error: `Invalid Frequency Rank: '${row.frequency_rank}'. Must be a whole number.`,
        });
        continue;
      }

      const safeParseFloat = (value: any): number | null => {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const parsed = parseFloat(String(value).replace(/%/g, ''));
        return isNaN(parsed) ? null : parsed;
      };
      
      validSearchTerms.push({
        search_term_text: row.search_term_text.trim(),
        frequency_rank: frequencyRank,
        reporting_date: reportingDate,
      });
  
      validTopProducts.push({
        search_term_text: row.search_term_text.trim(),
        reporting_date: reportingDate,
        asin_1: row.asin_1 || null,
        brand_1: row.brand_1 || null,
        click_share_1: safeParseFloat(row.click_share_1),
        conversion_share_1: safeParseFloat(row.conversion_share_1),
        asin_2: row.asin_2 || null,
        brand_2: row.brand_2 || null,
        click_share_2: safeParseFloat(row.click_share_2),
        conversion_share_2: safeParseFloat(row.conversion_share_2),
        asin_3: row.asin_3 || null,
        brand_3: row.brand_3 || null,
        click_share_3: safeParseFloat(row.click_share_3),
        conversion_share_3: safeParseFloat(row.conversion_share_3),
      });
    }
  
    if (validSearchTerms.length > 0) {
        try {
            const { error: searchTermsError } = await supabase
              .from('brand_analytics_search_terms')
              .upsert(validSearchTerms, { onConflict: 'search_term_text, reporting_date' });
    
            if (searchTermsError) {
              throw new Error(`Error inserting search terms: ${searchTermsError.message}`);
            }
          
            const { error: topProductsError } = await supabase
              .from('brand_analytics_top_products')
              .upsert(validTopProducts, { onConflict: 'search_term_text, reporting_date' });
      
            if (topProductsError) {
              throw new Error(`Error upserting top products: ${topProductsError.message}`);
            }
          
            summary.processedCount = validSearchTerms.length;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during batch processing';
          // Add a single error for the whole batch failure
          summary.errorsEncountered.push({
            rowIndexInExcel: 0, 
            error: `Database operation failed: ${errorMessage}. None of the valid rows in this batch were saved.`,
          });
          // Reset processed count as the transaction effectively failed
          summary.processedCount = 0;
        }
    }
  
    return summary;
  }
}

export const brandAnalyticsService = new BrandAnalyticsService();
