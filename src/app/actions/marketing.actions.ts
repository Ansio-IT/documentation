

'use server';

import type { MarketingDataEntry, FetchMarketingDataParams } from '@/lib/types';
import { marketingDataService } from '@/server/services/marketingDataService';
export async function fetchMarketingData(
  params: FetchMarketingDataParams
): Promise<{ data: MarketingDataEntry[]; pageCount: number; totalCount: number }> {
  try {
    return await marketingDataService.getAllMarketingData(params);
  } catch (error) {
    console.error("Error fetching marketing data via action:", error);
    return { data: [], pageCount: 0, totalCount: 0 };
  }
}

export async function fetchDistinctMarketingOwners(): Promise<string[]> {
    try {
        return await marketingDataService.getDistinctMarketingFieldValues('person');
    } catch (error) {
        console.error("Error fetching distinct marketing owners via action:", error);
        return [];
    }
}

export async function fetchDistinctMarketingPortfolios(): Promise<string[]> {
    try {
        return await marketingDataService.getDistinctMarketingFieldValues('portfolio');
    } catch (error) {
        console.error("Error fetching distinct marketing portfolios via action:", error);
        return [];
    }
}

export async function processAndStoreMarketingData(
  entries: Omit<MarketingDataEntry, 'id' | 'createdAt'>[]
): Promise<{ success: boolean; count: number; errorsEncountered: any[] }> {
    try {
        return await marketingDataService.addMarketingDataBulk(entries);
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error processing and storing marketing data via action:", error);
        return { success: false, count: 0, errorsEncountered: [{ message: errorMessage }]};
    }
}
