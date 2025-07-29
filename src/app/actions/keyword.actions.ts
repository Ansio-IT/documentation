
"use server";

import { cookies } from "next/headers";
import { FetchKeywordMetricsParams, Keyword, KeywordMetricsMap, FetchTopKeywordsParams, TopKeyword } from "@/lib/types";
import { keywordService } from "@/server/services/keywordService";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// Keyword Master Actions
export async function fetchAllKeywordsAction(): Promise<Keyword[]> {
  try {
    return await keywordService.getAllKeywords();
  } catch (error) {
    console.error("Error fetching all keywords via action:", error);
    return [];
  }
}

export async function addKeywordAction(
  data: Omit<Keyword, 'id' | 'createdAt' | 'updatedOn'>
): Promise<{ success: boolean; message: string; keyword?: Keyword }> {
  try {
    const newKeyword = await keywordService.addKeyword(data);
    return { success: true, message: "Keyword added successfully.", keyword: newKeyword };
  } catch (error) {
    console.error("Error adding keyword via action:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('duplicate key value violates unique constraint "keywords_keyword_key"')) {
        return { success: false, message: `Failed to add keyword: The keyword "${data.keyword}" already exists.` };
    }
    return { success: false, message: `Failed to add keyword: ${errorMessage}` };
  }
}

export async function updateKeywordAction(
    keywordId: string,
    data: Partial<{ portfolio_id: string | null; priority_id: string | null; }>
): Promise<{ success: boolean; message: string }> {
    try {
        await keywordService.updateKeyword(keywordId, {
            portfolio_id: data.portfolio_id,
            priority_id: data.priority_id,
        });
        return { success: true, message: "Keyword updated successfully." };
    } catch (error) {
        console.error(`Error updating keyword ${keywordId} via action:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Failed to update keyword: ${errorMessage}` };
    }
}


export async function deleteKeywordAction(keywordId: string): Promise<{ success: boolean; message: string }> {
  try {
    await keywordService.deleteKeyword(keywordId);
    return { success: true, message: "Keyword deleted successfully." };
  } catch (error) {
    console.error(`Error deleting keyword ${keywordId} via action:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to delete keyword: ${errorMessage}` };
  }
}

export async function batchUpsertKeywordsAction(
  keywords: { keyword: string; portfolio_id?: string; subportfolio_id?: string; priority_id?: string }[]
): Promise<{ success: boolean; countAdded: number; countDuplicates: number; errors: any[] }> {
    if (!keywords || keywords.length === 0) {
        return { success: true, countAdded: 0, countDuplicates: 0, errors: [] };
    }

    try {
        const allExistingKeywords = await keywordService.getAllKeywords();
        const existingKeywordSet = new Set(allExistingKeywords.map(k => k.keyword.toLowerCase()));

        const newKeywordsToInsert: { keyword: string; portfolio_id?: string; subportfolio_id?: string; priority_id?: string }[] = [];
        let duplicateCount = 0;

        for (const kw of keywords) {
            if (kw.keyword && kw.keyword.trim() !== '') {
                const lowerKw = kw.keyword.toLowerCase();
                if (!existingKeywordSet.has(lowerKw)) {
                    newKeywordsToInsert.push(kw);
                    existingKeywordSet.add(lowerKw);
                } else {
                    duplicateCount++;
                }
            }
        }

        if (newKeywordsToInsert.length === 0) {
            return { success: true, countAdded: 0, countDuplicates: duplicateCount, errors: [] };
        }

        const supabase = createServerSupabaseClient(cookies());
        const { data, error } = await supabase.from('keywords').insert(newKeywordsToInsert).select();

        if (error) {
            console.error("Error batch inserting keywords:", error);
            return { success: false, countAdded: 0, countDuplicates: duplicateCount, errors: [error] };
        }

        return {
            success: true,
            countAdded: data?.length || 0,
            countDuplicates: duplicateCount,
            errors: [],
        };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, countAdded: 0, countDuplicates: 0, errors: [{ message: errorMessage }] };
    }
}


export async function fetchKeywordMetricsForAsinsAction(
  params: FetchKeywordMetricsParams
): Promise<KeywordMetricsMap> {
  console.warn(`[STUB] fetchKeywordMetricsForAsinsAction called with params: ${JSON.stringify(params)}. This action needs to be implemented to fetch actual data from search_visibility_metrics table.`);
  const metricsMap: KeywordMetricsMap = {};
  return metricsMap;
}

export async function fetchTopKeywordsAction(
  params: FetchTopKeywordsParams
): Promise<TopKeyword[]> {
  console.warn(`[STUB] fetchTopKeywordsAction called with params: ${JSON.stringify(params)}. This action needs to be implemented to fetch actual data from search_visibility_metrics table.`);
  return [
  ];
}


