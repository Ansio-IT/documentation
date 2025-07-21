
import { type SupabaseClient } from '@supabase/supabase-js';
import type { ProductListing, ProductListingData, MarketSetting, ManagerSetting } from '@/lib/types';
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
    data: dbListing.data || {},
    isCompetitor: dbListing.is_competitor,
    createdOn: dbListing.created_on,
    updatedOn: dbListing.updated_on,
  };

  // Ensure that the data field gets populated with joined market and manager info
  // if the joins are present in the Supabase query.
  if (dbListing.markets) { // dbListing.markets is the object { market_name: '...', currency_symbol: '...' }
    listing.data.marketName = dbListing.markets.market_name; // Access snake_case
    listing.data.currencySymbol = dbListing.markets.currency_symbol; // Access snake_case
    listing.data.marketDomainIdentifier = dbListing.markets.domain_identifier; // Access snake_case
  }
  if (dbListing.managers) { // dbListing.managers is the object { name: '...' }
    listing.data.managerName = dbListing.managers.name; // Access snake_case (assuming 'name' is the column)
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
  if (listing.data !== undefined) result.data = listing.data;
  if (listing.isCompetitor !== undefined) result.is_competitor = listing.isCompetitor;
  // created_on and updated_on are handled by Supabase defaults/triggers or explicitly in update methods
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
    // DB defaults will handle created_on and updated_on
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


  async updateProductListingData(listingId: string, newData: Partial<ProductListingData>): Promise<ProductListing> {
    const supabase = this.getSupabaseClient();

    const { data: existingListing, error: fetchError } = await supabase
        .from('product_listings')
        .select('data')
        .eq('id', listingId)
        .single();

    if (fetchError || !existingListing) {
        console.error(`Error fetching existing listing data for ${listingId}:`, fetchError);
        throw new Error(`Failed to fetch existing listing for update: ${fetchError?.message || 'Not found'}`);
    }

    const mergedData = { ...existingListing.data, ...newData };

    const { data: updatedDbListing, error: updateError } = await supabase
      .from('product_listings')
      .update({ data: mergedData, updated_on: new Date().toISOString() }) 
      .eq('id', listingId)
      .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
      .single();

    if (updateError || !updatedDbListing) {
      console.error(`Error updating product listing data for ${listingId}:`, updateError);
      throw new Error(`Failed to update product listing data: ${updateError?.message}`);
    }
    return fromSnakeCase(updatedDbListing);
  }

  async updateProductListing(listingId: string, listingUpdates: Partial<Omit<ProductListing, 'id' | 'createdOn' | 'updatedOn' | 'data'>>): Promise<ProductListing> {
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


  async upsertProductListingByAsinAndMarket(
    asin: string,
    marketId: string,
    listingWebhookData: ProductListingData,
    ourProductIdForContext?: string | null,
    managerIdForContext?: string | null, 
    isCompetitorFlag: boolean = false
  ): Promise<ProductListing> {
    const supabase = this.getSupabaseClient();

    const { data: existingListings, error: findError } = await supabase
      .from('product_listings')
      .select('id, data, product_id, is_competitor, manager_id')
      .eq('data->>asinCode', asin)
      .eq('market_id', marketId);

    if (findError) {
      console.error(`Error finding listing for ASIN ${asin}, Market ${marketId}:`, findError);
      throw findError;
    }

    let targetListing = existingListings?.find(l => l.is_competitor === isCompetitorFlag) || (existingListings ? existingListings[0] : null);


    if (targetListing) {
      const currentData = targetListing.data as ProductListingData || {};
      const updatedDataForJsonb = { ...currentData, ...listingWebhookData };
      const updatesForListing: any = { data: updatedDataForJsonb, updated_on: new Date().toISOString() }; 

      if (managerIdForContext && !targetListing.is_competitor && targetListing.manager_id !== managerIdForContext) {
          updatesForListing.manager_id = managerIdForContext;
      }


      const { data: updatedDbListing, error: updateError } = await supabase
        .from('product_listings')
        .update(updatesForListing)
        .eq('id', targetListing.id)
        .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
        .single();

      if (updateError || !updatedDbListing) {
        console.error(`Error updating product listing ${targetListing.id}:`, updateError);
        throw new Error(`Failed to update product listing: ${updateError?.message}`);
      }
      console.log(`Product listing ${targetListing.id} (ASIN: ${asin}) updated.`);
      return fromSnakeCase(updatedDbListing);
    } else {
      if (!ourProductIdForContext) {
          console.warn(`Attempted to create new listing for ASIN ${asin} in market ${marketId} without a parent product_id. Skipping creation.`);
          throw new Error(`Cannot create listing for ASIN ${asin} without a linking product_id.`);
      }
      if (!managerIdForContext) {
          console.error(`Attempted to create new listing for ASIN ${asin} in market ${marketId} without a manager_id. This is required.`);
          throw new Error(`Cannot create listing for ASIN ${asin} without a manager_id. Manager ID is required.`);
      }

      const newListingPayload: any = { 
        product_id: ourProductIdForContext,
        market_id: marketId,
        manager_id: managerIdForContext,
        data: listingWebhookData,
        is_competitor: isCompetitorFlag,
      };

      const { data: newDbListing, error: insertError } = await supabase
        .from('product_listings')
        .insert(newListingPayload)
        .select('*, markets (market_name, currency_symbol, domain_identifier), managers (name)')
        .single();

      if (insertError || !newDbListing) {
        console.error(`Error creating new product listing for ASIN ${asin}:`, insertError);
        throw new Error(`Failed to create new product listing: ${insertError?.message}`);
      }
      console.log(`New product listing created for ASIN ${asin} (ID: ${newDbListing.id}).`);
      return fromSnakeCase(newDbListing);
    }
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
      .eq('data->>asinCode', asin)
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
}

export const productListingService = new ProductListingService();
