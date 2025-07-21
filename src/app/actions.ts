
"use server";

import type { Product, ProductListingData, MarketSetting, ManagerSetting, ProductListing, MarketingDataEntry, FetchMarketingDataParams, SalesTargetInput, SalesTarget, ProductDepletionCoreData, DepletionData } from "@/lib/types";
import { productsService } from '@/server/services/products';
import { productListingService } from '@/server/services/productListingService';
import { externalApiDataService } from '@/server/services/externalApiDataService';
import { marketSettingsService } from '@/server/services/marketSettingsService';
import { managerSettingsService } from '@/server/services/managerSettingsService';
import { marketingDataService } from '@/server/services/marketingDataService';
import { depletionSettingsService } from '@/server/services/depletionSettingsService';
import { generateProductDescription as genkitGenerateDescription } from "@/server/ai/flows/generate-product-description";


function isValidHttpUrl(string: string | undefined): boolean {
  if (!string) return false;
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

export async function syncProductsWithBrightData(): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const allOurProductListings = await productListingService.getAllProductListings();
    if (!allOurProductListings || allOurProductListings.length === 0) {
      return { success: true, message: "No product listings in your database to sync.", count: 0 };
    }

    const activeMarketSettings = await marketSettingsService.getActiveMarketSettings();
    
    const asinsToFetch = new Set<string>();
    const payloadForBrightData: Array<{ url: string; zipcode: string }> = [];
    const amazonBaseUrlFromEnv = process.env.AMAZON_BASE_URL || 'https://www.amazon.com';

    for (const listing of allOurProductListings) {
      if (!listing.data.asinCode) {
        continue;
      }

      let currentMarketBaseUrl = amazonBaseUrlFromEnv; // Default
      const marketSettingForListing = activeMarketSettings.find(ms => ms.id === listing.marketId);
      
      if (marketSettingForListing?.domainIdentifier && isValidHttpUrl(marketSettingForListing.domainIdentifier)) {
          currentMarketBaseUrl = marketSettingForListing.domainIdentifier;
      } else {
           console.warn(`Market for listing ASIN ${listing.data.asinCode} (Market ID: ${listing.marketId}) either not found or its domainIdentifier "${marketSettingForListing?.domainIdentifier}" is not a valid full URL. Falling back to AMAZON_BASE_URL for constructing its product URL.`);
      }
      
      const normalizedBaseUrl = currentMarketBaseUrl.endsWith('/') ? currentMarketBaseUrl : `${currentMarketBaseUrl}/`;

      if (!asinsToFetch.has(listing.data.asinCode)) {
        try {
            const productSpecificUrl = new URL(`dp/${listing.data.asinCode}`, normalizedBaseUrl).toString();
            payloadForBrightData.push({ url: productSpecificUrl, zipcode: "" }); 
            asinsToFetch.add(listing.data.asinCode);
        } catch (e) {
            console.warn(`Failed to construct URL for ASIN ${listing.data.asinCode} with base ${normalizedBaseUrl}: ${e}`);
        }
      }
    }


    if (payloadForBrightData.length === 0) {
      return { success: true, message: "No unique ASINs found to sync with Bright Data.", count: 0 };
    }

    const brightDataApiKey = process.env.BRIGHTDATA_API_KEY;
    const brightDataApiUrl = process.env.BRIGHTDATA_API_URL;
    const brightDataDatasetId = process.env.BRIGHTDATA_DATASET_ID;
    const webhookEndpoint = process.env.WEBHOOK_API;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!brightDataApiKey || !brightDataApiUrl || !brightDataDatasetId) {
      console.error("Bright Data API environment variables are not fully configured.");
      return { success: false, message: "Bright Data API configuration is incomplete in environment variables." };
    }
     if (!webhookEndpoint || !webhookSecret) {
      console.warn("Webhook endpoint or secret for Bright Data is not configured. Triggering sync without webhook parameters in API call. Ensure your Bright Data trigger is set up to call your webhook directly.");
    }

    let fullApiUrl = `${brightDataApiUrl}?dataset_id=${brightDataDatasetId}&include_errors=true`;
    if (webhookEndpoint && webhookSecret) {
      fullApiUrl += `&endpoint=${encodeURIComponent(webhookEndpoint)}&auth_header=${encodeURIComponent(webhookSecret)}&format=json&uncompressed_webhook=true`;
    } else {
       fullApiUrl += `&format=json&uncompressed_webhook=true`; 
    }

    console.log(`Triggering Bright Data sync for ${payloadForBrightData.length} URLs. Target: ${fullApiUrl}`);

    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${brightDataApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadForBrightData)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Bright Data API request failed with status ${response.status}: ${errorBody}`);
      return { success: false, message: `Failed to trigger Bright Data sync. API responded with status ${response.status}. Details: ${errorBody.substring(0, 200)}...` };
    }

    const responseData = await response.json();

    return {
      success: true,
      message: `Successfully triggered data refresh for ${payloadForBrightData.length} ASIN(s) with Bright Data. ${webhookEndpoint && webhookSecret ? "Updates will arrive via webhook." : "Updates will be available in Bright Data dataset. Ensure Bright Data trigger is set up to call your webhook directly."} Delivery ID: ${responseData.delivery_id || 'N/A'}`,
      count: payloadForBrightData.length
    };

  } catch (error) {
    console.error("Error during product sync process:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to trigger Bright Data sync: ${errorMessage}` };
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    return await productsService.getAllProductsWithPrimaryListing();
  } catch (error) {
    console.error("Error fetching products via actions:", error);
    return [];
  }
}

