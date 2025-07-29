
import { type SupabaseClient } from '@supabase/supabase-js';
import type { MarketSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS)
const fromSnakeCase = (dbSetting: any): MarketSetting => {
  if (!dbSetting) return {} as MarketSetting;
  return {
    id: dbSetting.id,
    marketName: dbSetting.market_name,
    currencySymbol: dbSetting.currency_symbol,
    domainIdentifier: dbSetting.domain_identifier,
    isActive: dbSetting.is_active,
    createdOn: dbSetting.created_on,
    modifiedOn: dbSetting.modified_on,
  };
};

// Helper to convert from camelCase (JS/TS) to snake_case (Supabase)
const toSnakeCase = (setting: Partial<MarketSetting>): any => {
  const result: any = {};
  if (setting.id !== undefined) result.id = setting.id;
  if (setting.marketName !== undefined) result.market_name = setting.marketName;
  if (setting.currencySymbol !== undefined) result.currency_symbol = setting.currencySymbol;
  if (setting.domainIdentifier !== undefined) result.domain_identifier = setting.domainIdentifier;
  if (setting.isActive !== undefined) result.is_active = setting.isActive;
  // created_on and modified_on are typically handled by Supabase, but include if explicit update needed
  if (setting.createdOn !== undefined) result.created_on = setting.createdOn;
  if (setting.modifiedOn !== undefined) result.modified_on = setting.modifiedOn;
  return result;
};

class MarketSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getAllMarketSettings(): Promise<MarketSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.from('markets').select('*').order('market_name', { ascending: true });
    if (error) {
      console.error("Error fetching all market settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getActiveMarketSettings(): Promise<MarketSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('is_active', true)
      .order('market_name', { ascending: true });
    if (error) {
      console.error("Error fetching active market settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }
  
  async getMarketById(marketId: string): Promise<MarketSetting | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single();
    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error(`Error fetching market by ID ${marketId}:`, error);
        throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async getMarketByName(marketName: string): Promise<MarketSetting | null> {
    if (!marketName || marketName.trim() === '') return null;
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('market_name', marketName)
      .maybeSingle(); 

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching market by name "${marketName}":`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }


  async addMarketSetting(settingData: Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>): Promise<MarketSetting> {
    const supabase = this.getSupabaseClient();
    const settingToInsert = toSnakeCase(settingData);
    // created_on and modified_on will be set by DB defaults
    delete settingToInsert.created_on;
    delete settingToInsert.modified_on;


    const { data, error } = await supabase.from('markets').insert(settingToInsert).select().single();
    if (error) {
      console.error("Error adding market setting to Supabase:", error);
      throw error;
    }
    return data ? fromSnakeCase(data) : Promise.reject(new Error("Failed to retrieve added market setting"));
  }

  async updateMarketSetting(settingId: string, settingData: Partial<Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>>): Promise<void> {
    const supabase = this.getSupabaseClient();
    const settingToUpdate = toSnakeCase(settingData);
    // Supabase trigger handles modified_on
    delete settingToUpdate.created_on;
    delete settingToUpdate.modified_on;
    
    const { error } = await supabase.from('markets').update(settingToUpdate).eq('id', settingId);
    if (error) {
      console.error(`Error updating market setting ${settingId} in Supabase:`, error);
      throw new Error(`Failed to update market setting ${settingId}: ${error.message}`);
    }
  }
}

export const marketSettingsService = new MarketSettingsService();
