
"use server";
import type { Product, ProductListing, ProductListingData } from '@/lib/types';
import { productsService } from '@/server/services/products';
import { productListingService } from '@/server/services/productListingService';

export async function getProductsAction(): Promise<Product[]> {
  try {
    return await productsService.getAllProductsWithPrimaryListing();
  } catch (error) {
    console.error("Error fetching products via actions:", error);
    return [];
  }
}

export async function fetchProductByIdAction(
  productIdInput: string | undefined | null
): Promise<Product | null> {
  
  if (typeof productIdInput !== 'string' || !productIdInput.trim()) {
    console.error(`[ACTION] Invalid productIdInput provided to fetchProductByIdAction: '${productIdInput}'`);
    throw new Error('Product ID must be a non-empty string.');
  }

  const idToUse = productIdInput.trim();

  try {
    return await productsService.getProductByIdWithListings(idToUse);
  } catch (error) {
    console.error(`[ACTION] Error in productsService.getProductByIdWithListings for ID '${idToUse}':`, error);
    throw error; 
  }
}

export async function getProductByCodeAction(productCode: string): Promise<Product | null> {
  if (!productCode) {
    return null;
  }
  try {
    const product = await productsService.getProductByCode(productCode);
    if (!product) {
      console.warn(`[ACTION] getProductByCodeAction: Product with code ${productCode} not found.`);
      return null;
    }
    return await productsService.getProductByIdWithListings(product.id);
  } catch (error) {
    console.error(`Error fetching product by code ${productCode} via action:`, error);
    return null;
  }
}

export async function addProductAction(
  productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'product_listings' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'marketId' | 'marketDomainIdentifier' | 'price' | 'listPrice' | 'discount' | 'currency' | 'url' | 'asinCode' | 'dealType' | 'dispatchedFrom' | 'soldBy' | 'deliveryInfo' | 'categoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >,
  initialListing: { marketId: string; managerId: string; asin: string; data: Partial<ProductListingData> }
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
  productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'marketId' | 'managerId' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >>,
  primaryListingUpdates?: { managerId?: string; data?: Partial<ProductListingData> },
  marketIdForListing?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (Object.keys(productCoreData).length > 0) {
        await productsService.updateProduct(productId, productCoreData);
    }

    if (marketIdForListing && primaryListingUpdates) {
      const listings = await productListingService.getProductListingsByProductId(productId);
      const existingPrimaryListing = listings.find(l => !l.isCompetitor && l.marketId === marketIdForListing);
      
      const listingUpdates: Partial<ProductListing> = {};
      if (primaryListingUpdates.managerId) {
        listingUpdates.managerId = primaryListingUpdates.managerId;
      }
      
      // Only map fields that exist in the schema
      if (primaryListingUpdates.data) {
        const allowedFields = [
          'asin', 'current_price', 'list_price', 'discount', 'deal_type',
          'category_ranks', 'dispatched_from', 'sold_by', 'delivery_info'
        ];
        for (const key of allowedFields) {
          if (key in primaryListingUpdates.data) {
            // @ts-ignore
            listingUpdates[key] = primaryListingUpdates.data[key];
          }
        }
      }

      if (existingPrimaryListing) {
        await productListingService.updateProductListing(existingPrimaryListing.id, listingUpdates);
      } else {
        if (!primaryListingUpdates.managerId) {
            console.warn(`Cannot create new primary listing for product ${productId} in market ${marketIdForListing} without a managerId.`);
            return { success: false, message: "Failed to update/create primary listing: Manager ID is required for new listings." };
        }
        await productListingService.addProductListing({
          productId: productId,
          marketId: marketIdForListing,
          managerId: primaryListingUpdates.managerId,
          asin: listingUpdates.asin || null,
          currentPrice: listingUpdates.currentPrice,
          listPrice: listingUpdates.listPrice,
          discount: listingUpdates.discount,
          dealType: listingUpdates.dealType,
          categoryRanks: listingUpdates.categoryRanks,
          dispatchedFrom: listingUpdates.dispatchedFrom,
          soldBy: listingUpdates.soldBy,
          deliveryInfo: listingUpdates.deliveryInfo,
          isCompetitor: false,
        });
      }
    }

    return { success: true, message: "Product and its primary listing updated successfully." };
  } catch (error) {
    console.error(`Error updating product ${productId} and its primary listing via actions:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update product/listing: ${errorMessage}` };
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

export async function searchAssociatedProductsAction(
  searchTerm: string,
  currentProductId?: string
): Promise<{ id: string; productCode: string; name: string | null }[]> {
  try {
    return await productsService.searchProductsBySkuOrName(searchTerm, 10, currentProductId);
  } catch (error) {
    console.error("Error searching for associated products:", error);
    return [];
  }
}

export async function searchProductsForSuggestionsAction(
  searchTerm: string
): Promise<{ id: string; productCode: string; name: string | null; asin: string | null }[]> {
  try {
    const results = await productsService.searchProductsForSuggestions(searchTerm);
    return results.map(r => ({...r, asin: r.asin || null}));
  } catch (error) {
    console.error("Error searching for products (suggestions action):", error);
    return [];
  }
}
