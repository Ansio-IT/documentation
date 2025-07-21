
import { type SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductListing, ProductListingData, MarketSetting, ManagerSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { productListingService, mapDbListingToProductListing } from './productListingService';
import { marketSettingsService } from './marketSettingsService';
import { managerSettingsService } from './managerSettingsService';

// Helper to convert core product keys from snake_case (Supabase) to camelCase (JS/TS)
const productFromSnakeCase = (dbProduct: any): Product => {
  if (!dbProduct) return {} as Product;
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    barcode: dbProduct.barcode,
    productCode: dbProduct.product_code,
    portfolioId: dbProduct.portfolio_id, // Changed from managerId
    description: dbProduct.description,
    properties: dbProduct.properties, 
    isActive: dbProduct.is_active,
    imageUrl: dbProduct.image_url, 
    createdOn: dbProduct.created_on,
    modifiedOn: dbProduct.modified_on,
    // Depletion fields
    associatedProducts: dbProduct.associated_products,
    localWarehouseLeadTime: dbProduct.local_warehouse_lead_time,
    reorderLeadTime: dbProduct.reorder_lead_time,
    // Fields like market, price, asinCode, etc., will be populated from primary listing
  };
};

// Helper to convert core product keys from camelCase (JS/TS) to snake_case (Supabase)
const productToSnakeCase = (product: Partial<Omit<Product, 'product_listings' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'marketDomainIdentifier' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId' | 'brand' | 'sellerName' | 'category' | 'categories' | 'listingImages' | 'initial_price' | 'deal_type' | 'ships_from' | 'buybox_seller' | 'delivery' | 'targetAudience' | 'keywords' >>): any => {
  const result: any = {};
  if (product.id !== undefined) result.id = product.id;
  if (product.name !== undefined) result.name = product.name;
  if (product.barcode !== undefined) result.barcode = product.barcode;
  if (product.productCode !== undefined) result.product_code = product.productCode;
  if (product.portfolioId !== undefined) result.portfolio_id = product.portfolioId;
  if (product.description !== undefined) result.description = product.description;
  if (product.properties !== undefined) result.properties = product.properties; 
  if (product.isActive !== undefined) result.is_active = product.isActive;
  if (product.imageUrl !== undefined) result.image_url = product.imageUrl; 
  // Depletion fields
  if (product.associatedProducts !== undefined) result.associated_products = product.associatedProducts;
  if (product.localWarehouseLeadTime !== undefined) result.local_warehouse_lead_time = product.localWarehouseLeadTime;
  if (product.reorderLeadTime !== undefined) result.reorder_lead_time = product.reorderLeadTime;
  // created_on and modified_on are handled by DB
  return result;
};


class ProductsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getAllProductsWithPrimaryListing(sortOptions?: { columnId: string; direction: 'asc' | 'desc' }): Promise<Product[]> {
    const supabase = this.getSupabaseClient();
    
    const allManagers = await managerSettingsService.getAllManagerSettings();
    const managerMap = new Map(allManagers.map(m => [m.id, m.name]));

