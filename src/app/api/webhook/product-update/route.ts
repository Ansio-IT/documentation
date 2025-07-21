
import { NextResponse, type NextRequest } from 'next/server';
import { productsService } from '@/server/services/products';
import { productListingService } from '@/server/services/productListingService';
import { externalApiDataService } from '@/server/services/externalApiDataService';
import { marketSettingsService } from '@/server/services/marketSettingsService';
import type { ProductListingData, MarketSetting, Product } from '@/lib/types';

// Define structure of incoming webhook payload item
interface WebhookProductPayload {
  asin: string; // This is key for matching
  title?: string;
  description?: string;
  initial_price?: number; // For list price
  final_price?: number; // For current selling price
  currency?: string;
  brand?: string;
  seller_name?: string; // Fallback for sold by
  categories?: string[];
  image_url?: string;
  images?: string[]; // Array of image URLs
  url?: string;
  domain?: string; // e.g., "https://www.amazon.co.uk/"
  root_bs_category?: string;
  root_bs_rank?: number;
  bs_category?: string;
  bs_rank?: number;
  subcategory_rank?: Array<{ subcategory_name: string; subcategory_rank: number; }>;
  market?: string; // Explicit market from payload if available - will be overridden by domain matching
  
  // Nested deal_type
  prices_breakdown?: {
    deal_type?: string | null;
    // other price breakdown fields if any
  };

  ships_from?: string | null; // For dispatched from
  buybox_seller?: string | null; // Primary for sold by
  delivery?: string[] | null; // For fastest delivery

  [key: string]: any; // Allow any other fields from Bright Data
}

const normalizeHostname = (urlOrHostname: string | undefined): string | undefined => {
  if (!urlOrHostname) return undefined;
  try {
    let hostname = new URL(urlOrHostname).hostname;
    hostname = hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    // If it's not a full URL, try to treat it as a hostname directly
    let directHostname = urlOrHostname.toLowerCase();
    if (directHostname.startsWith('www.')) {
      directHostname = directHostname.substring(4);
    }
    // Basic check to see if it looks like a hostname (contains a dot, no slashes)
    if (directHostname.includes('.') && !directHostname.includes('/')) {
        return directHostname;
    }
    console.warn(`Webhook (normalizeHostname): Could not reliably parse hostname from: ${urlOrHostname}`);
    return undefined;
  }
};

async function determineMarketIdFromDomain(webhookDomain: string | undefined, activeMarkets: MarketSetting[]): Promise<string | undefined> {
  if (!webhookDomain || activeMarkets.length === 0) {
    console.warn("Webhook (determineMarketIdFromDomain): Cannot determine market ID. Webhook domain or active markets are missing.");
    return undefined;
  }
  const normalizedWebhookHostname = normalizeHostname(webhookDomain);
  if (!normalizedWebhookHostname) {
    console.warn(`Webhook (determineMarketIdFromDomain): Could not normalize hostname from webhook domain: ${webhookDomain}`);
    return undefined;
  }

  const matchedMarket = activeMarkets.find((setting) => {
    if (!setting.domainIdentifier) return false;
    // Normalize the setting's domainIdentifier as well
    const normalizedSettingIdentifier = normalizeHostname(setting.domainIdentifier);
    return normalizedSettingIdentifier && normalizedWebhookHostname === normalizedSettingIdentifier;
  });

  if (!matchedMarket) {
    console.warn(`Webhook (determineMarketIdFromDomain): No market setting found for normalized webhook hostname: ${normalizedWebhookHostname} (from domain: ${webhookDomain})`);
  }
  return matchedMarket?.id;
}

