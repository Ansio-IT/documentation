import { type SupabaseClient } from '@supabase/supabase-js';
import type { ProductListing, MarketSetting, ManagerSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS)
const fromSnakeCase = (dbListing: any): ProductListing => {
  if (!dbListing) return {} as ProductListing;
  const listing: ProductListing = {
    id: dbListing.id,
    productId: dbListing.product_id,
    marketId: dbListing.market_id,
    managerId: dbListing.manager_id,
    asin: dbListing.asin,
    currentPrice: dbListing.current_price,
    listPrice: dbListing.list_price,
    discount: dbListing.discount,
    dealType: dbListing.deal_type,
    categoryRanks: dbListing.category_ranks,
    dispatchedFrom: dbListing.dispatched_from,
    soldBy: dbListing.sold_by,
    deliveryInfo: dbListing.delivery_info,
    brand: dbListing.brand,
    productName: dbListing.product_name,
    isCompetitor: dbListing.is_competitor,
    createdOn: dbListing.created_on,
    updatedOn: dbListing.updated_on,
    data: dbListing.data,
  };
  // Add market/manager info directly to listing if needed
  if (dbListing.markets) {
    listing.marketName = dbListing.markets.market_name;
    listing.currencySymbol = dbListing.markets.currency_symbol;
    listing.marketDomainIdentifier = dbListing.markets.domain_identifier;
  }
  if (dbListing.managers) {
    listing.managerName = dbListing.managers.name;
  }
  return listing;
};
export const mapDbListingToProductListing = fromSnakeCase;


// Helper to convert from camelCase (JS/TS) to snake_case (Supabase)
const toSnakeCase = (listing: Partial<ProductListing>): any => {
  const result: any = {};
  if (listing.id !== undefined) result.id = listing.id;
  if (listing.productId !== undefined) result.product_id = listing.productId;
  if (listing.marketId !== undefined) result.market_id = listing.marketId;
  if (listing.managerId !== undefined) result.manager_id = listing.managerId;
  if (listing.asin !== undefined) result.asin = listing.asin;
  if (listing.currentPrice !== undefined) result.current_price = listing.currentPrice;
  if (listing.listPrice !== undefined) result.list_price = listing.listPrice;
  if (listing.discount !== undefined) result.discount = listing.discount;
  if (listing.dealType !== undefined) result.deal_type = listing.dealType;
  if (listing.categoryRanks !== undefined) result.category_ranks = listing.categoryRanks;
  if (listing.dispatchedFrom !== undefined) result.dispatched_from = listing.dispatchedFrom;
  if (listing.soldBy !== undefined) result.sold_by = listing.soldBy;
  if (listing.deliveryInfo !== undefined) result.delivery_info = listing.deliveryInfo;
  // REMOVE data
  if (listing.isCompetitor !== undefined) result.is_competitor = listing.isCompetitor;
  return result;
};

