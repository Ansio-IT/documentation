
"use server";

import { ProductListing } from '@/lib/types';
import { productListingService } from '@/server/services/productListingService';
import { productsService } from '@/server/services/products';
import { generateProductDescription as genkitGenerateDescription } from "@/server/ai/flows/generate-product-description";

export async function generateEnhancedDescription(
  productName: string,
  productDescription: string = '',
  targetAudience: string,
  keywords: string
): Promise<{ success: boolean; description?: string; message?: string }> {
  try {
    const result = await genkitGenerateDescription({
      productName,
      productDescription,
      targetAudience,
      keywords,
    });
    return { success: true, description: result.marketingCopy };
  } catch (error) {
    console.error("Error calling Genkit AI for description enhancement:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `AI enhancement failed: ${errorMessage}` };
  }
}

export async function updateProductDescriptionWithAIAction(
  listingId: string,
  newDescription: string,
  targetAudience?: string,
  keywords?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const listing = await productListingService.getProductListingById(listingId);
    if (!listing) {
      throw new Error("Listing not found.");
    }

    const listingData = { ...listing.data, description: newDescription };
    const updateData: Partial<ProductListing> = { data: listingData };

    await productListingService.updateProductListing(listingId, updateData);

    if (!listing.isCompetitor && listing.productId) {
      const product = await productsService.getProductByIdWithListings(listing.productId);
      if (product && product.description !== newDescription) {
        await productsService.updateProduct(listing.productId, { description: newDescription });
      }
    }

    return { success: true, message: "Product description and AI metadata updated successfully on listing. Core product description also updated if applicable." };
  } catch (error) {
    console.error(`Error updating product listing description for ${listingId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update description: ${errorMessage}` };
  }
}
