

import { type SupabaseClient } from '@supabase/supabase-js';
import type { Product, ProductListing, ProductListingData, MarketSetting, ManagerSetting, PortfolioSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { productListingService, mapDbListingToProductListing } from './productListingService';
import { marketSettingsService } from './marketSettingsService';
import { managerSettingsService } from './managerSettingsService';
import { portfolioSettingsService } from './portfolioSettingsService'; // Added

// Helper to convert core product keys from snake_case (Supabase) to camelCase (JS/TS)
const productFromSnakeCase = (dbProduct: any): Product => {
  if (!dbProduct) return {} as Product;
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    barcode: dbProduct.barcode,
    productCode: dbProduct.product_code,
    portfolioId: dbProduct.portfolio_id, 
    description: dbProduct.description,
    properties: dbProduct.properties, 
    isActive: dbProduct.is_active,
    imageUrl: dbProduct.image_url, 
    brand: dbProduct.brand,
    keywords: dbProduct.keywords,
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
const productToSnakeCase = (product: Partial<Omit<Product, 'createdOn' | 'modifiedOn' | 'product_listings' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'marketId' | 'marketDomainIdentifier' | 'price' | 'listPrice' | 'discount' | 'currency' | 'url' | 'asinCode' | 'categoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId' | 'sellerName' | 'category' | 'categories' | 'initial_price' | 'dealType' | 'dispatchedFrom' | 'soldBy' | 'deliveryInfo' | 'portfolioName'>>): any => {
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
  if (product.brand !== undefined) result.brand = product.brand;
  if (product.keywords !== undefined) result.keywords = product.keywords;
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
        portfolios (
          name,
          parent:parent_id (
            name
          )
        ),
        product_listings (
          *,
          markets (
            market_name,
            currency_symbol,
            domain_identifier
          )
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
      if ((dbEntry.portfolios as any)?.parent){
        coreProduct.portfolioName = (dbEntry.portfolios as any).parent.name;
        coreProduct.subPortfolioName = (dbEntry.portfolios as any).name;
      }else{
        coreProduct.portfolioName = (dbEntry.portfolios as any)?.name;
      }
      
      const listings = (dbEntry.product_listings as any[]).map(l => mapDbListingToProductListing(l));
      coreProduct.product_listings = listings;


      if (listings && listings.length > 0) {
        const primaryListing = listings.find(l => !l.isCompetitor);

        if (primaryListing) {
            coreProduct.name = primaryListing.productName ?? coreProduct.name;

            coreProduct.description = primaryListing.data?.description ?? coreProduct.description ?? 'N/A';
            coreProduct.imageUrl = primaryListing.data?.imageUrl ?? coreProduct.imageUrl;

            coreProduct.marketId = primaryListing.marketId;
            coreProduct.asinCode = primaryListing.asin;
            coreProduct.price = primaryListing.currentPrice;
            coreProduct.listPrice = primaryListing.listPrice;
            coreProduct.discount = primaryListing.discount;
            coreProduct.dealType = primaryListing.dealType;
            coreProduct.categoryRanks = primaryListing.categoryRanks;
            coreProduct.dispatchedFrom = primaryListing.dispatchedFrom;
            coreProduct.soldBy = primaryListing.soldBy;
            coreProduct.deliveryInfo = primaryListing.deliveryInfo;

            coreProduct.market = primaryListing.marketName;
            coreProduct.marketDomainIdentifier = primaryListing.marketDomainIdentifier;
            coreProduct.currency = primaryListing.currencySymbol;
            coreProduct.url = primaryListing.data?.url;
            coreProduct.lastUpdated = primaryListing.updatedOn;

            const listingManagerId = primaryListing.managerId;
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

    // Server-side sorting can be complex with dynamic fields; consider if client-side sort is sufficient.
    return mappedProducts;
  }

  async getProductByIdWithListings(productId: string): Promise<Product | null> {
    const supabase = this.getSupabaseClient();
    const { data: dbProduct, error } = await supabase
      .from('products')
      .select('*, portfolios(name), product_listings!left(*, markets!left(market_name, currency_symbol, domain_identifier), managers!left(name))')
      .eq('id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error(`Error fetching product ${productId} from Supabase:`, error);
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }
    if (!dbProduct) return null;

    const product: Product = productFromSnakeCase(dbProduct);
    if ((dbProduct.portfolios as any)?.name) {
        product.portfolioName = (dbProduct.portfolios as any).name;
    }
    const allListings = (dbProduct.product_listings as any[]).map(l => mapDbListingToProductListing(l));
    product.product_listings = allListings; 

    const mainListing = allListings.find(l => !l.isCompetitor);
    if (mainListing) {
      product.name = mainListing.productName ?? product.name;
      product.description = product.description;
      product.imageUrl = product.imageUrl;

      product.marketId = mainListing.marketId;
      product.asinCode = mainListing.asin;
      product.price = mainListing.currentPrice;
      product.listPrice = mainListing.listPrice;
      product.discount = mainListing.discount;
      product.dealType = mainListing.dealType;
      product.categoryRanks = mainListing.categoryRanks;
      product.dispatchedFrom = mainListing.dispatchedFrom;
      product.soldBy = mainListing.soldBy;
      product.deliveryInfo = mainListing.deliveryInfo;

      product.market = mainListing.marketName;
      product.marketDomainIdentifier = mainListing.marketDomainIdentifier;
      product.currency = mainListing.currencySymbol;
      product.primaryListingManagerName = mainListing.managerName;
      product.managerId = mainListing.managerId;
      product.url = mainListing?.url;
      product.lastUpdated = mainListing.updatedOn;
    }
    product.competitorListings = allListings.filter(l => l.isCompetitor);
    return product;
  }

  async addProductWithInitialListing(
    productCoreData: Partial<Product>,
    initialListingPayload: { marketId: string; managerId: string; asin: string; data: Partial<ProductListingData> }
  ): Promise<Product> {
    const supabase = this.getSupabaseClient();
    const productToInsert = productToSnakeCase(productCoreData);
    delete productToInsert.id;

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
        asin: initialListingPayload.asin,
        isCompetitor: false,
    };
    await productListingService.addProductListing(listingForCreation);

    return this.getProductByIdWithListings(createdProduct.id) as Promise<Product>;
  }

  async updateProduct(
    productId: string,
    productCoreData: Partial<Product>
  ): Promise<void> {
    const supabase = this.getSupabaseClient();
    const productToUpdate = productToSnakeCase(productCoreData);

    const coreProductFields = ['name', 'barcode', 'product_code', 'portfolio_id', 'description', 'properties', 'is_active', 'image_url', 'brand', 'keywords', 'associated_products', 'local_warehouse_lead_time', 'reorder_lead_time'];
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

  async searchProductsBySkuOrName(searchTerm: string, limit: number = 10, currentProductId?: string): Promise<{ id: string; productCode: string; name: string | null }[]> {
    const supabase = this.getSupabaseClient();
    let query = supabase
      .from('products')
      .select('id, product_code, name')
      .or(`product_code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
    
    if (currentProductId) {
      query = query.neq('id', currentProductId);
    }
    
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error searching products by SKU or name:', error);
      throw error;
    }
    return data ? data.map(p => ({ id: p.id, productCode: p.product_code, name: p.name })) : [];
  }

  async getProductByCode(productCode: string): Promise<Product | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching product by product_code ${productCode}:`, error);
      throw error;
    }
    return data ? productFromSnakeCase(data) : null;
  }

  async findOrCreateProductByCode(
    productCode: string,
    defaults: Partial<Product> & { barcode: string }
  ): Promise<Product> {
    const supabase = this.getSupabaseClient();
    const { data: existingProductDb, error: findError } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') { 
      console.error(`Error finding product by product_code ${productCode}:`, findError);
      throw findError;
    }

    if (existingProductDb) {
      const existingProduct = productFromSnakeCase(existingProductDb);
      const updates: Partial<Product> = {};
      // Check and add updates only if default value is different from existing
      if (defaults.name && defaults.name !== existingProduct.name) updates.name = defaults.name;
      if (defaults.description && defaults.description !== existingProduct.description) updates.description = defaults.description;
      if (defaults.imageUrl && defaults.imageUrl !== existingProduct.imageUrl) updates.imageUrl = defaults.imageUrl;
      if (defaults.brand && defaults.brand !== existingProduct.brand) updates.brand = defaults.brand;
      if (defaults.portfolioId && defaults.portfolioId !== existingProduct.portfolioId) updates.portfolioId = defaults.portfolioId;
      if (defaults.properties && JSON.stringify(defaults.properties) !== JSON.stringify(existingProduct.properties)) updates.properties = defaults.properties;
      if (defaults.associatedProducts && JSON.stringify(defaults.associatedProducts) !== JSON.stringify(existingProduct.associatedProducts)) updates.associatedProducts = defaults.associatedProducts;
      if (defaults.localWarehouseLeadTime !== undefined && defaults.localWarehouseLeadTime !== existingProduct.localWarehouseLeadTime) updates.localWarehouseLeadTime = defaults.localWarehouseLeadTime;
      if (defaults.reorderLeadTime !== undefined && defaults.reorderLeadTime !== existingProduct.reorderLeadTime) updates.reorderLeadTime = defaults.reorderLeadTime;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productToSnakeCase(updates))
          .eq('id', existingProduct.id);
        if (updateError) {
          console.error(`Error updating existing product ${existingProduct.id} during findOrCreate:`, updateError);
          throw updateError;
        }
        return { ...existingProduct, ...updates };
      }
      return existingProduct;
    } else {
      if (!defaults.barcode) {
          throw new Error(`Barcode is required to create a new product with productCode ${productCode}.`);
      }
      const productToInsert: any = productToSnakeCase({
        ...defaults,
        productCode: productCode,
        isActive: defaults.isActive !== undefined ? defaults.isActive : true,
      });

      const { data: newDbProduct, error: insertError } = await supabase
        .from('products')
        .insert(productToInsert)
        .select()
        .single();

      if (insertError || !newDbProduct) {
        console.error(`Error creating new product with product_code ${productCode}:`, insertError);
        throw insertError;
      }
      return productFromSnakeCase(newDbProduct);
    }
  }

  async findOneProductByTerm(searchTerm: string): Promise<Product | null> {
    const supabase = this.getSupabaseClient();
    const termTrimmed = searchTerm.trim();

    // 1. Try exact match on product_code
    let { data: productByCode, error: codeError } = await supabase
      .from('products')
      .select('id')
      .eq('product_code', termTrimmed)
      .maybeSingle();

    if (codeError) console.error("Error searching by product code:", codeError);
    if (productByCode) return this.getProductByIdWithListings(productByCode.id);

    // 2. Try exact match on ASIN in listings
    const { data: listingsByAsin, error: asinError } = await supabase
      .from('product_listings')
      .select('product_id')
      .eq('asin', termTrimmed)
      .limit(2);
    
    if (asinError) console.error("Error searching by ASIN:", asinError);
    if (listingsByAsin && listingsByAsin.length > 0) {
      const uniqueProductIds = [...new Set(listingsByAsin.map(l => l.product_id))];
      if (uniqueProductIds.length === 1) {
        return this.getProductByIdWithListings(uniqueProductIds[0]);
      }
      return null; // Ambiguous
    }
    
    // 3. Try ILIKE match on name and product_code
    const { data: productsByLike, error: likeError } = await supabase
      .from('products')
      .select('id')
      .or(`name.ilike.%${termTrimmed}%,product_code.ilike.%${termTrimmed}%`)
      .limit(2);

    if (likeError) console.error("Error searching by name/product_code:", likeError);
    if (productsByLike && productsByLike.length === 1) {
      return this.getProductByIdWithListings(productsByLike[0].id);
    }
    
    return null; // No single match found or ambiguous
  }

  async searchProductsForSuggestions(
    searchTerm: string, 
    limit: number = 10
  ): Promise<{ id: string; productCode: string; name: string | null; asin?: string | null }[]> {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const supabase = this.getSupabaseClient();
    const term = searchTerm.trim();

    // Query 1: Search products by name or product_code
    const productSearchPromise = supabase
      .from('products')
      .select('id, product_code, name')
      .or(`product_code.ilike.%${term}%,name.ilike.%${term}%`)
      .limit(limit);

    // Query 2: Search listings by ASIN
    const listingSearchPromise = supabase
      .from('product_listings')
      .select('product_id, asin')
      .ilike('asin', `%${term}%`)
      .limit(limit);

    const [productSearchResult, listingSearchResult] = await Promise.all([
      productSearchPromise,
      listingSearchPromise
    ]);

    if (productSearchResult.error) {
      console.error('Error searching products by name/code for suggestions:', productSearchResult.error);
      throw productSearchResult.error;
    }
    if (listingSearchResult.error) {
      console.error('Error searching listings by ASIN for suggestions:', listingSearchResult.error);
      throw listingSearchResult.error;
    }

    const productResults = (productSearchResult.data || []).map(p => ({
      id: p.id,
      productCode: p.product_code,
      name: p.name,
      asin: null, // We don't have the ASIN from this query
    }));

    let listingResults: { id: string; productCode: string; name: string | null; asin?: string | null }[] = [];
    const productIdsFromListings = [...new Set((listingSearchResult.data || []).map(l => l.product_id))];

    if (productIdsFromListings.length > 0) {
      const { data: productsFromListings, error: productsFromListingsError } = await supabase
        .from('products')
        .select('id, product_code, name')
        .in('id', productIdsFromListings);
      
      if (productsFromListingsError) {
        console.error('Error fetching products for ASIN matches:', productsFromListingsError);
      } else if (productsFromListings) {
        const productMap = new Map(productsFromListings.map(p => [p.id, { productCode: p.product_code, name: p.name }]));
        listingResults = (listingSearchResult.data || []).map(l => {
          const productDetails = productMap.get(l.product_id);
          return {
            id: l.product_id,
            productCode: productDetails?.productCode || 'N/A',
            name: productDetails?.name || null,
            asin: l.asin
          };
        });
      }
    }
    
    // Combine and deduplicate results
    const combinedResultsMap = new Map<string, { id: string; productCode: string; name: string | null; asin?: string | null }>();
    
    // Prioritize product matches
    productResults.forEach(p => combinedResultsMap.set(p.id, p));
    // Add listing matches, potentially updating with an ASIN if the product was already found
    listingResults.forEach(l => {
      if (combinedResultsMap.has(l.id)) {
        const existing = combinedResultsMap.get(l.id)!;
        if (!existing.asin && l.asin) {
          existing.asin = l.asin; // Add ASIN if it wasn't there
        }
      } else {
        combinedResultsMap.set(l.id, l);
      }
    });

    return Array.from(combinedResultsMap.values()).slice(0, limit);
  }
}

export const productsService = new ProductsService();
