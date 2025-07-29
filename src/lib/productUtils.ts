

// Utility functions extracted from page.tsx

import { DisplayCompetitor } from "@/components/competitor-list";
import { addDays, format, isSameDay, isValid, parse, startOfDay } from "date-fns";

export const getIsoCurrencyCode = (currencySymbolOrCode: string | null | undefined): string => {
    if (!currencySymbolOrCode) return 'GBP';
    const upperCode = currencySymbolOrCode.toUpperCase();
    if (upperCode === '£' || upperCode === 'GBP' || upperCode === 'GPB') return 'GBP';
    if (upperCode === '$' || upperCode === 'USD') return 'USD';
    if (upperCode === '€' || upperCode === 'EUR') return 'EUR';
    if (upperCode.length === 3) return upperCode;
    return 'GBP';
};

export const calculateDiscountPercent = (listPrice?: number | null, finalPrice?: number | null): { value: number | null, display: string } => {
  if (typeof listPrice === 'number' && typeof finalPrice === 'number' && listPrice > 0) {
    if (listPrice > finalPrice) {
      const discount = ((listPrice - finalPrice) / listPrice) * 100;
      return { value: discount, display: `${discount.toFixed(0)}%` };
    }
    if (listPrice === finalPrice) {
        return { value: 0, display: '0%' };
    }
  }
  return { value: null, display: 'N/A' };
};

export const constructAmazonUrl = (asinCode: string | undefined | null, marketDomain: string | undefined | null): string => {
  if (!asinCode) return '#';
  let base = marketDomain || 'www.amazon.com';
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  try {
    const url = new URL(base);
    return `${url.origin}/dp/${asinCode}`;
  } catch (e) {
    console.warn(`Invalid market domain: ${base}, falling back to amazon.com`);
    return `https://www.amazon.com/dp/${asinCode}`;
  }
};

