"use server";


import type { MarketSetting } from '@/lib/types';
import { marketSettingsService } from '@/server/services/marketSettingsService';

export async function fetchActiveMarketSettings(): Promise<MarketSetting[]> {
  try {
    return await marketSettingsService.getActiveMarketSettings();
  } catch (error) {
    console.error("Error fetching active market settings:", error);
    return [];
  }
}

export async function fetchAllMarketSettings(): Promise<MarketSetting[]> {
  try {
    return await marketSettingsService.getAllMarketSettings();
  } catch (error) {
    console.error("Error fetching all market settings:", error);
    return [];
  }
}

export async function addMarketSettingAction(
  data: Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>
): Promise<{ success: boolean; message: string; market?: MarketSetting }> {
  try {
    const newMarket = await marketSettingsService.addMarketSetting(data);
    return { success: true, message: "Market setting added successfully.", market: newMarket };
  } catch (error) {
    console.error("Error adding market setting via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to add market setting: ${errorMessage}` };
  }
}

export async function updateMarketSettingAction(
  settingId: string,
  data: Partial<Omit<MarketSetting, 'id' | 'createdOn' | 'modifiedOn'>>
): Promise<{ success: boolean; message: string }> {
  try {
    await marketSettingsService.updateMarketSetting(settingId, data);
    return { success: true, message: "Market setting updated successfully." };
  } catch (error) {
    console.error(`Error updating market setting ${settingId} via action:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update market setting: ${errorMessage}` };
  }
}
