
import { type SupabaseClient } from '@supabase/supabase-js';
import type { Keyword, PortfolioSetting } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Helper to convert from snake_case (Supabase) to camelCase (JS/TS) for 'keywords' table
const fromSnakeCase = (dbKeyword: any): Keyword => {
  if (!dbKeyword) return {} as Keyword;
  return {
    id: dbKeyword.id,
    keyword: dbKeyword.keyword,
    portfolio_id: dbKeyword.portfolio_id,
    subportfolio_id: dbKeyword.subportfolio_id,
    priority_id: dbKeyword.priority_id,
    createdAt: dbKeyword.created_at,
    updatedOn: dbKeyword.updated_on,
    portfolioName: (dbKeyword.portfolios as any)?.name,
    subPortfolioName: (dbKeyword.portfolios as any)?.parent_id ? (dbKeyword.portfolios as any).name : null,
  };
};

// Helper to convert from camelCase (JS/TS) to snake_case (Supabase) for 'keywords' table
const toSnakeCase = (keywordData: Partial<Keyword>): any => {
  const result: any = {};
  if (keywordData.id !== undefined) result.id = keywordData.id;
  if (keywordData.keyword !== undefined) result.keyword = keywordData.keyword;
  if (keywordData.portfolio_id !== undefined) result.portfolio_id = keywordData.portfolio_id;
  if (keywordData.subportfolio_id !== undefined) result.subportfolio_id = keywordData.subportfolio_id;
  if (keywordData.priority_id !== undefined) result.priority_id = keywordData.priority_id;
  // created_at and updated_on are handled by the database
  return result;
};

class KeywordService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async getAllKeywords(): Promise<Keyword[]> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('keywords')
      .select('*, portfolios!left(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching all keywords from Supabase:", error);
      throw error;
    }
    
    if (!data) return [];

    const portfolioIds = data.map(k => (k.portfolios as any)?.parent_id).filter(Boolean) as string[];
    let parentPortfoliosMap = new Map<string, string>();

    if (portfolioIds.length > 0) {
        const { data: parents, error: parentError } = await supabase
            .from('portfolios')
            .select('id, name')
            .in('id', portfolioIds);

        if (parentError) {
            console.error("Error fetching parent portfolios:", parentError);
        } else if (parents) {
            parentPortfoliosMap = new Map(parents.map(p => [p.id, p.name]));
        }
    }

    return data.map(item => {
        const keyword = fromSnakeCase(item);
        const portfolio = item.portfolios as any;
        if (portfolio) {
            if (portfolio.parent_id) {
                keyword.subPortfolioName = portfolio.name;
                keyword.portfolioName = parentPortfoliosMap.get(portfolio.parent_id) || 'N/A';
            } else {
                keyword.portfolioName = portfolio.name;
            }
        }
        return keyword;
    });
  }

  async findKeywordsByText(texts: string[]): Promise<Keyword[]> {
    if (!texts || texts.length === 0) return [];
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .in('keyword', texts);

    if (error) {
      console.error("Error fetching keywords by text from Supabase:", error);
      throw error;
    }
    return data ? data.map(fromSnakeCase) : [];
  }

  async addKeyword(keywordData: Omit<Keyword, 'id' | 'createdAt' | 'updatedOn'>): Promise<Keyword> {
    const supabase = this.getSupabaseClient();
    const keywordToInsert = toSnakeCase(keywordData);

    const { data, error } = await supabase
      .from('keywords')
      .insert(keywordToInsert)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error(`Keyword "${keywordData.keyword}" already exists.`);
      }
      console.error("Error adding keyword to Supabase:", error);
      throw error;
    }
    return fromSnakeCase(data);
  }

  async updateKeyword(keywordId: string, keywordData: Partial<Omit<Keyword, 'id' | 'createdAt' | 'updatedOn'>>): Promise<void> {
    const supabase = this.getSupabaseClient();
    const keywordToUpdate = toSnakeCase(keywordData);
    const { error } = await supabase
        .from('keywords')
        .update(keywordToUpdate)
        .eq('id', keywordId);

    if (error) {
        console.error(`Error updating keyword ${keywordId} in Supabase:`, error);
        throw new Error(`Failed to update keyword: ${error.message}`);
    }
  }

  async deleteKeyword(keywordId: string): Promise<void> {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', keywordId);

    if (error) {
      console.error(`Error deleting keyword ${keywordId} from Supabase:`, error);
      throw new Error(`Failed to delete keyword: ${error.message}`);
    }
  }

  async findOrCreateKeywords(keywordStrings: string[]): Promise<string[]> {
    if (!keywordStrings || keywordStrings.length === 0) {
      return [];
    }
    const supabase = this.getSupabaseClient();
    const uniqueKeywords = [...new Set(keywordStrings.map(k => k.trim()))].filter(Boolean);
    const lowercasedKeywords = uniqueKeywords.map(k => k.toLowerCase());

    const { data: existingKeywords, error: findError } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('keyword', lowercasedKeywords);

    if (findError) {
      console.error("Error finding existing keywords:", findError);
      throw findError;
    }

    const existingKeywordMap = new Map(existingKeywords.map(k => [k.keyword.toLowerCase(), k.id]));
    const keywordIds = [...existingKeywordMap.values()];
    
    const newKeywordsToInsert = uniqueKeywords
      .filter(k => !existingKeywordMap.has(k.toLowerCase()))
      .map(k => ({ keyword: k }));

    if (newKeywordsToInsert.length > 0) {
      const { data: insertedKeywords, error: insertError } = await supabase
        .from('keywords')
        .insert(newKeywordsToInsert)
        .select('id');

      if (insertError) {
        console.error("Error inserting new keywords:", insertError);
      } else if (insertedKeywords) {
        keywordIds.push(...insertedKeywords.map(k => k.id));
      }
    }
    return keywordIds;
  }

  async findKeywordsByNames(keywordStrings: string[]): Promise<Keyword[]> {
    if (!keywordStrings || keywordStrings.length === 0) {
      return [];
    }
    const supabase = this.getSupabaseClient();
    const uniqueKeywords = [...new Set(keywordStrings.map(k => k.trim()))].filter(Boolean);

    if (uniqueKeywords.length === 0) {
        return [];
    }

    const { data: existingKeywords, error: findError } = await supabase
      .from('keywords')
      .select('id, keyword')
      .in('keyword', uniqueKeywords);

    if (findError) {
      console.error("Error finding existing keywords by names:", findError);
      throw findError;
    }

    return existingKeywords ? existingKeywords.map(fromSnakeCase) : [];
  }
}

export const keywordService = new KeywordService();
