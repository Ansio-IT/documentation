
import { type SupabaseClient } from '@supabase/supabase-js';
import type { ManagerSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS) for 'managers' table
const fromSnakeCase = (dbSetting: any): ManagerSetting => {
  if (!dbSetting) return {} as ManagerSetting; // Should not happen if query is correct
  return {
    id: dbSetting.id,
    name: dbSetting.name,
    role: dbSetting.role,
    isActive: dbSetting.is_active,
    createdOn: dbSetting.created_on,
    modifiedOn: dbSetting.modified_on,
  };
};

// Helper to convert from camelCase (JS/TS) to snake_case (Supabase) for 'managers' table
const toSnakeCase = (setting: Partial<ManagerSetting>): any => {
  const result: any = {};
  if (setting.id !== undefined) result.id = setting.id;
  if (setting.name !== undefined) result.name = setting.name;
  if (setting.role !== undefined) result.role = setting.role;
  if (setting.isActive !== undefined) result.is_active = setting.isActive;
  // Timestamps handled by DB or triggers
  return result;
};

class ManagerSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getAllManagerSettings(): Promise<ManagerSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.from('managers').select('*').order('name', { ascending: true });
    if (error) {
      console.error("Error fetching all manager settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getActiveManagerSettings(): Promise<ManagerSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching active manager settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getManagerById(managerId: string): Promise<ManagerSetting | null> {
    if (!managerId) return null;
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .eq('id', managerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // "PGRST116" code means no rows found
        console.warn(`Manager with ID ${managerId} not found.`);
        return null;
      }
      console.error(`Error fetching manager by ID ${managerId} from Supabase:`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async getManagerByName(name: string): Promise<ManagerSetting | null> {
    if (!name || name.trim() === '') return null;
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching manager by name "${name}":`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }

  async addManagerSetting(settingData: Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>): Promise<ManagerSetting> {
    const supabase = this.getSupabaseClient();
    const settingToInsert = toSnakeCase(settingData);
    // created_on and modified_on will be set by DB defaults/trigger
    delete settingToInsert.created_on;
    delete settingToInsert.modified_on;

    const { data, error } = await supabase.from('managers').insert(settingToInsert).select().single();
    if (error) {
      console.error("Error adding manager setting to Supabase:", error);
      throw error;
    }
    if (!data) {
        throw new Error("Failed to retrieve added manager setting, data is null.");
    }
    return fromSnakeCase(data);
  }

  async updateManagerSetting(settingId: string, settingData: Partial<Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>>): Promise<void> {
    const supabase = this.getSupabaseClient();
    const settingToUpdate = toSnakeCase(settingData);
    // Supabase trigger handles modified_on
    delete settingToUpdate.created_on;
    delete settingToUpdate.modified_on;
    
    const { error } = await supabase.from('managers').update(settingToUpdate).eq('id', settingId);
    if (error) {
      console.error(`Error updating manager setting ${settingId} in Supabase:`, error);
      throw new Error(`Failed to update manager setting ${settingId}: ${error.message}`);
    }
  }
}

export const managerSettingsService = new ManagerSettingsService();
