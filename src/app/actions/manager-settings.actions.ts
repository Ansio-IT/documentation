
"use server";

import type { ManagerSetting } from '@/lib/types';
import { managerSettingsService } from '@/server/services/managerSettingsService';

export async function fetchAllManagerSettings(): Promise<ManagerSetting[]> {
  try {
    return await managerSettingsService.getAllManagerSettings();
  } catch (error) {
    console.error("Error fetching all manager settings:", error);
    return [];
  }
}

export async function fetchActiveManagerSettings(): Promise<ManagerSetting[]> {
  try {
    return await managerSettingsService.getActiveManagerSettings();
  } catch (error) {
    console.error("Error fetching active manager settings:", error);
    return [];
  }
}

export async function addManagerSettingAction(
  data: Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>
): Promise<{ success: boolean; message: string; manager?: ManagerSetting }> {
  try {
    const newManager = await managerSettingsService.addManagerSetting(data);
    return { success: true, message: "Manager setting added successfully.", manager: newManager };
  } catch (error) {
    console.error("Error adding manager setting via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to add manager setting: ${errorMessage}` };
  }
}

export async function updateManagerSettingAction(
  settingId: string,
  data: Partial<Omit<ManagerSetting, 'id' | 'createdOn' | 'modifiedOn'>>
): Promise<{ success: boolean; message: string }> {
  try {
    await managerSettingsService.updateManagerSetting(settingId, data);
    return { success: true, message: "Manager setting updated successfully." };
  } catch (error) {
    console.error(`Error updating manager setting ${settingId} via action:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to update manager setting: ${errorMessage}` };
  }
}