class ProductListingService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }
  
  async getAllProductListings(): Promise<ProductListing[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('product_listings')
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)');

    if (error) {
      console.error("Error fetching all product listings from Supabase:", error);
      throw new Error(`Failed to fetch all product listings: ${error.message}`);
    }
    return data ? data.map(fromSnakeCase) : [];
  }


  async addProductListing(
    listingData: Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn'>
  ): Promise<ProductListing> {
    const supabase = this.getSupabaseClient();
    const listingToInsert = toSnakeCase(listingData);
    
    if (!listingToInsert.manager_id) {
        throw new Error("Manager ID is required for creating a product listing.");
    }
    delete listingToInsert.created_on;
    delete listingToInsert.updated_on;

    const { data: newDbListing, error } = await supabase
      .from('product_listings')
      .insert(listingToInsert)
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .single();

    if (error || !newDbListing) {
      console.error("Error adding product listing to Supabase:", error);
      throw new Error(`Failed to add product listing: ${error?.message}`);
    }
    return fromSnakeCase(newDbListing);
  }

  async getProductListingById(listingId: string): Promise<ProductListing | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
        .from('product_listings')
        .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
        .eq('id', listingId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error(`Error fetching product listing by ID ${listingId}:`, error);
        throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }


  async updateProductListing(listingId: string, listingUpdates: Partial<Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn'>>): Promise<ProductListing> {
    const supabase = this.getSupabaseClient();
    const updatesToApply = toSnakeCase(listingUpdates);
    updatesToApply.updated_on = new Date().toISOString(); 


    const { data: updatedDbListing, error: updateError } = await supabase
      .from('product_listings')
      .update(updatesToApply)
      .eq('id', listingId)
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .single();

    if (updateError || !updatedDbListing) {
      console.error(`Error updating product listing ${listingId}:`, updateError);
      throw new Error(`Failed to update product listing: ${updateError?.message}`);
    }
    return fromSnakeCase(updatedDbListing);
  }

  async getProductListingsByProductId(productId: string): Promise<ProductListing[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('product_listings')
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .eq('product_id', productId);

    if (error) {
      console.error(`Error fetching listings for product ${productId}:`, error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getCompetitorListingsForProduct(mainProductId: string): Promise<ProductListing[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('product_listings')
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .eq('product_id', mainProductId)
      .eq('is_competitor', true);

    if (error) {
      console.error(`Error fetching competitor listings for product ${mainProductId}:`, error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async deleteProductListing(listingId: string): Promise<void> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('product_listings')
      .delete()
      .eq('id', listingId);
    if (error) {
      console.error(`Error deleting product listing ${listingId}:`, error);
      throw error;
    }
  }

   async findProductListingByAsinAndMarket(
    asin: string, 
    marketId: string, 
    productIdForContext?: string, 
    isCompetitor?: boolean
  ): Promise<ProductListing | null> {
    const supabase = this.getSupabaseClient();
    let query = supabase
      .from('product_listings')
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .eq('asin', asin)
      .eq('market_id', marketId);

    if (productIdForContext !== undefined) {
      query = query.eq('product_id', productIdForContext);
    }
    if (isCompetitor !== undefined) {
      query = query.eq('is_competitor', isCompetitor);
    }
    
    const { data, error } = await query.maybeSingle();


    if (error && error.code !== 'PGRST116') { 
      console.error(`Error finding product listing by ASIN ${asin} and Market ${marketId}:`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async findOrCreateProductListing(
    listingPayload: Partial<Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn'>>
  ): Promise<ProductListing> {
    const supabase = this.getSupabaseClient();

    if (!listingPayload.productId || !listingPayload.marketId || !listingPayload.asin) {
        throw new Error("productId, marketId, and asin are required to find or create a listing.");
    }

    const { data: existingListing, error: findError } = await supabase
        .from('product_listings')
        .select('*')
        .eq('product_id', listingPayload.productId)
        .eq('market_id', listingPayload.marketId)
        .eq('asin', listingPayload.asin)
        .eq('is_competitor', listingPayload.isCompetitor === true) // Default to false if not provided
        .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding product listing:', findError);
        throw findError;
    }

    if (existingListing) {
        const updates = toSnakeCase(listingPayload);
        delete updates.id;
        delete updates.product_id;
        delete updates.market_id;
        delete updates.asin;

        const { data: updatedDbListing, error: updateError } = await supabase
            .from('product_listings')
            .update(updates)
            .eq('id', existingListing.id)
            .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
            .single();
        
        if (updateError || !updatedDbListing) {
            console.error(`Error updating product listing ${existingListing.id}:`, updateError);
            throw updateError;
        }
        return fromSnakeCase(updatedDbListing);
    } else {
        const newListingData = {
            ...listingPayload,
            isCompetitor: listingPayload.isCompetitor === true,
        };
        return this.addProductListing(newListingData as Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn'>);
    }
  }
}

export const productListingService = new ProductListingService();

// In your ProductListing type import, add the optional fields if not present
// type ProductListing = { ...existing fields... } & {
//   marketName?: string;
//   currencySymbol?: string;
//   marketDomainIdentifier?: string;
//   managerName?: string;
// };
// If you control the type definition, update it in src/lib/types.ts. For now, extend here for type safety:
declare module '@/lib/types' {
  interface ProductListing {
    marketName?: string;
    currencySymbol?: string;
    marketDomainIdentifier?: string;
    managerName?: string;
  }
}