export async function POST(request: NextRequest) {
  console.log("Webhook /api/webhook/product-update: Received a request.");

  const webhookSecret = process.env.WEBHOOK_SECRET;
  const providedSecret = request.headers.get('authorization') || request.headers.get('X-Webhook-Secret');

  if (webhookSecret && providedSecret !== webhookSecret) {
    console.warn('Webhook: Unauthorized attempt - Invalid secret.');
    return NextResponse.json({ message: 'Unauthorized: Invalid secret' }, { status: 401 });
  }
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    console.warn('Webhook: Secret not configured for production. This is a security risk.');
  } else if (!webhookSecret) {
    console.warn('Webhook: Secret not configured. Proceeding without verification (NOT RECOMMENDED FOR PRODUCTION).');
  }

  let activeMarketSettings: MarketSetting[] = [];
  try {
    activeMarketSettings = await marketSettingsService.getActiveMarketSettings();
  } catch (e) {
    console.error("Webhook: Failed to fetch active market settings:", e);
    // Proceeding without activeMarketSettings means marketId might not be determined
  }

  try {
    const payload: unknown = await request.json();

    if (!Array.isArray(payload)) {
      console.error('Webhook error: Expected an array of products in payload.');
      return NextResponse.json({ message: 'Invalid payload: Expected an array.' }, { status: 400 });
    }

    const productPayloads = payload as WebhookProductPayload[];
    let listingsUpdatedCount = 0;
    let coreProductsUpdatedCount = 0;
    let apiDataLoggedCount = 0;
    let processingErrors = 0;

    for (const item of productPayloads) {
      if (!item.asin) {
        console.warn('Webhook item skipped: Missing ASIN.', item);
        processingErrors++;
        continue;
      }
      
      const dealTypeFromPayload = item.prices_breakdown?.deal_type;
      if (!dealTypeFromPayload || dealTypeFromPayload.trim() === "") {
        console.warn(`Webhook item for ASIN ${item.asin}: 'deal_type' field (in prices_breakdown) is missing, null, or empty.`);
      }


      const marketId = await determineMarketIdFromDomain(item.domain, activeMarketSettings);
      if (!marketId) {
        console.warn(`Webhook item for ASIN ${item.asin} skipped: Could not determine market ID from domain '${item.domain}'. Item:`, JSON.stringify(item).substring(0, 500));
        processingErrors++;
        continue;
      }
      
      const currentMarket = activeMarketSettings.find(m => m.id === marketId);

      // Start with all data from webhook item, then explicitly map/override
      const listingDataUpdate: ProductListingData = {
        ...item, // Spread all incoming data first to capture everything
        asinCode: item.asin, // Then explicitly override/set key fields
        title: item.title,
        description: item.description,
        price: item.final_price ?? item.initial_price, 
        initial_price: item.initial_price,
        currency: item.currency, 
        brand: item.brand,
        sellerName: item.seller_name, 
        category: item.categories?.[0], 
        categories: item.categories, 
        imageUrl: item.image_url,
        images: item.images,
        url: item.url,
        
        marketName: currentMarket?.marketName, 
        currencySymbol: currentMarket?.currencySymbol, 
        marketDomainIdentifier: currentMarket?.domainIdentifier,

        rootBsCategory: item.root_bs_category,
        rootBsRank: item.root_bs_rank,
        bsCategory: item.bs_category,
        bsRank: item.bs_rank,
        subcategoryRanks: item.subcategory_rank?.map(sr => ({
          subcategoryName: sr.subcategory_name,
          subcategoryRank: sr.subcategory_rank,
        })),
        
        deal_type: dealTypeFromPayload, // Use the extracted deal_type
        ships_from: item.ships_from,
        buybox_seller: item.buybox_seller,
        delivery: item.delivery,

        lastUpdated: new Date().toISOString(),
      };
      
      // Clean up undefined properties from the explicit mappings
      Object.keys(listingDataUpdate).forEach(key => {
        const typedKey = key as keyof ProductListingData; 
        if (listingDataUpdate[typedKey] === undefined && key !== 'deal_type' && key !== 'ships_from' && key !== 'buybox_seller' && key !== 'delivery') { 
          const explicitKeys: Array<keyof ProductListingData> = ['asinCode', 'title', 'description', 'price', 'initial_price', 'currency', 'brand', 'sellerName', 'category', 'categories', 'imageUrl', 'images', 'url', 'marketName', 'currencySymbol', 'marketDomainIdentifier', 'rootBsCategory', 'rootBsRank', 'bsCategory', 'bsRank', 'subcategoryRanks', 'deal_type', 'ships_from', 'buybox_seller', 'delivery', 'lastUpdated'];
          if (explicitKeys.includes(typedKey)) {
            delete listingDataUpdate[typedKey];
          }
        }
      });


      try {
        const existingMainListing = await productListingService.findProductListingByAsinAndMarket(item.asin, marketId, undefined, false);
        const ourProductIdForContext = existingMainListing?.productId;
        const managerIdForContext = existingMainListing?.managerId;

        const listing = await productListingService.upsertProductListingByAsinAndMarket(
            item.asin, 
            marketId, 
            listingDataUpdate,
            ourProductIdForContext, 
            managerIdForContext, 
            !ourProductIdForContext 
        );
        listingsUpdatedCount++;
        console.log(`Webhook: Listing ${listing.id} (ASIN: ${item.asin}, Product ID: ${listing.productId}, Market ID: ${listing.marketId}) upserted successfully.`);

        try {
          console.log(`Webhook: Attempting to log raw API data for listing ${listing.id} (ASIN: ${item.asin}).`);
          await externalApiDataService.addExternalApiData({
            productListingId: listing.id,
            provider: 'BrightData', 
            data: item, 
          });
          apiDataLoggedCount++;
          console.log(`Webhook: Logged raw API data for listing ${listing.id} (ASIN: ${item.asin}).`);
        } catch (logError) {
          console.error(`Webhook: Failed to log external API data for listing ${listing.id} (ASIN: ${item.asin}):`, logError);
        }

        if (!listing.isCompetitor && listing.productId) {
          await productsService.updateProductAndListingByAsinAndMarket(
            item.asin,
            marketId,
            listingDataUpdate // Pass the already prepared listingDataUpdate
          );
          coreProductsUpdatedCount++;
          console.log(`Webhook: Core product ${listing.productId} potentially updated from listing ${listing.id}.`);
        }
      } catch (dbError) {
        processingErrors++;
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`Webhook: Error processing ASIN ${item.asin} in database for market ${marketId}: ${errorMessage}`);
      }
    }

    const message = `Webhook processed. Product listings updated/created: ${listingsUpdatedCount}. Core products updated: ${coreProductsUpdatedCount}. API Data logged: ${apiDataLoggedCount}. Errors: ${processingErrors}.`;
    console.log(message);
    return NextResponse.json({ message, listingsUpdatedCount, coreProductsUpdatedCount, apiDataLoggedCount, processingErrors }, { status: 200 });

  } catch (error) {
    console.error('Webhook: Unhandled processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ message: `Webhook processing failed: ${errorMessage}` }, { status: 500 });
  }
}

    