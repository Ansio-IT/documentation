'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { BrandAnalyticsData, ProductListingUploadSummary } from '@/lib/types';
import { brandAnalyticsService } from '@/server/services/brandAnalyticsService';
import { portfolioSettingsService } from '@/server/services/portfolioSettingsService';
import { subDays, format, parseISO, endOfDay, startOfDay } from 'date-fns';

export async function fetchBrandAnalyticsData(filters: {
  portfolioId?: string | null;
  subPortfolioId?: string | null;
  priorityId?: string | null;
  globalFilter?: string | null;
  brandAnalyticsDate?: Date | null;
  sovDate?: Date | null;
}): Promise<BrandAnalyticsData[]> {
  const supabase = createClient(cookies());
  let portfolioIdsToFilter: string[] = [];

  // Determine which portfolio IDs to use for fetching keywords
  if (filters.subPortfolioId) {
    portfolioIdsToFilter = [filters.subPortfolioId];
  } else if (filters.portfolioId) {
    const subPortfolios = await portfolioSettingsService.getSubPortfoliosByParentId(filters.portfolioId);
    portfolioIdsToFilter = subPortfolios.map(p => p.id);
    if (filters.portfolioId) {
      portfolioIdsToFilter.push(filters.portfolioId);
    }
  }

  let keywordsToFilter: string[] = [];
  // If a portfolio filter is active, get the associated keywords first
  if (portfolioIdsToFilter.length > 0) {
    const { data: keywordData, error: keywordError } = await supabase
      .from('keywords')
      .select('keyword')
      .in('portfolio_id', portfolioIdsToFilter);

    if (keywordError) {
      console.error('Error fetching keywords for portfolio filter:', keywordError.message);
      throw new Error(`Failed to fetch keywords for filtering: ${keywordError.message}`);
    }

    if (!keywordData || keywordData.length === 0) {
      return [];
    }
    keywordsToFilter = keywordData.map(k => k.keyword);
  }

  // Step 1: Fetch data from keyword_analytics_view, applying all filters
  let keywordQuery = supabase
    .from('keyword_analytics_view')
    .select('*')
    .order('keyword', {ascending: true})
    .order('top_clicked_brand', {ascending: true});
  
  // FIXED: Brand Analytics date filter
  if (filters.brandAnalyticsDate) {
    const dateFilter = format(filters.brandAnalyticsDate, 'yyyy-MM-dd');
    keywordQuery = keywordQuery.eq('reporting_date', dateFilter);
  } else {
    console.log('No Brand Analytics date filter applied');
  }
  
  if (filters.globalFilter) {
    const searchTerm = `%${filters.globalFilter}%`;
    keywordQuery = keywordQuery.or(
      `keyword.ilike.${searchTerm},brand.ilike.${searchTerm},asin.ilike.${searchTerm},title.ilike.${searchTerm}`
    );
  }
  
  // Apply the keyword filter derived from the portfolio selection
  if (keywordsToFilter.length > 0) {
    keywordQuery = keywordQuery.in('keyword', keywordsToFilter);
  }

  // The 'priorityId' from the filter dropdown now filters the 'type' column
  if (filters.priorityId) {
    const priority = await supabase.from('priorities').select('priority_name').eq('priority_id', filters.priorityId).single();
    if(priority.data?.priority_name) {
      keywordQuery = keywordQuery.eq('type', priority.data.priority_name);
    }
  }

  const { data: keywordData, error: keywordError } = await keywordQuery;

  if (keywordError) {
    console.error('🔍 SERVER: Error fetching keyword analytics data:', keywordError.message);
    throw new Error(`Failed to fetch keyword analytics data: ${keywordError.message}`);
  }

  if (!keywordData || keywordData.length === 0) {
    return [];
  }

  // Step 2: Fetch matching data from ranking_sov_view
  const keywords = [...new Set(keywordData.map(k => k.keyword).filter(Boolean))];
  const brands = [...new Set(keywordData.map(k => k.brand).filter(Boolean))];
  
  let rankingQuery = supabase.from('ranking_sov_view').select('*');
  
  if (keywords.length > 0) rankingQuery = rankingQuery.in('keyword', keywords);
  if (brands.length > 0) rankingQuery = rankingQuery.in('brand', brands);
  
  // FIXED: SOV date filter
  if (filters.sovDate) {
    const dateStr = format(filters.sovDate, 'yyyy-MM-dd');
    const startOfDate = `${dateStr}T00:00:00`;
    const endOfDate = format(endOfDay(filters.sovDate), `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`);
    rankingQuery = rankingQuery.gte('crawl_timestamp', startOfDate)
                               .lt('crawl_timestamp', endOfDate);
  }

  const { data: rankingData, error: rankingError } = await rankingQuery;

  if (rankingError) {
    console.error('🔍 SERVER: Error fetching ranking SOV data:', rankingError.message);
    // Continue with empty SOV data rather than throwing
  }

  // FIXED: Create ranking map for brand-level joining
  const rankingMap = new Map<string, typeof rankingData[number]>();
  if (rankingData) {
      rankingData.forEach(r => {
          const key = `${r.keyword}-${r.brand}`;
          rankingMap.set(key, r);
      });
  }

  const mergedData = keywordData.map(keywordItem => {
    const key = `${keywordItem.keyword}-${keywordItem.brand}`;
    const matchingRankingItem = rankingMap.get(key) || {};
    return {
      ...keywordItem,
      ...matchingRankingItem,
    };
  });
  
  // Map database snake_case to the camelCase/PascalCase used in the BrandAnalyticsData type
  const mappedData = (mergedData || []).map((item) => ({
    'Search Term': item.keyword,
    'Brand': item.brand,
    'Competitor ASIN': item.asin,
    'Keyword Status': item.keyword_status,
    'ASIN Status': item.asin_status,
    'Title': item.title,
    'Type': item.type,
    'Search Frequency Rank': item.search_frequency_rank,
    'Click Share (ASIN)': item.click_share,
    'Conversion Share (ASIN)': item.conversion_share,
    'Top Clicked Brand': item.top_clicked_brand,
    'Reporting Date': item.reporting_date,
    'Amazon Choice': item.amazon_choice,
    'Organic Rank': item.organic_rank,
    'Spons Rank': item.spons_rank,
    'All Rank': item.all_rank,
    'SOV Ads Top of Search': item.ads_top_of_search,
    'SOV (TOS & 4 stars and above Ads)': item.ads_tos_4_stars_above_ads,
    'SOV Ads Rest of Search (> 20 ranks)': item.ads_rest_of_search,
    'SOV Ads All': item.ads_all,
    'SOV Only Organic': item.only_organic,
    'SOV All (both Ads and Organic)': item.sov_all,
    'Crawl Timestamp': item.crawl_timestamp,
  }));

  return mappedData as BrandAnalyticsData[];
}