export const getDeliveryInfo = (delivery?: (string | string[] | null)[] | null): { rawString: string; parsedDate: Date | null; displayDate: string } => {
  if (!delivery || delivery.length === 0) {
    return { rawString: "N/A", parsedDate: null, displayDate: "N/A" };
  }

  const deliveryStrings = delivery.flat().filter((d): d is string => typeof d === 'string' && d.length > 0);

  if (deliveryStrings.length === 0) {
    return { rawString: "N/A", parsedDate: null, displayDate: "N/A" };
  }

  let chosenString = deliveryStrings[0];
  const fastestString = deliveryStrings.find(d => d.toLowerCase().includes("fastest delivery"));
  if (fastestString) {
    chosenString = fastestString;
  }

  const effectiveStringToParse = chosenString;
  let parsedDate: Date | null = null;
  let displayDate = "N/A";

  const dateMatch = chosenString.match(/\d{1,2} [A-Za-z]+(?:\s*-\s*\d{1,2} [A-Za-z]+)?/i);
  
  if (dateMatch) {
    let dateStringToParseFromMatch = dateMatch[0] || dateMatch[1] || dateMatch[2];
    if (dateStringToParseFromMatch) {
      dateStringToParseFromMatch = dateStringToParseFromMatch.replace(/,/g, '').trim();
      const currentYear = new Date().getFullYear();
  
      const dateParts = dateStringToParseFromMatch.split(/\s*[-–—]\s*/);
      const primaryDateString = dateParts[0].trim();
  
      if (primaryDateString.toLowerCase().startsWith("tomorrow")) {
        const tomorrow = addDays(new Date(), 1);
        const dayMonthPattern = /(\d{1,2} [A-Za-z]+)|([A-Za-z]+ \d{1,2})/;
        const dayMonthSubMatch = primaryDateString.match(dayMonthPattern);
        let specificDayMonthForTomorrow = "";
        
        if (dayMonthSubMatch) {
          specificDayMonthForTomorrow = (dayMonthSubMatch[1] || dayMonthSubMatch[2])?.trim();
        }
  
        if (specificDayMonthForTomorrow) {
          const formatsForTomorrow = [
            'd MMMM yyyy', 'd MMM yyyy', 'MMMM d yyyy', 'MMM d yyyy',
            'd MMMM', 'd MMM', 'MMMM d', 'MMM d'
          ];
          
          for (const fmt of formatsForTomorrow) {
            let tempDate = parse(`${specificDayMonthForTomorrow} ${currentYear}`, fmt, new Date());
            if (!isValid(tempDate) && !fmt.includes('yyyy')) {
              tempDate = parse(specificDayMonthForTomorrow, fmt, new Date());
              if (isValid(tempDate)) {
                tempDate.setFullYear(currentYear);
                if (tempDate < startOfDay(new Date())) {
                  tempDate.setFullYear(currentYear + 1);
                }
              }
            }
            if (isValid(tempDate)) {
              if (tempDate < startOfDay(new Date()) && tempDate.getMonth() < new Date().getMonth() && new Date().getMonth() === 11 && tempDate.getMonth() === 0) {
                 tempDate = parse(`${specificDayMonthForTomorrow} ${currentYear + 1}`, fmt, new Date());
              }
              parsedDate = isSameDay(tempDate, tomorrow) ? tempDate : tomorrow;
              if (isValid(parsedDate)) break; 
              else parsedDate = null;
            }
          }
          if (!parsedDate || !isValid(parsedDate)) parsedDate = tomorrow; 
        } else {
          parsedDate = tomorrow; 
        }
      } else {
        let cleanDateString = primaryDateString.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+/i, '');
        const formatsToTry = [
          'd MMMM yyyy', 'd MMM yyyy', 'd MMMM', 'd MMM',
          'MMMM d yyyy', 'MMM d yyyy', 'MMMM d', 'MMM d',
          'EEEE d MMMM yyyy', 'EEEE d MMM yyyy', 'EEEE MMMM d yyyy', 'EEEE MMM d yyyy',
          'EEEE d MMMM', 'EEEE d MMM', 'EEEE MMMM d', 'EEEE MMM d'
        ];
        for (const fmt of formatsToTry) {
          let tempDate;
          if (fmt.includes('yyyy')) {
            tempDate = parse(`${cleanDateString} ${currentYear}`, fmt, new Date());
          } else {
            tempDate = parse(cleanDateString, fmt, new Date());
            if (isValid(tempDate)) {
              tempDate.setFullYear(currentYear);
              if (tempDate < startOfDay(new Date())) tempDate.setFullYear(currentYear + 1);
            }
          }
          if (!isValid(tempDate) && fmt.includes('EEEE')) {
            if (fmt.includes('yyyy')) {
              tempDate = parse(`${primaryDateString} ${currentYear}`, fmt, new Date());
            } else {
              tempDate = parse(primaryDateString, fmt, new Date());
              if (isValid(tempDate)) {
                tempDate.setFullYear(currentYear);
                if (tempDate < startOfDay(new Date())) tempDate.setFullYear(currentYear + 1);
              }
            }
          }
          if (isValid(tempDate)) {
            if (tempDate < startOfDay(new Date()) && tempDate.getMonth() < new Date().getMonth() && new Date().getMonth() === 11 && tempDate.getMonth() === 0) {
              if (fmt.includes('yyyy')) tempDate = parse(`${cleanDateString} ${currentYear + 1}`, fmt, new Date());
              else tempDate.setFullYear(currentYear + 1);
            }
            parsedDate = tempDate;
            if (isValid(parsedDate)) break; 
            else parsedDate = null;
          }
        }
      }
    }
  }

  if (parsedDate && isValid(parsedDate)) {
    displayDate = format(parsedDate, "EEE, MMM d");
  }
  const rawDisplayString = effectiveStringToParse.length > 60 ? effectiveStringToParse.substring(0, 57) + "..." : effectiveStringToParse;
  return { rawString: rawDisplayString, parsedDate, displayDate };
};


export const getRankForCategoryDisplay = (competitor: DisplayCompetitor, categoryName: string): string => {
    console.log(`getRankForCategoryDisplay called with categoryName: ${categoryName}`);
    const cat = competitor.category_ranks;
    let rankValue: number | undefined | null;
    if (cat && typeof cat === 'object') {
        if (cat.root_bs_category === categoryName && cat.root_bs_rank !== null && cat.root_bs_rank !== undefined) {
            rankValue = cat.root_bs_rank;
        } else if (cat.bs_category === categoryName && cat.bs_rank !== null && cat.bs_rank !== undefined) {
            rankValue = cat.bs_rank;
        } else if (Array.isArray(cat.subcategory_rank)) {
            const subRank = cat.subcategory_rank.find((sr: any) => sr.subcategory_name === categoryName);
            if (subRank && subRank.subcategory_rank !== null && subRank.subcategory_rank !== undefined) {
                rankValue = subRank.subcategory_rank;
            }
        }
    }
    return typeof rankValue === 'number' ? rankValue.toLocaleString() : 'N/A';
};

export const getSortableRankForCategory = (competitor: DisplayCompetitor, categoryName: string): number | null => {
    if (competitor.rootBsCategory === categoryName && typeof competitor.rootBsRank === 'number') {
        return competitor.rootBsRank;
    }
    if (competitor.bsCategory === categoryName && typeof competitor.bsRank === 'number') {
        return competitor.bsRank;
    }
    if (competitor.subcategoryRanks) {
        const subRank = competitor.subcategoryRanks.find((sr: { subcategoryName: string; }) => sr.subcategoryName === categoryName);
        if (subRank && typeof subRank.subcategoryRank === 'number') {
            return subRank.subcategoryRank;
        }
    }
    return null;
};