    const { data: productsWithListings, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_listings (
          id,
          data,
          market_id,
          is_competitor,
          manager_id,
          markets (market_name, currency_symbol, domain_identifier)
        )
      `)
      .eq('is_active', true);

    if (productsError) {
      console.error("Error fetching products with listings from Supabase:", productsError);
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }
    if (!productsWithListings) return [];

    let mappedProducts = productsWithListings.map(dbEntry => {
      const coreProduct: Product = productFromSnakeCase(dbEntry);
      const listings = (dbEntry.product_listings as any[]);

      if (listings && listings.length > 0) {
        const primaryListingDbRecord = listings.find(l => !(l as any).is_competitor && l.data && l.markets);

        if (primaryListingDbRecord) {
            const listingData = primaryListingDbRecord.data as ProductListingData;
            const marketDataFromJoin = primaryListingDbRecord.markets as any; 

            coreProduct.name = coreProduct.name === null || coreProduct.name === undefined || coreProduct.name === ''? listingData?.title : coreProduct.name;
            coreProduct.description = coreProduct.description === null || coreProduct.description === undefined || coreProduct.description === '' ? listingData?.description : coreProduct.description;
            coreProduct.imageUrl = coreProduct.imageUrl === null || coreProduct.imageUrl === undefined || coreProduct.imageUrl === '' ? listingData?.imageUrl : coreProduct.imageUrl; 

            coreProduct.asinCode = listingData?.asinCode;
            coreProduct.price = listingData?.price;
            coreProduct.market = marketDataFromJoin?.market_name;
            coreProduct.marketDomainIdentifier = marketDataFromJoin?.domain_identifier;
            coreProduct.currency = marketDataFromJoin?.currency_symbol; 
            coreProduct.url = listingData?.url;
            coreProduct.attentionNeeded = listingData?.attentionNeeded;
            coreProduct.dataAiHint = listingData?.dataAiHint;
            coreProduct.lastUpdated = listingData?.lastUpdated;
            
            coreProduct.brand = listingData?.brand;
            coreProduct.sellerName = listingData?.sellerName;
            coreProduct.category = listingData?.category;
            coreProduct.categories = listingData?.categories;
            coreProduct.listingImages = listingData?.images;
            coreProduct.initial_price = listingData?.initial_price;
            coreProduct.deal_type = listingData?.deal_type;
            coreProduct.ships_from = listingData?.ships_from;
            coreProduct.buybox_seller = listingData?.buybox_seller || listingData?.sellerName; // Fallback for buybox_seller
            coreProduct.delivery = listingData?.delivery;
            coreProduct.targetAudience = listingData?.targetAudience;
            coreProduct.keywords = listingData?.keywords;

            coreProduct.rootBsCategory = listingData?.rootBsCategory;
            coreProduct.rootBsRank = listingData?.rootBsRank;
            coreProduct.bsCategory = listingData?.bsCategory;
            coreProduct.bsRank = listingData?.bsRank;
            coreProduct.subcategoryRanks = listingData?.subcategoryRanks;

            const listingManagerId = (primaryListingDbRecord as any).manager_id;
            if (listingManagerId) {
                coreProduct.managerId = listingManagerId;
                coreProduct.primaryListingManagerName = managerMap.get(listingManagerId) || null;
            } else {
                coreProduct.managerId = null;
                coreProduct.primaryListingManagerName = null;
            }
        } else {
             coreProduct.managerId = null;
             coreProduct.primaryListingManagerName = null;
        }
      } else {
          coreProduct.managerId = null;
          coreProduct.primaryListingManagerName = null;
      }
      if (!coreProduct.name) coreProduct.name = `Product ${coreProduct.productCode}`;
      return coreProduct;
    }).filter(product => product.id); 

    // Server-side sorting after mapping and data derivation
    if (sortOptions && sortOptions.columnId) {
      mappedProducts.sort((a, b) => {
        let valA = (a as any)[sortOptions.columnId];
        let valB = (b as any)[sortOptions.columnId];

        // Handle specific sort logic for discount percentage
        if (sortOptions.columnId === 'discountPercentage') {
          const discountA = (a.initial_price && a.price && a.initial_price > a.price) ? ((a.initial_price - a.price) / a.initial_price) : -Infinity;
          const discountB = (b.initial_price && b.price && b.initial_price > b.price) ? ((b.initial_price - b.price) / b.initial_price) : -Infinity;
          valA = discountA;
          valB = discountB;
        }

        let comparison = 0;
        if (valA === null || valA === undefined) comparison = -1;
        else if (valB === null || valB === undefined) comparison = 1;
        else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
          comparison = (valA === valB)? 0 : valA? 1 : -1;
        }
        return sortOptions.direction === 'asc' ? comparison : -comparison;
      });
    }
    return mappedProducts;
  }

  async getProductByIdWithListings(productId: string): Promise<Product | null> {
    const supabase = this.getSupabaseClient();
    const { data: dbProduct, error } = await supabase
      .from('products')
      .select('*, product_listings!left(*, markets!left(market_name, currency_symbol, domain_identifier), managers!left(name))')
      .eq('id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error(`Error fetching product ${productId} from Supabase:`, error);
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }
    if (!dbProduct) return null;

    const product: Product = productFromSnakeCase(dbProduct);
    const allListings = (dbProduct.product_listings as any[]).map(l => {
        return mapDbListingToProductListing(l); 
    });
    product.product_listings = allListings; // Attach all listings to the product object

    const mainListing = allListings.find(l => !l.isCompetitor && l.data);
    if (mainListing && mainListing.data) {
      const mainListingData = mainListing.data;
      product.name = product.name === null || product.name === undefined || product.name === '' ? mainListingData.title : product.name; 
      product.description = product.description === null || product.description === undefined || product.description === '' ? mainListingData.description : product.description; 
      product.imageUrl = product.imageUrl === null || product.imageUrl === undefined || product.imageUrl === '' ? mainListingData.imageUrl : product.imageUrl;  

      product.price = mainListingData.price;
      product.market = mainListingData.marketName; 
      product.marketDomainIdentifier = mainListingData.marketDomainIdentifier;
      product.currency = mainListingData.currencySymbol || mainListingData.currency; 
      product.primaryListingManagerName = mainListingData.managerName;
      product.managerId = mainListing.managerId;
      product.url = mainListingData.url;
      product.asinCode = mainListingData.asinCode;
      product.lastUpdated = mainListingData.lastUpdated; 
      product.attentionNeeded = mainListingData.attentionNeeded;
      product.dataAiHint = mainListingData.dataAiHint;

      // Populate new fields from primary listing data
      product.brand = mainListingData.brand;
      product.sellerName = mainListingData.sellerName;
      product.category = mainListingData.category;
      product.categories = mainListingData.categories;
      product.listingImages = mainListingData.images;
      product.initial_price = mainListingData.initial_price;
      product.deal_type = mainListingData.deal_type;
      product.ships_from = mainListingData.ships_from;
      product.buybox_seller = mainListingData.buybox_seller || mainListingData.sellerName; // Fallback for buybox_seller
      product.delivery = mainListingData.delivery;
      product.targetAudience = mainListingData.targetAudience;
      product.keywords = mainListingData.keywords;

      product.rootBsCategory = mainListingData.rootBsCategory;
      product.rootBsRank = mainListingData.rootBsRank;
      product.bsCategory = mainListingData.bsCategory;
      product.bsRank = mainListingData.bsRank;
      product.subcategoryRanks = mainListingData.subcategoryRanks;
    }
    product.competitorListings = allListings.filter(l => l.isCompetitor);
    return product;
  }

  async addProductWithInitialListing(
    productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'product_listings' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'marketDomainIdentifier' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId' | 'brand' | 'sellerName' | 'category' | 'categories' | 'listingImages' | 'initial_price' | 'deal_type' | 'ships_from' | 'buybox_seller' | 'delivery' | 'targetAudience' | 'keywords' >,
    initialListingPayload: { marketId: string; managerId: string; data: Partial<Omit<ProductListingData, 'price'>> }
  ): Promise<Product> {
    const supabase = this.getSupabaseClient();
    const productToInsert = productToSnakeCase(productCoreData);

    console.log('Data being inserted into products table:', JSON.stringify(productToInsert, null, 2));

    const { data: newDbProduct, error: productError } = await supabase
      .from('products')
      .insert(productToInsert)
      .select()
      .single();

    if (productError || !newDbProduct) {
      console.error("Error adding product to Supabase:", productError);
      throw new Error(`Failed to add product: ${productError?.message}`);
    }

    const createdProduct: Product = productFromSnakeCase(newDbProduct);

    const listingForCreation: Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn'> = {
        productId: createdProduct.id,
        marketId: initialListingPayload.marketId,
        managerId: initialListingPayload.managerId, 
        data: { 
            ...(initialListingPayload.data as ProductListingData),
            lastUpdated: new Date().toISOString() 
        },
        isCompetitor: false,
    };
    const newListing = await productListingService.addProductListing(listingForCreation);

    // Populate product with primary listing details
    if (newListing.data) {
        createdProduct.asinCode = newListing.data.asinCode;
        createdProduct.imageUrl = createdProduct.imageUrl || newListing.data.imageUrl; // Prefer core image
        createdProduct.url = newListing.data.url;
        createdProduct.price = newListing.data.price; 
        createdProduct.lastUpdated = newListing.data.lastUpdated;
        createdProduct.brand = newListing.data.brand;
        createdProduct.sellerName = newListing.data.sellerName;
        createdProduct.category = newListing.data.category;
        createdProduct.categories = newListing.data.categories;
        createdProduct.listingImages = newListing.data.images;
        createdProduct.initial_price = newListing.data.initial_price;
        createdProduct.deal_type = newListing.data.deal_type;
        createdProduct.ships_from = newListing.data.ships_from;
        createdProduct.buybox_seller = newListing.data.buybox_seller || newListing.data.sellerName;
        createdProduct.delivery = newListing.data.delivery;
        createdProduct.targetAudience = newListing.data.targetAudience;
        createdProduct.keywords = newListing.data.keywords;
    }

    const marketInfo = await marketSettingsService.getMarketById(initialListingPayload.marketId);
    createdProduct.market = marketInfo?.marketName;
    createdProduct.marketDomainIdentifier = marketInfo?.domainIdentifier;
    createdProduct.currency = marketInfo?.currencySymbol;

    const managerInfo = await managerSettingsService.getManagerById(initialListingPayload.managerId);
    createdProduct.primaryListingManagerName = managerInfo?.name;
    createdProduct.managerId = initialListingPayload.managerId;
    
    return createdProduct;
  }

  async updateProduct(
    productId: string,
    productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'product_listings' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'marketDomainIdentifier' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId' | 'brand' | 'sellerName' | 'category' | 'categories' | 'listingImages' | 'initial_price' | 'deal_type' | 'ships_from' | 'buybox_seller' | 'delivery' | 'targetAudience' | 'keywords'>>
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const productToUpdate = productToSnakeCase(productCoreData);

    const coreProductFields = ['name', 'barcode', 'product_code', 'portfolio_id', 'description', 'properties', 'is_active', 'image_url', 'associated_products', 'local_warehouse_lead_time', 'reorder_lead_time'];
    const filteredUpdates: any = {};
    for (const key in productToUpdate) {
      if (coreProductFields.includes(key)) {
        filteredUpdates[key] = productToUpdate[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
        console.log("No core product fields to update for product:", productId);
        return;
    }

    const { error } = await supabase
      .from('products')
      .update(filteredUpdates)
      .eq('id', productId);

    if (error) {
      console.error(`Error updating product ${productId} in Supabase:`, error);
      throw new Error(`Failed to update product ${productId}: ${error.message}`);
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      console.error(`Error deleting product ${productId} from Supabase:`, error);
      throw new Error(`Failed to delete product ${productId}: ${error.message}`);
    }
  }

  async updateProductAndListingByAsinAndMarket(
    asin: string,
    marketId: string,
    listingWebhookData: ProductListingData
  ): Promise<{ product: Product | null, listing: ProductListing | null}> {
    const listing = await productListingService.upsertProductListingByAsinAndMarket(
        asin, 
        marketId, 
        listingWebhookData,
        null, 
        null, 
        false 
    );

    if (listing && !listing.isCompetitor && listing.productId) {
      const coreProductUpdates: Partial<Product> = {};
      // Only update core fields if webhook data provides new values
      const existingProduct = await this.getProductByIdWithListings(listing.productId);

      if (listingWebhookData.title && listingWebhookData.title !== existingProduct?.name) coreProductUpdates.name = listingWebhookData.title;
      if (listingWebhookData.description && listingWebhookData.description !== existingProduct?.description) coreProductUpdates.description = listingWebhookData.description;
      if (listingWebhookData.imageUrl && listingWebhookData.imageUrl !== existingProduct?.imageUrl) coreProductUpdates.imageUrl = listingWebhookData.imageUrl; 
      // properties are typically more complex and might not be updated from listing webhook directly unless specified
      // if (listingWebhookData.properties) coreProductUpdates.properties = listingWebhookData.properties;

      if (Object.keys(coreProductUpdates).length > 0) {
        await this.updateProduct(listing.productId, coreProductUpdates);
        const updatedCoreProduct = await this.getProductByIdWithListings(listing.productId);
        return {product: updatedCoreProduct, listing: listing};
      }
       const coreProduct = await this.getProductByIdWithListings(listing.productId);
       return {product: coreProduct, listing: listing};
    }
    return {product: null, listing: listing}; 
  }

  async searchProductsBySkuOrName(searchTerm: string, limit: number = 10, currentProductId?: string): Promise<{ productCode: string; name: string | null; id: string }[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, product_code, name')
      .or(`product_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      .neq('id', currentProductId || '00000000-0000-0000-0000-000000000000') // Exclude current product if ID provided
      .limit(limit);

    if (error) {
      console.error('Error searching products by SKU or name:', error);
      throw error;
    }
    return data ? data.map(p => ({ id: p.id, productCode: p.product_code, name: p.name })) : [];
  }
}

export const productsService = new ProductsService();
