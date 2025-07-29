
"use server";

import { portfolioSettingsService } from '@/server/services/portfolioSettingsService';
import type { PortfolioSetting } from '@/lib/types';

export async function fetchAllPortfoliosAction(): Promise<PortfolioSetting[]> {
  try {
    return await portfolioSettingsService.getTopLevelPortfolios();
  } catch (error) {
    console.error("Error fetching all portfolios via action:", error);
    return [];
  }
}

export async function fetchSubPortfoliosAction(portfolioId: string): Promise<PortfolioSetting[]> {
    if (!portfolioId) return [];
    try {
        return await portfolioSettingsService.getSubPortfoliosByParentId(portfolioId);
    } catch (error) {
        console.error(`Error fetching sub-portfolios for ${portfolioId} via action:`, error);
        return [];
    }
}

export async function fetchPortfolioWithParentAction(portfolioId: string): Promise<{ portfolio: PortfolioSetting, parent: PortfolioSetting | null } | null> {
    if (!portfolioId) return null;
    try {
        return await portfolioSettingsService.getPortfolioWithParent(portfolioId);
    } catch (error) {
        console.error(`Error fetching portfolio with parent for ID ${portfolioId} via action:`, error);
        return null;
    }
}

  
