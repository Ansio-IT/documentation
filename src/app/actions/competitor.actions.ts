"use server";

import type { ProductListing } from '@/lib/types';
import { productListingService } from '@/server/services/productListingService';

export async function addCompetitorListingsAction(
  mainProductId: string,
  competitorAsinsData: Array<{ asin: string; marketId: string; managerId: string; }>,
  asinsToRemove?: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    // Remove competitor listings for asinsToRemove
    if (asinsToRemove && asinsToRemove.length > 0) {
      const existingCompetitors = await productListingService.getCompetitorListingsForProduct(mainProductId);
      for (const asin of asinsToRemove) {
        const listing = existingCompetitors.find(l => l.asin?.toUpperCase() === asin.toUpperCase());
        if (listing) {
          await productListingService.deleteProductListing(listing.id);
        }
      }
    }
    // Add new competitor listings
    for (const compData of competitorAsinsData) {
      const existingListing = await productListingService.findProductListingByAsinAndMarket(
        compData.asin,
        compData.marketId,
        mainProductId,
        true
      );
      if (existingListing) {
        console.warn(`Competitor listing for ASIN ${compData.asin} in market ${compData.marketId} linked to product ${mainProductId} already exists. Skipping.`);
        continue;
      }
      await productListingService.addProductListing({
        productId: mainProductId,
        marketId: compData.marketId,
        managerId: compData.managerId,
        asin: compData.asin,
        isCompetitor: true,
      });
    }
    return { success: true, message: "Competitor ASINs updated successfully." };
  } catch (error) {
    console.error(`Error updating competitor listings to product ${mainProductId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("manager_id") && (errorMessage.includes("null value") || errorMessage.includes("is required"))) {
      return { success: false, message: "Failed to update competitor links: Manager ID is required for each competitor listing." };
    }
    return { success: false, message: `Failed to update competitor links: ${errorMessage}` };
  }
}

export async function deleteCompetitorListingAction(
  listingId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await productListingService.deleteProductListing(listingId);
    return { success: true, message: "Competitor listing deleted successfully." };
  } catch (error) {
    console.error(`Error deleting competitor listing ${listingId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to delete competitor listing: ${errorMessage}` };
  }
}

export async function fetchCompetitorListingsByProduct(
    mainProductId: string
): Promise<ProductListing[]> {
    try {
        return await productListingService.getCompetitorListingsForProduct(mainProductId);
    } catch (error) {
        console.error("Error fetching competitor listings by product ID via actions:", error);
        return [];
    }
}
