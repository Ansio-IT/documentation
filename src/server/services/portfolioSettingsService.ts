
import { type SupabaseClient } from '@supabase/supabase-js';
import type { PortfolioSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const fromSnakeCase = (dbSetting: any): PortfolioSetting => {
  if (!dbSetting) return {} as PortfolioSetting;
  return {
    id: dbSetting.id,
    name: dbSetting.name,
    createdOn: dbSetting.created_on,
    modifiedOn: dbSetting.modified_on,
    parentId: dbSetting.parent_id,
  };
};

const toSnakeCase = (setting: Partial<PortfolioSetting>): any => {
  const result: any = {};
  if (setting.id !== undefined) result.id = setting.id;
  if (setting.name !== undefined) result.name = setting.name;
  if (setting.parentId !== undefined) result.parent_id = setting.parentId;
  return result;
};

class PortfolioSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getTopLevelPortfolios(): Promise<PortfolioSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .is('parent_id', null)
      .order('name', { ascending: true });
      
    if (error) {
      console.error("Error fetching top-level portfolios:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getSubPortfoliosByParentId(parentId: string): Promise<PortfolioSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('parent_id', parentId)
      .order('name', { ascending: true });

    if (error) {
      console.error(`Error fetching sub-portfolios for parent ${parentId}:`, error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getPortfolioWithParent(portfolioId: string): Promise<{ portfolio: PortfolioSetting, parent: PortfolioSetting | null } | null> {
    if (!portfolioId) return null;
    const supabase = this.getSupabaseClient();
    
    // Fetch the portfolio itself and its parent in one go.
    // The syntax `parent:parent_id (*)` tells Supabase to join on the parent_id foreign key.
    const { data, error } = await supabase
      .from('portfolios')
      .select(`
        *,
        parent:parent_id (
          *
        )
      `)
      .eq('id', portfolioId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found is not an error here
      console.error(`Error fetching portfolio with parent for ID ${portfolioId}:`, error);
      throw error;
    }

    if (!data) return null;

    return {
      portfolio: fromSnakeCase(data),
      parent: data.parent ? fromSnakeCase(data.parent) : null,
    };
  }

  async getAllPortfolioSettings(): Promise<PortfolioSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.from('portfolios').select('*').order('name', { ascending: true });
    if (error) {
      console.error("Error fetching all portfolio settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getPortfolioById(portfolioId: string): Promise<PortfolioSetting | null> {
    if (!portfolioId) return null;
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error(`Error fetching portfolio by ID ${portfolioId} from Supabase:`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async getPortfolioByName(name: string): Promise<PortfolioSetting | null> {
    if (!name || name.trim() === '') return null;
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('name', name)
      .maybeSingle(); 

    if (error && error.code !== 'PGRST116') { 
      console.error(`Error fetching portfolio by name "${name}" from Supabase:`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async addPortfolioSetting(settingData: Omit<PortfolioSetting, 'id' | 'createdOn' | 'modifiedOn'>): Promise<PortfolioSetting> {
    const supabase = this.getSupabaseClient();
    const settingToInsert = toSnakeCase(settingData);
    delete settingToInsert.created_on;
    delete settingToInsert.modified_on;

    const { data, error } = await supabase.from('portfolios').insert(settingToInsert).select().single();
    if (error) {
      console.error("Error adding portfolio setting to Supabase:", error);
      throw error;
    }
    if (!data) throw new Error("Failed to retrieve added portfolio setting.");
    return fromSnakeCase(data);
  }

  async updatePortfolioSetting(settingId: string, settingData: Partial<Omit<PortfolioSetting, 'id' | 'createdOn' | 'modifiedOn'>>): Promise<void> {
    const supabase = this.getSupabaseClient();
    const settingToUpdate = toSnakeCase(settingData);
    delete settingToUpdate.created_on;
    delete settingToUpdate.modified_on;
    
    const { error } = await supabase.from('portfolios').update(settingToUpdate).eq('id', settingId);
    if (error) {
      console.error(`Error updating portfolio setting ${settingId} in Supabase:`, error);
      throw new Error(`Failed to update portfolio setting ${settingId}: ${error.message}`);
    }
  }

  async getSubPortfolios(portfolioName: string): Promise<string[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('marketing_data')
      .select('sub_portfolio')
      .eq('portfolio', portfolioName)
      .not('sub_portfolio', 'is', null);

    if (error) {
      console.error(`Error fetching sub-portfolios for ${portfolioName}:`, error);
      return [];
    }

    if (!data) return [];
    
    const uniqueSubPortfolios = [...new Set(data.map(item => item.sub_portfolio).filter(Boolean) as string[])];
    return uniqueSubPortfolios.sort();
  }
}

export const portfolioSettingsService = new PortfolioSettingsService();

  