export async function processBrandAnalyticsUploadBatchAction(
  batch: any[]
): Promise<ProductListingUploadSummary> {
  return await brandAnalyticsService.processUploadBatch(batch);
}

export async function fetchLatestSovDateAction(): Promise<Date | null> {
    const supabase = createClient(cookies());
    const { data, error } = await supabase
      .from('ranking_sov_view')
      .select('crawl_timestamp')
      .not('crawl_timestamp', 'is', null)
      .order('crawl_timestamp', { ascending: false })
      .limit(1)
      .single();
  
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching latest SOV date:', error.message);
      return null;
    }
  
    return data?.crawl_timestamp ? new Date(data.crawl_timestamp) : null;
}

export async function fetchLatestBrandAnalyticsDateAction(maxDate?: Date): Promise<Date | null> {
    const supabase = createClient(cookies());
    let query = supabase
      .from('keyword_analytics_view')
      .select('reporting_date')
      .not('reporting_date', 'is', null)
      .order('reporting_date', { ascending: false })
      .limit(1);

    if (maxDate) {
        query = query.lte('reporting_date', format(maxDate, 'yyyy-MM-dd'));
    }

    const { data, error } = await query.single();
  
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching latest Brand Analytics date:', error.message);
      return null;
    }
  
    return data?.reporting_date ? new Date(data.reporting_date) : null;
}

