
import { type SupabaseClient } from '@supabase/supabase-js';
import type { ExternalApiData } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS)
const fromSnakeCase = (dbData: any): ExternalApiData => {
  if (!dbData) return {} as ExternalApiData;
  return {
    id: dbData.id,
    productListingId: dbData.product_listing_id,
    provider: dbData.provider,
    data: dbData.data,
    createdAt: dbData.created_at,
  };
};

// Helper to convert from camelCase (JS/TS) to snake_case (Supabase)
const toSnakeCase = (apiData: Partial<ExternalApiData>): any => {
  const result: any = {};
  if (apiData.id !== undefined) result.id = apiData.id;
  if (apiData.productListingId !== undefined) result.product_listing_id = apiData.productListingId;
  if (apiData.provider !== undefined) result.provider = apiData.provider;
  if (apiData.data !== undefined) result.data = apiData.data;
  // createdAt is handled by Supabase default
  return result;
};

class ExternalApiDataService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async addExternalApiData(
    apiDataPayload: Omit<ExternalApiData, 'id' | 'createdAt'>
  ): Promise<ExternalApiData> {
    const supabase = this.getSupabaseClient();
    const dataToInsert = toSnakeCase(apiDataPayload);

    const { data: newDbData, error } = await supabase
      .from('external_api_data')
      .insert(dataToInsert)
      .select()
      .single();

    if (error || !newDbData) {
      console.error("Error adding external API data to Supabase:", error);
      throw new Error(`Failed to add external API data: ${error?.message}`);
    }
    return fromSnakeCase(newDbData);
  }

  async getExternalApiDataByListingId(productListingId: string): Promise<ExternalApiData[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('external_api_data')
      .select('*')
      .eq('product_listing_id', productListingId)
      .order('created_at', { ascending: false }); // Get latest first

    if (error) {
      console.error(`Error fetching external API data for listing ${productListingId}:`, error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }
}

export const externalApiDataService = new ExternalApiDataService();