export async function fetchProductByIdAction(productId: string): Promise<Product | null> {
  try {
    return await productsService.getProductByIdWithListings(productId);
  } catch (error) {
    console.error(`Error fetching product ${productId} via action:`, error);
    return null;
  }
}

export async function addProductAction(
  productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'competitorListings' | 'primaryListingManagerName' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'managerId' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime'>,
  initialListing: { marketId: string; managerId: string; data: Partial<Omit<ProductListingData, 'price'>> }
): Promise<{ success: boolean; message: string; product?: Product }> {
  try {
    const newProduct = await productsService.addProductWithInitialListing(productCoreData, initialListing);
    return { success: true, message: "Product and initial listing added successfully.", product: newProduct };
  } catch (error) {
    console.error("Error adding product via actions:", error);
    let errorMessage = "Failed to add product.";
    if (error instanceof Error) {
      if (error.message.includes("products_barcode_key")) {
        errorMessage = "Failed to add product: A product with this barcode already exists.";
      } else if (error.message.includes("products_product_code_key")) {
        errorMessage = "Failed to add product: A product with this product code already exists.";
      } else {
        errorMessage = `Failed to add product: ${error.message}`;
      }
    }
    return { success: false, message: errorMessage };
  }
}

export async function updateProductAction(
  productId: string,
  productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >>,
  primaryListingUpdates?: { managerId?: string; data?: Partial<ProductListingData> },
  primaryListingMarketId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (Object.keys(productCoreData).length > 0) {
        await productsService.updateProduct(productId, productCoreData);
    }

    if (primaryListingUpdates && primaryListingMarketId) {
      const listings = await productListingService.getProductListingsByProductId(productId);
      const primaryListing = listings.find(l => l.marketId === primaryListingMarketId && !l.isCompetitor);
      
      if (primaryListing) {
         if (primaryListingUpdates.managerId && primaryListing.managerId !== primaryListingUpdates.managerId) {
            await productListingService.updateProductListing(primaryListing.id, { managerId: primaryListingUpdates.managerId });
         }
         if (primaryListingUpdates.data && Object.keys(primaryListingUpdates.data).length > 0) {
            await productListingService.updateProductListingData(primaryListing.id, primaryListingUpdates.data);
         }
      } else {
        console.warn(`No primary listing found for product ${productId} and market ${primaryListingMarketId} to update its data fields.`);
      }
    }
    return { success: true, message: "Product updated successfully." };
  } catch (error) {
    console.error(`Error updating product ${productId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update product: ${errorMessage}` };
  }
}

