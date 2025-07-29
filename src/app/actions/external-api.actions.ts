
'use server';

import { externalApiDataService } from '@/server/services/externalApiDataService';
import { productListingService } from '@/server/services/productListingService';
import { marketSettingsService } from '@/server/services/marketSettingsService';

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

export async function fetchLastSyncTimeAction(): Promise<string | null> {
    try {
        return await externalApiDataService.getLatestBrightDataSyncTimestamp();
    } catch (error) {
        console.error("Error fetching last sync time:", error);
        return null;
    }
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
            if (!listing.asin) {
                continue;
            }

            let currentMarketBaseUrl = amazonBaseUrlFromEnv;
            const marketSettingForListing = activeMarketSettings.find(ms => ms.id === listing.marketId);

            if (marketSettingForListing?.domainIdentifier && isValidHttpUrl(marketSettingForListing.domainIdentifier)) {
                currentMarketBaseUrl = marketSettingForListing.domainIdentifier;
            } else {
                console.warn(`Market for listing ASIN ${listing.asin} (Market ID: ${listing.marketId}) either not found or its domainIdentifier "${marketSettingForListing?.domainIdentifier}" is not a valid full URL. Falling back to AMAZON_BASE_URL for constructing its product URL.`);
            }

            const normalizedBaseUrl = currentMarketBaseUrl.endsWith('/') ? currentMarketBaseUrl : `${currentMarketBaseUrl}/`;

            if (!asinsToFetch.has(listing.asin)) {
                try {
                    const productSpecificUrl = new URL(`dp/${listing.asin}`, normalizedBaseUrl).toString();
                    payloadForBrightData.push({ url: productSpecificUrl, zipcode: "" });
                    asinsToFetch.add(listing.asin);
                } catch (e) {
                    console.warn(`Failed to construct URL for ASIN ${listing.asin} with base ${normalizedBaseUrl}: ${e}`);
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