// FIXED: Simplified RPC handling with better error handling
export async function fetchAvailableBrandAnalyticsDates(): Promise<string[]> {
    const supabase = createClient(cookies());
    
    try {
        const { data, error } = await supabase.rpc('get_distinct_brand_analytics_dates');

        if (error) {
            console.error("Error fetching available Brand Analytics dates via RPC:", error.message);
            // Fallback to direct query if RPC fails
            return await fetchAvailableBrandAnalyticsDatesFallback();
        }
        
        if (!data || !Array.isArray(data)) {
            console.warn("RPC for available Brand Analytics dates did not return a valid array.");
            return await fetchAvailableBrandAnalyticsDatesFallback();
        }
        
        // FIXED: Simplified mapping - assume RPC returns array of objects with reporting_date field  
        const uniqueDates = data
            .map((item: any) => {
                // Handle different possible return formats from RPC
                if (typeof item === 'string') return item;
                if (item.reporting_date) return item.reporting_date;
                if (item.get_distinct_brand_analytics_dates) return item.get_distinct_brand_analytics_dates;
                return null;
            })
            .filter((date): date is string => date !== null && typeof date === 'string')
            .filter(date => {
                // Validate date format
                const parsed = new Date(date);
                return !isNaN(parsed.getTime());
            });

        const sortedDates = uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        return sortedDates;
    } catch (error) {
        console.error("Unexpected error fetching Brand Analytics dates:", error);
        return await fetchAvailableBrandAnalyticsDatesFallback();
    }
}

// FIXED: Fallback function if RPC fails
async function fetchAvailableBrandAnalyticsDatesFallback(): Promise<string[]> {
    const supabase = createClient(cookies());
    
    const { data, error } = await supabase
        .from('brand_analytics_search_terms')
        .select('reporting_date')
        .order('reporting_date', { ascending: false });

    if (error) {
        console.error("Fallback method also failed:", error.message);
        return [];
    }

    if (!data || data.length === 0) {
        return [];
    }

    const uniqueDates = [...new Set(data.map(d => d.reporting_date))];
    return uniqueDates;
}

// FIXED: More efficient SOV dates fetching
export async function fetchAvailableSovCrawlDates(): Promise<string[]> {
    const supabase = createClient(cookies());
    
    try {
        // OPTION 1: Try to use a more efficient approach by limiting the query
        const { data, error } = await supabase
            .from('ranking_sov_view')
            .select('crawl_timestamp')
            .order('crawl_timestamp', { ascending: false })
            .limit(10000); // Limit to recent records to improve performance

        if (error) {
            console.error("Error fetching available SOV dates:", error.message);
            return [];
        }
        
        if (!data || data.length === 0) {
            return [];
        }
        
        // Process dates more efficiently
        const uniqueDateStrings = new Set<string>();
        
        for (const item of data) {
            if (item.crawl_timestamp) {
                try {
                    const date = new Date(item.crawl_timestamp);
                    if (!isNaN(date.getTime())) {
                        uniqueDateStrings.add(date.toISOString().split('T')[0]);
                    }
                } catch (e) {
                    // Ignore invalid date strings
                    continue;
                }
            }
        }

        const sortedDates = Array.from(uniqueDateStrings).sort((a, b) => 
            new Date(b).getTime() - new Date(a).getTime()
        );
        return sortedDates;
        
    } catch (error) {
        console.error("Unexpected error fetching SOV dates:", error);
        return [];
    }
}

// FIXED: Added input validation and better error handling
export async function fetchAvailableSovCrawlTimestamps(date: string): Promise<string[]> {
    // Validate input date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error('Invalid date format for fetchAvailableSovCrawlTimestamps. Expected YYYY-MM-DD, got:', date);
        return [];
    }

    const supabase = createClient(cookies());
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    try {
        const { data, error } = await supabase
            .from('ranking_sov_view')
            .select('crawl_timestamp')
            .gte('crawl_timestamp', startOfDay)
            .lte('crawl_timestamp', endOfDay)
            .order('crawl_timestamp', { ascending: false });

        if (error) {
            console.error(`Error fetching timestamps for date ${date}:`, error.message);
            return [];
        }
        
        if (!data || data.length === 0) {
            console.log(`No timestamps found for date ${date}`);
            return [];
        }
        
        // Get distinct timestamps and validate them
        const uniqueTimestamps = [...new Set(
            data
                .map(d => d.crawl_timestamp)
                .filter(timestamp => {
                    if (!timestamp) return false;
                    try {
                        const date = new Date(timestamp);
                        return !isNaN(date.getTime());
                    } catch {
                        return false;
                    }
                })
        )];
        return uniqueTimestamps as string[];
        
    } catch (error) {
        console.error(`Unexpected error fetching timestamps for date ${date}:`, error);
        return [];
    }
}