export async function deleteProductAction(productId: string): Promise<{ success: boolean; message: string }> {
  try {
    await productsService.deleteProduct(productId); 
    return { success: true, message: "Product deleted successfully." };
  } catch (error) {
    console.error(`Error deleting product ${productId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to delete product: ${errorMessage}` };
  }
}

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
    const updateData: Partial<ProductListingData> = { description: newDescription };
    if (targetAudience) updateData.targetAudience = targetAudience;
    if (keywords) updateData.keywords = keywords;

    const updatedListing = await productListingService.updateProductListingData(listingId, updateData);

    if (!updatedListing.isCompetitor && updatedListing.productId) {
        // Update the core product description only, not other AI metadata like targetAudience/keywords
        await productsService.updateProduct(updatedListing.productId, { description: newDescription });
    }

    return { success: true, message: "Product description and AI metadata updated successfully on listing. Core product description also updated." };
  } catch (error) {
    console.error(`Error updating product listing description for ${listingId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update description: ${errorMessage}` };
  }
}

export async function addCompetitorListingsAction(
  mainProductId: string,
  competitorAsinsData: Array<{ asinCode: string; marketId: string; managerId: string; }>
): Promise<{ success: boolean; message: string }> {
  try {
    for (const compData of competitorAsinsData) {
      const existingListing = await productListingService.findProductListingByAsinAndMarket(
        compData.asinCode,
        compData.marketId,
        mainProductId, 
        true 
      );

      if (existingListing) {
        console.warn(`Competitor listing for ASIN ${compData.asinCode} in market ${compData.marketId} linked to product ${mainProductId} already exists. Skipping.`);
        continue;
      }

      await productListingService.addProductListing({
        productId: mainProductId,
        marketId: compData.marketId,
        managerId: compData.managerId, 
        data: { asinCode: compData.asinCode }, 
        isCompetitor: true,
      });
    }
    return { success: true, message: "Competitor ASINs linked successfully." };
  } catch (error) {
    console.error(`Error adding competitor listings to product ${mainProductId} via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("manager_id") && (errorMessage.includes("null value") || errorMessage.includes("is required"))) {
      return { success: false, message: "Failed to add competitor links: Manager ID is required for each competitor listing." };
    }
    return { success: false, message: `Failed to add competitor links: ${errorMessage}` };
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

export async function fetchActiveMarketSettings(): Promise<MarketSetting[]> {
  try {
    return await marketSettingsService.getActiveMarketSettings();
  } catch (error) {
    console.error("Error fetching active market settings:", error);
    return [];
  }
}

export async function fetchAllMarketSettings(): Promise<MarketSetting[]> {
  try {
    return await marketSettingsService.getAllMarketSettings();
  } catch (error) {
    console.error("Error fetching all market settings:", error);
    return [];
  }
}

export async function addMarketSettingAction(
  data: Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>
): Promise<{ success: boolean; message: string; market?: MarketSetting }> {
  try {
    const newMarket = await marketSettingsService.addMarketSetting(data);
    return { success: true, message: "Market setting added successfully.", market: newMarket };
  } catch (error) {
    console.error("Error adding market setting via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to add market setting: ${errorMessage}` };
  }
}

export async function updateMarketSettingAction(
  settingId: string,
  data: Partial<Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>>
): Promise<{ success: boolean; message: string }> {
  try {
    await marketSettingsService.updateMarketSetting(settingId, data);
    return { success: true, message: "Market setting updated successfully." };
  } catch (error) {
    console.error(`Error updating market setting ${settingId} via action:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update market setting: ${errorMessage}` };
  }
}

export async function fetchActiveManagerSettings(): Promise<ManagerSetting[]> {
  try {
    return await managerSettingsService.getActiveManagerSettings();
  } catch (error) {
    console.error("Error fetching active manager settings:", error);
    return [];
  }
}

export async function fetchAllManagerSettings(): Promise<ManagerSetting[]> {
  try {
    return await managerSettingsService.getAllManagerSettings();
  } catch (error) {
    console.error("Error fetching all manager settings:", error);
    return [];
  }
}

export async function addManagerSettingAction( 
  data: Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>
): Promise<{ success: boolean; message: string; manager?: ManagerSetting }> { 
  try {
    const newManager = await managerSettingsService.addManagerSetting(data); 
    return { success: true, message: "Manager setting added successfully.", manager: newManager }; 
  } catch (error) {
    console.error("Error adding manager setting via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.message.includes("managers_name_key")) { 
        return { success: false, message: "Failed to add manager: Name already exists." };
    }
    return { success: false, message: `Failed to add manager setting: ${errorMessage}` };
  }
}

