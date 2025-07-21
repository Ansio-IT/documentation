
import { type SupabaseClient } from '@supabase/supabase-js';
import type { OwnerSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS) for 'managers' table
const fromSnakeCase = (dbSetting: any): OwnerSetting => {
  if (!dbSetting) return {} as OwnerSetting;
  return {
    id: dbSetting.id,
    name: dbSetting.name, // 'name' in DB
    role: dbSetting.role,
    isActive: dbSetting.is_active, // 'is_active' in DB
    createdOn: dbSetting.created_on, // 'created_on' in DB
    modifiedOn: dbSetting.modified_on, // 'modified_on' in DB
  };
};

// Helper to convert from camelCase (JS/TS) to snake_case (Supabase) for 'managers' table
const toSnakeCase = (setting: Partial<OwnerSetting>): any => {
  const result: any = {};
  if (setting.id !== undefined) result.id = setting.id;
  if (setting.name !== undefined) result.name = setting.name; // 'name' in DB
  if (setting.role !== undefined) result.role = setting.role;
  if (setting.isActive !== undefined) result.is_active = setting.isActive; // 'is_active' in DB
  // Timestamps handled by DB or triggers
  return result;
};

class OwnerSettingsService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getAllOwnerSettings(): Promise<OwnerSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.from('managers').select('*').order('name', { ascending: true });
    if (error) {
      console.error("Error fetching all owner/manager settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async getActiveOwnerSettings(): Promise<OwnerSetting[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error("Error fetching active owner/manager settings from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async addOwnerSetting(settingData: Omit<OwnerSetting, 'id' | 'createdOn' | 'modifiedOn'>): Promise<OwnerSetting> {
    const supabase = this.getSupabaseClient();
    const settingToInsert = toSnakeCase(settingData);
    // created_on and modified_on will be set by DB defaults/trigger
    delete settingToInsert.created_on;
    delete settingToInsert.modified_on;

    const { data, error } = await supabase.from('managers').insert(settingToInsert).select().single();
    if (error) {
      console.error("Error adding owner/manager setting to Supabase:", error);
      throw error;
    }
    return data ? fromSnakeCase(data) : Promise.reject(new Error("Failed to retrieve added owner/manager setting"));
  }

  async updateOwnerSetting(settingId: string, settingData: Partial<Omit<OwnerSetting, 'id' | 'createdOn' | 'modifiedOn'>>): Promise<void> {
    const supabase = this.getSupabaseClient();
    const settingToUpdate = toSnakeCase(settingData);
    // Supabase trigger handles modified_on
    delete settingToUpdate.created_on;
    delete settingToUpdate.modified_on;
    
    const { error } = await supabase.from('managers').update(settingToUpdate).eq('id', settingId);
    if (error) {
      console.error(`Error updating owner/manager setting ${settingId} in Supabase:`, error);
      throw new Error(`Failed to update owner/manager setting ${settingId}: ${error.message}`);
    }
  }
}

export const ownerSettingsService = new OwnerSettingsService();
