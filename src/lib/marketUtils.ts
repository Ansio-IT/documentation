
import type { MarketSetting } from '@/lib/types';

// Helper to normalize hostnames (lowercase, remove www.)
const normalizeHostname = (hostname: string | undefined): string | undefined => {
  if (!hostname) return undefined;
  let normalized = hostname.toLowerCase();
  if (normalized.startsWith('www.')) {
    normalized = normalized.substring(4);
  }
  return normalized;
};

export function getMarketSettingByUrl(
  url: string | undefined,
  activeMarketSettings: MarketSetting[]
): MarketSetting | undefined {
  if (!url || !activeMarketSettings || activeMarketSettings.length === 0) {
    return undefined;
  }
  try {
    const productHostname = normalizeHostname(new URL(url).hostname);
    if (!productHostname) return undefined;

    for (const setting of activeMarketSettings) {
      if (setting.domainIdentifier) {
        let settingHostnameToCompare: string | undefined;
        try {
          // If domainIdentifier is a full URL
          settingHostnameToCompare = normalizeHostname(new URL(setting.domainIdentifier).hostname);
        } catch (e) {
          // If domainIdentifier is already just a hostname
          settingHostnameToCompare = normalizeHostname(setting.domainIdentifier);
        }
        
        if (settingHostnameToCompare && productHostname === settingHostnameToCompare) {
          return setting;
        }
      }
    }
  } catch (e) {
    // console.warn("Could not parse product URL for market detection:", url, e);
  }
  return undefined;
}

export function getEffectiveMarketSetting(
  productMarket: string | undefined,
  productUrl: string | undefined,
  activeMarketSettings: MarketSetting[]
): MarketSetting | undefined {
  if (productMarket) {
    const settingByName = activeMarketSettings.find(s => s.marketName === productMarket);
    if (settingByName) {
      return settingByName;
    }
  }
  if (productUrl) {
    return getMarketSettingByUrl(productUrl, activeMarketSettings);
  }
  return undefined;
}

export function getDisplayCurrencySymbol(marketSetting: MarketSetting | undefined): string {
  return marketSetting?.currencySymbol || '$'; // Default to '$'
}

export function getDisplayMarketName(marketSetting: MarketSetting | undefined): string {
  return marketSetting?.marketName || 'N/A';
}

export function getMarketBadgeTailwindColor(marketName: string | undefined): string {
  switch (marketName) {
    case 'US':
      return 'bg-blue-500 hover:bg-blue-600 text-white';
    case 'EU':
      return 'bg-green-500 hover:bg-green-600 text-white';
    case 'UK':
      return 'bg-purple-500 hover:bg-purple-600 text-white';
    default:
      return 'bg-slate-500 hover:bg-slate-600 text-slate-50'; // More neutral default
  }
}