export async function updateManagerSettingAction( 
  settingId: string,
  data: Partial<Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>>
): Promise<{ success: boolean; message: string }> {
  try {
    await managerSettingsService.updateManagerSetting(settingId, data); 
    return { success: true, message: "Manager setting updated successfully." }; 
  } catch (error) {
    console.error(`Error updating manager setting ${settingId} via action:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     if (error instanceof Error && error.message.includes("managers_name_key")) { 
        return { success: false, message: "Failed to update manager: Name already exists." };
    }
    return { success: false, message: `Failed to update manager setting: ${errorMessage}` };
  }
}

export async function processAndStoreMarketingData(
  parsedData: Omit<MarketingDataEntry, 'id' | 'createdAt'>[]
): Promise<{ success: boolean; message: string; count?: number; errorsEncountered?: any[] }> {
  if (!parsedData || parsedData.length === 0) {
    return { success: true, message: "No data to process.", count: 0 };
  }
  try {
    const result = await marketingDataService.addMarketingDataBulk(parsedData);
    if (result.success) {
      return { 
        success: true, 
        message: `Successfully processed ${result.count} marketing data entries (new entries added or existing ones updated based on Date & ASIN). Note: This process now avoids duplicates for the same Date and ASIN.`, 
        count: result.count,
        errorsEncountered: result.errorsEncountered && result.errorsEncountered.length > 0 ? result.errorsEncountered : undefined
      };
    } else {
      return { 
        success: false, 
        message: "Failed to store some or all marketing data entries.", 
        count: result.count, 
        errorsEncountered: result.errorsEncountered 
      };
    }
  } catch (error) {
    console.error("Error processing marketing data via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to process marketing data: ${errorMessage}` };
  }
}


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

export async function fetchDepletionDataForProductAction(productId: string): Promise<DepletionData | null> {
  try {
    return await depletionSettingsService.getDepletionDataForProduct(productId);
  } catch (error) {
    console.error(`Error fetching depletion data for product ${productId} via action:`, error);
    return null;
  }
}

export async function saveDepletionDataForProductAction(
  productId: string,
  coreData: ProductDepletionCoreData,
  salesTargetsData: SalesTargetInput[]
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanSalesTargets: Omit<SalesTarget, 'id' | 'productId' | 'createdOn' | 'modifiedOn'>[] = salesTargetsData.map(({ clientId, salesForecast, startDate, endDate }) => ({
        startDate,
        endDate,
        salesForecast,
    }));
    await depletionSettingsService.saveDepletionDataForProduct(productId, coreData, cleanSalesTargets);
    return { success: true, message: "Depletion settings and sales targets saved successfully." };
  } catch (error: any) {
    console.error(`Error saving depletion data for product ${productId} via action:`, error);
    let specificErrorMessage = "An unknown error occurred during saving.";

    if (error && typeof error === 'object') {
      if (error.message && typeof error.message === 'string') {
        specificErrorMessage = error.message;
      } else {
        try {
          specificErrorMessage = JSON.stringify(error);
        } catch (e) {
          specificErrorMessage = "Could not stringify the error object.";
        }
      }
    } else if (typeof error === 'string') {
      specificErrorMessage = error;
    } else if (error instanceof Error) {
      specificErrorMessage = error.message;
    }
    
    if (typeof specificErrorMessage !== 'string' || specificErrorMessage.trim() === '{}' || specificErrorMessage.trim() === '""') {
        specificErrorMessage = "Error object could not be converted to a readable message. Check server logs for details.";
    }

    return { success: false, message: `Failed to save depletion settings: ${specificErrorMessage}` };
  }
}

export async function searchAssociatedProductsAction(
  searchTerm: string,
  currentProductId?: string
): Promise<{ productCode: string; name: string | null; id: string }[]> {
  try {
    return await productsService.searchProductsBySkuOrName(searchTerm, 10, currentProductId);
  } catch (error) {
    console.error("Error searching for associated products:", error);
    return []; // Return empty array on error
  }
}
