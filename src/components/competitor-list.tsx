

"use client";

import React, { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import type { MarketSetting, ProductListingData, SortingState, TopKeyword, KeywordMetricsMap, KeywordMetric } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Package, Trash2, TrendingUp, Star, CalendarDays, Search, Info, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getDisplayCurrencySymbol
} from '@/lib/marketUtils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parse, isValid, format, addDays, isSameDay, startOfDay } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { calculateDiscountPercent, getDeliveryInfo, constructAmazonUrl } from '@/lib/productUtils';


export interface DisplayCompetitor extends ProductListingData {
  id: string;
  competitorListingId: string;
  isMainProduct?: boolean;
  productCode?: string | null;
}

interface TableHeaderConfig {
  id: string;
  label: React.ReactNode;
  subLabel?: React.ReactNode;
  width: number;
  textAlign: 'left' | 'right' | 'center';
  isSticky?: boolean;
  left?: number;
  zIndexHeader?: number;
  zIndexCell?: number;
  shadow?: boolean;
  colSpan?: number;
  rowSpan?: number;
  noSort?: boolean;
  originalKeyword?: string;
  onDateChange?: (date: Date) => void;
  onPlacementChange?: (placement: string | null) => void;
  currentReportMarketId?: string | null;
  currentReportPlacement?: string | null;
  selectedMetricsDate?: Date;
}

interface CompetitorListProps {
  competitors: DisplayCompetitor[];
  activeMarketSettings: MarketSetting[];
  onDeleteCompetitorLink: (listingId: string, competitorAsin?: string) => void;
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  dynamicBsrCategories: string[];
  getRankForCategoryDisplay: (competitor: DisplayCompetitor, categoryName: string) => string;
  topKeywords: TopKeyword[];
  keywordMetrics: KeywordMetricsMap;
  onFetchKeywordData: (date: Date, placement: string | null) => void;
  isLoadingKeywordData: boolean;
  selectedMetricsDate: Date;
  setSelectedMetricsDate: (date: Date) => void;
  currentReportMarketId: string | null;
  currentReportPlacement: string | null;
  setSelectedPlacement: (placement: string | null) => void;
  bsrIdToCategoryNameMap: Map<string, string>;
}

const staticColumnWidths = {
  brand: 100, productName: 210, asin: 110, currentPrice: 90, listPrice: 80,
  discount: 70, dealType: 100,
  dispatchedFrom: 100, soldBy: 100,
  deliveryDate: 110, rawDeliveryInfo: 150, actions: 60,
};
const dynamicColumnBaseWidth = 80;
const keywordColumnWidth = 100;
const subHeaderTopOffset = '2.125rem';
const headerBgClass = "bg-card";


const getOpaqueRowAppearanceClasses = (isMain: boolean, isEvenComp: boolean, isHovering: boolean): string => {
  if (isMain) {
    return isHovering ? "bg-primary/15 dark:bg-primary/20" : "bg-primary/10 dark:bg-primary/15";
  }
  if (isEvenComp) {
     return isHovering ? "bg-muted dark:bg-muted/40" : "bg-muted/50 dark:bg-muted/30";
  }
  return isHovering ? "bg-muted dark:bg-muted/40" : "bg-card dark:bg-background";
};


export function CompetitorList({
  competitors,
  activeMarketSettings,
  onDeleteCompetitorLink,
  sorting,
  setSorting,
  dynamicBsrCategories,
  getRankForCategoryDisplay,
  topKeywords,
  keywordMetrics,
  onFetchKeywordData,
  isLoadingKeywordData,
  selectedMetricsDate,
  setSelectedMetricsDate,
  currentReportMarketId,
  currentReportPlacement,
  setSelectedPlacement,
  bsrIdToCategoryNameMap,
}: CompetitorListProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const tableHeaders = React.useMemo(() => {
    let currentLeftOffset = 0;
    const firstThreeStickyHeadersConfig: TableHeaderConfig[] = [
        { id: 'brand', label: 'Brand/Role', width: staticColumnWidths.brand, textAlign: 'left' as const, isSticky: true, left: currentLeftOffset, zIndexHeader: 50, zIndexCell: 40, shadow: false },
        { id: 'title', label: 'Product Name', width: staticColumnWidths.productName, textAlign: 'left' as const, isSticky: true, left: (currentLeftOffset += staticColumnWidths.brand), zIndexHeader: 49, zIndexCell: 39, shadow: false },
        { id: 'asinCode', label: 'ASIN', width: staticColumnWidths.asin, textAlign: 'left' as const, isSticky: true, left: (currentLeftOffset += staticColumnWidths.productName), zIndexHeader: 48, zIndexCell: 38, shadow: true },
    ];

    const baseHeadersStart: TableHeaderConfig[] = [
      ...firstThreeStickyHeadersConfig,
      { id: 'price', label: <>Current<br />Price</>, width: staticColumnWidths.currentPrice, textAlign: 'right', zIndexHeader: 30, zIndexCell: 20 },
      { id: 'initial_price', label: 'List Price', width: staticColumnWidths.listPrice, textAlign: 'right', zIndexHeader: 30, zIndexCell: 20 },
      { id: 'discountPercentage', label: 'Disc %', width: staticColumnWidths.discount, textAlign: 'center', zIndexHeader: 30, zIndexCell: 20 },
      { id: 'deal_type', label: 'Deal Type', width: staticColumnWidths.dealType, textAlign: 'left', zIndexHeader: 30, zIndexCell: 20 },
    ];

    const dynamicBsrHeaders: TableHeaderConfig[] = (dynamicBsrCategories || []).map(categoryName => {
      const sanitizedIdPart = categoryName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      return {
        id: `bsr_${sanitizedIdPart}`,
        label: categoryName.length > 15 ? <TooltipProvider><Tooltip><TooltipTrigger type="button" className="truncate cursor-help">{`${categoryName.substring(0,13)}...`}</TooltipTrigger><TooltipContent side="top"><p>{categoryName}</p></TooltipContent></Tooltip></TooltipProvider> : categoryName,
        width: dynamicColumnBaseWidth,
        textAlign: 'right' as const,
        zIndexHeader: 30, zIndexCell: 20
      };
    });

    const baseHeadersEnd: TableHeaderConfig[] = [
      { id: 'ships_from', label: <>Dispatched<br />From</>, width: staticColumnWidths.dispatchedFrom, textAlign: 'center', zIndexHeader: 30, zIndexCell: 20 },
      { id: 'buybox_seller', label: 'Sold By', width: staticColumnWidths.soldBy, textAlign: 'center', zIndexHeader: 30, zIndexCell: 20 },
    ];

    const firstRow: TableHeaderConfig[] = [
      ...baseHeadersStart.map(h => ({...h, rowSpan: 2, colSpan: 1})),
      ...dynamicBsrHeaders.map(h => ({...h, rowSpan: 2, colSpan: 1})),
      ...baseHeadersEnd.map(h => ({...h, rowSpan: 2, colSpan: 1})),
    ];

    if (topKeywords && topKeywords.length > 0) {
      firstRow.push({
        id: 'keywordsGroup',
        label: (
          <div className="flex items-center justify-center gap-2 relative">
            <span>Keywords ({topKeywords.length})</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 absolute -right-1 -top-0.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMetricsDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedMetricsDate(date);
                      if (currentReportMarketId) onFetchKeywordData(date, currentReportPlacement);
                    }
                  }}
                  initialFocus
                />
                 <div className="p-2 border-t">
                  <Label htmlFor="placement-select" className="text-xs">Placement</Label>
                   <Select
                      value={currentReportPlacement || "all"}
                      onValueChange={(value) => {
                          const newPlacement = value === "all" ? null : value;
                          setSelectedPlacement(newPlacement);
                          if (currentReportMarketId) onFetchKeywordData(selectedMetricsDate, newPlacement);
                      }}
                   >
                      <SelectTrigger id="placement-select" className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select placement" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">All Placements</SelectItem>
                          <SelectItem value="TOP">Top of Search (TOP)</SelectItem>
                          <SelectItem value="SP">Sponsored Products (SP)</SelectItem>
                      </SelectContent>
                   </Select>
                 </div>
              </PopoverContent>
            </Popover>
          </div>
        ),
        width: keywordColumnWidth * topKeywords.length * 2,
        textAlign: 'center' as const,
        colSpan: topKeywords.length * 2,
        noSort: true, rowSpan: 1, zIndexHeader: 32
      });
    }

    firstRow.push(
        { id: 'deliveryDate', label: 'Delivery Date', width: staticColumnWidths.deliveryDate, textAlign: 'left', colSpan: 1, rowSpan: 2, zIndexHeader: 30, zIndexCell: 20 },
        { id: 'rawDeliveryInfo', label: 'Delivery Info', width: staticColumnWidths.rawDeliveryInfo, textAlign: 'left', noSort: true, colSpan: 1, rowSpan: 2, zIndexHeader: 30, zIndexCell: 20 },
        { id: 'actions', label: 'Actions', width: staticColumnWidths.actions, textAlign: 'center', noSort: true, colSpan: 1, rowSpan: 2, zIndexHeader: 30, zIndexCell: 20 }
    );

    const keywordSubHeaders: TableHeaderConfig[] = (topKeywords && topKeywords.length > 0)
      ? topKeywords.flatMap(kw => [
          { id: `kw_rank_${kw.keyword}`, label: "Rank", subLabel: kw.keyword, width: keywordColumnWidth, textAlign: 'center' as const, noSort: true, originalKeyword: kw.keyword, zIndexHeader: 31, zIndexCell: 18 },
          { id: `kw_sov_${kw.keyword}`, label: "SOV %", subLabel: kw.keyword, width: keywordColumnWidth, textAlign: 'center' as const, noSort: true, originalKeyword: kw.keyword, zIndexHeader: 31, zIndexCell: 18 }
        ])
      : [];

    return { firstRow, keywordSubHeaders };
  }, [dynamicBsrCategories, topKeywords, selectedMetricsDate, currentReportPlacement, currentReportMarketId, setSelectedMetricsDate, onFetchKeywordData, setSelectedPlacement]);


  const tableMinWidth = useMemo(() => {
    let totalWidth = 0;
    tableHeaders.firstRow.forEach(header => {
        if (header.id === 'keywordsGroup' && topKeywords.length > 0) {
            totalWidth += keywordColumnWidth * topKeywords.length * 2;
        } else if (header.colSpan === 1 && header.rowSpan === 2) {
            totalWidth += header.width;
        }
    });
    return totalWidth;
  }, [tableHeaders.firstRow, topKeywords, keywordColumnWidth]);


  const handleSort = (columnId: string) => {
    const currentSort = sorting.find(s => s.id === columnId);
    if (currentSort) {
      if (!currentSort.desc) {
        setSorting([{ id: columnId, desc: true }]);
      } else {
        setSorting([]);
      }
    } else {
      setSorting([{ id: columnId, desc: false }]);
    }
  };

  const renderSortIndicator = (columnId: string) => {
    const currentSort = sorting.find(s => s.id === columnId);
    if (currentSort) {
      return currentSort.desc ? <ChevronDown className="h-3.5 w-3.5 inline-block ml-1" /> : <ChevronUp className="h-3.5 w-3.5 inline-block ml-1" />;
    }
    return null;
  };


  // Sort competitors based on sorting state
  const sortedCompetitors = useMemo(() => {
    if (!sorting.length) return competitors;
    const [{ id: sortId, desc }] = sorting;

    // Helper to extract sortable value for each column
    const getSortableValue = (item: DisplayCompetitor, columnId: string): number | string | null => {
      switch (columnId) {
        case 'price':
        case 'current_price':
          return typeof item.current_price === 'number' ? item.current_price : null;
        case 'initial_price':
        case 'list_price':
          return typeof item.list_price === 'number' ? item.list_price : null;
        case 'discountPercentage':
        case 'discount': {
          const discountInfo = calculateDiscountPercent(item.list_price, item.current_price);
          return discountInfo.value;
        }
        case 'brand':
          return item.brand || '';
        case 'title':
        case 'product_name':
          return item.product_name || '';
        case 'asinCode':
          return item.asinCode || '';
        case 'deal_type':
          return item.deal_type || item.dealType || '';
        case 'ships_from':
        case 'dispatched_from':
          return item.dispatched_from || '';
        case 'buybox_seller':
        case 'sold_by':
          return item.sold_by || item.sellerName || '';
        case 'deliveryDate': {
          // Use parsed delivery date for sorting
          const info = getDeliveryInfo(item.delivery_info?.[0]);
          return info.parsedDate ? info.parsedDate.getTime() : null;
        }
        default: {
          // Dynamic BSR columns
          if (columnId.startsWith('bsr_')) {
            const categoryName = bsrIdToCategoryNameMap.get(columnId);
            let rankStr = categoryName ? getRankForCategoryDisplay(item, categoryName) : undefined;
            let rankNum = rankStr !== undefined ? parseInt(rankStr as string, 10) : NaN;
            return !isNaN(rankNum) ? rankNum : null;
          }
          // Keyword columns: do not sort
          return '';
        }
      }
    };

    return [...competitors].sort((a, b) => {
      const aValue = getSortableValue(a, sortId);
      const bValue = getSortableValue(b, sortId);
      
      const aIsNull = aValue === null;
      const bIsNull = bValue === null;

      if (aIsNull && bIsNull) return 0;
      if (aIsNull) return 1;
      if (bIsNull) return -1;
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return desc ? bValue - aValue : aValue - bValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return desc ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
      }
      return 0;
    });
  }, [competitors, sorting, bsrIdToCategoryNameMap, getRankForCategoryDisplay]);


  if (!competitors || competitors.length === 0) {
    return (
      <div className="text-center py-10 bg-card rounded-lg border shadow-sm h-full flex flex-col items-center justify-center">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No product or competitor details found for comparison.</p>
      </div>
    );
  }

  const baseCellStyles = "px-1 py-1 align-middle text-xs";
  const subHeaderCellStyles = "px-1 py-0.5 align-middle text-[10px] whitespace-nowrap font-medium text-muted-foreground";

  const flatColumnHeaders: TableHeaderConfig[] = useMemo(() => {
    const flat: TableHeaderConfig[] = [];
    tableHeaders.firstRow.forEach(header => {
        if (header.id === 'keywordsGroup') {
            if (topKeywords && topKeywords.length > 0) {
                flat.push(...tableHeaders.keywordSubHeaders);
            }
        } else if (header.colSpan === 1) {
            flat.push(header);
        }
    });
    return flat;
  }, [tableHeaders, topKeywords]);


  return (
    <div className="w-full rounded-md border bg-card max-h-[70vh] overflow-auto">
      <Table className="table-fixed relative" style={{ minWidth: `${tableMinWidth}px` }}>
          <TableHeader className={cn("sticky top-0 z-50 shadow-sm", headerBgClass)}>
            <TableRow>
              {tableHeaders.firstRow.map(header => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  rowSpan={header.rowSpan}
                  onClick={() => !header.noSort && handleSort(header.id)}
                  className={cn(
                    "px-1 py-1 align-middle text-xs cursor-pointer select-none border-r border-border",
                    headerBgClass,
                    header.id.startsWith('bsr_') ? "whitespace-normal text-center" : "whitespace-nowrap",
                    header.textAlign === 'right' && !header.id.startsWith('bsr_') && 'text-right',
                    header.textAlign === 'center' && !header.id.startsWith('bsr_') && 'text-center',
                    header.textAlign === 'left' && !header.id.startsWith('bsr_') && 'text-left',
                    header.isSticky && "sticky z-50 bg-card",
                    header.isSticky && header.shadow && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]"
                  )}
                  style={{
                      width: `${header.width}px`,
                      minWidth: `${header.width}px`,
                      left: header.isSticky ? `${header.left}px` : undefined,
                      zIndex: header.isSticky ? header.zIndexHeader : (header.id === 'keywordsGroup' ? 32 : 30),
                  }}>
                  <div className={cn("flex items-center", {
                      "justify-center": header.textAlign === 'center' || header.id.startsWith('bsr_'),
                      "justify-end": header.textAlign === 'right' && !header.id.startsWith('bsr_'),
                      "justify-start": header.textAlign === 'left' && !header.id.startsWith('bsr_'),
                  })}>
                    {header.label}
                    {!header.noSort && renderSortIndicator(header.id)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
            {(topKeywords && topKeywords.length > 0) && (
                  <TableRow>
                      {tableHeaders.firstRow.map(h => {
                          if (h.rowSpan === 2) return null;
                          if (h.id === 'keywordsGroup') {
                              return tableHeaders.keywordSubHeaders.map(subHeader => (
                                  <TableHead
                                      key={subHeader.id}
                                      className={cn(subHeaderCellStyles, "sticky text-center", headerBgClass)}
                                      style={{
                                          top: subHeaderTopOffset,
                                          width: `${subHeader.width}px`,
                                          minWidth: `${subHeader.width}px`,
                                          zIndex: (subHeader.zIndexHeader || 31),
                                      }}
                                  >
                                    <div className="truncate" title={typeof subHeader.subLabel === 'string' ? subHeader.subLabel : undefined}>
                                      {subHeader.subLabel}
                                    </div>
                                    <div>{subHeader.label}</div>
                                  </TableHead>
                              ));
                          }
                          if (h.colSpan && h.colSpan > 1 && h.id !== 'keywordsGroup') {
                              return Array.from({ length: h.colSpan }).map((_, i) => (
                                  <TableHead key={`empty-sub-${h.id}-${i}`} className={cn(subHeaderCellStyles, "sticky", headerBgClass)} style={{ top: subHeaderTopOffset, width: `${h.width / (h.colSpan || 1)}px`, minWidth: `${h.width / (h.colSpan || 1)}px`, zIndex: (h.zIndexHeader || 31) -1 }}></TableHead>
                              ));
                          }
                          if (!h.rowSpan && !h.colSpan && h.id !== 'keywordsGroup' ) {
                               return <TableHead key={`empty-sub-${h.id}`} style={{width: `${h.width}px`, minWidth: `${h.width}px`, top: subHeaderTopOffset, zIndex: (h.zIndexHeader || 31) -1 }} className={cn(subHeaderCellStyles, "sticky", headerBgClass)}></TableHead>;
                           }
                           return null;
                      })}
                  </TableRow>
              )}
          </TableHeader>
          <TableBody>
            {sortedCompetitors.map((c, index) => {
              const productUrl = constructAmazonUrl(c.asinCode, c.marketDomainIdentifier || c.url);
              const discountInfo = calculateDiscountPercent(c.list_price, c.current_price);
              const deliveryInfo = getDeliveryInfo(c.delivery_info?.[0]);
              const displayBrand = c.brand && c.brand.length > 12 ? <TooltipProvider><Tooltip><TooltipTrigger type="button" className="truncate cursor-help">{`${c.brand.substring(0,10)}...`}</TooltipTrigger><TooltipContent side="top"><p>{c.brand}</p></TooltipContent></Tooltip></TooltipProvider> : (c.brand || "N/A");
              const currencySymbol = c.currencySymbol || getDisplayCurrencySymbol(activeMarketSettings.find(s => s.marketName === c.marketName) || undefined);
              const isMainProductRow = !!c.isMainProduct;
              const mainProductPresent = competitors.some(cp => cp.isMainProduct);
              const competitorIndex = mainProductPresent && !isMainProductRow ? index -1 : index;
              const isEvenCompetitorRow = !isMainProductRow && competitorIndex % 2 === 0;
              const isRowHovered = hoveredRowId === (c.id || c.competitorListingId);


              return (
                <TableRow
                  key={c.id || c.competitorListingId}
                  className="group"
                  onMouseEnter={() => setHoveredRowId(c.id || c.competitorListingId)}
                  onMouseLeave={() => setHoveredRowId(null)}
                >
                  {flatColumnHeaders.map((header, headerIdx) => {
                     const cellEffectiveBgClass = getOpaqueRowAppearanceClasses(isMainProductRow, isEvenCompetitorRow, isRowHovered);
                     let cellContent: React.ReactNode;
                     switch (header.id) {
                      case 'brand': cellContent = <p className="truncate" title={c.brand || "N/A"}>{displayBrand}</p>; break;
                      case 'title':
                      case 'product_name': cellContent = <p className="truncate" title={c.product_name || "N/A"}>{c.product_name && c.product_name.length > 35 ? `${c.product_name.substring(0, 35)}...` : c.product_name || "N/A"}</p>; break;
                      case 'asinCode': cellContent = c.asinCode ? (
                          <a href={productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate block" title={`View ASIN ${c.asinCode}`}>{c.asinCode}</a>
                        ) : <p className="text-muted-foreground truncate" title="N/A">N/A</p>; break;
                      case 'price':
                      case 'current_price': cellContent = c.current_price !== null && c.current_price !== undefined ? `${currencySymbol}${c.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'; break;
                      case 'initial_price':
                      case 'list_price': cellContent = c.list_price !== null && c.list_price !== undefined ? `${currencySymbol}${c.list_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'; break;
                      case 'discountPercentage':
                      case 'discount': cellContent = <Badge variant={discountInfo.value != null && discountInfo.value > 0 ? 'destructive' : 'secondary'} className="text-xs">{discountInfo.display}</Badge>; break;
                      case 'deal_type': {
                        let dealTypeDisplay = c.deal_type || c.dealType || "N/A";
                        if (dealTypeDisplay && dealTypeDisplay.trim) {
                          const trimmedDealType = dealTypeDisplay.trim();
                          const words = trimmedDealType.split(/\s+/);
                          if (words.length > 1 && words.length % 2 === 0) {
                            const midPoint = words.length / 2;
                            const firstHalf = words.slice(0, midPoint).join(" ");
                            const secondHalf = words.slice(midPoint).join(" ");
                            if (firstHalf === secondHalf) dealTypeDisplay = firstHalf;
                            else dealTypeDisplay = trimmedDealType;
                          } else dealTypeDisplay = trimmedDealType;
                        }
                        if (dealTypeDisplay === "") dealTypeDisplay = "N/A";
                        cellContent = dealTypeDisplay !== "N/A" ? <Badge variant="outline" className={`px-1.5 py-0.5 text-[10px] truncate ${isMainProductRow ? (cellEffectiveBgClass.includes('dark:') ? 'border-primary-foreground/50 text-primary-foreground bg-primary/10' : 'border-primary/50 text-primary bg-primary/10') : ''}`} title={dealTypeDisplay}>{dealTypeDisplay}</Badge> : <p className="truncate" title="N/A">N/A</p>;
                        break;
                      }
                      case 'ships_from':
                      case 'dispatched_from': cellContent = <p className="truncate text-center" title={c.dispatched_from || "N/A"}>{c.dispatched_from || "N/A"}</p>; break;
                      case 'buybox_seller':
                      case 'sold_by': cellContent = <p className="truncate text-center" title={c.sold_by || c.sellerName || "N/A"}>{c.sold_by || c.sellerName || "N/A"}</p>; break;
                      case 'deliveryDate': cellContent = <p className="truncate" title={deliveryInfo.displayDate}>{deliveryInfo.displayDate}</p>; break;
                      case 'rawDeliveryInfo': cellContent = <p className="truncate" title={deliveryInfo.rawString}>{deliveryInfo.rawString}</p>; break;
                      case 'actions': cellContent = !c.isMainProduct ? (
                          <div className="flex items-center justify-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive/90" onClick={() => onDeleteCompetitorLink(c.competitorListingId, c.asinCode || 'Unknown ASIN')} title="Delete Competitor Link"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : <div className="h-6 w-6 p-0"></div>; break;
                      default: {
                        if (header.id.startsWith('bsr_')) {
                          // Extract the original category name from the header id
                          const sanitizedHeader = header.id.replace(/^bsr_/, '');
                          // Find the rank for this category in category_ranks (object)
                          let rank: string | number | undefined = undefined;
                          const cat = c.category_ranks;
                          if (cat && typeof cat === 'object') {
                            // Check subcategory_rank array
                            if (Array.isArray(cat.subcategory_rank)) {
                              const foundSub = cat.subcategory_rank.find((sub: any) =>
                                sub.subcategory_name &&
                                sub.subcategory_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') === sanitizedHeader
                              );
                              if (foundSub) {
                                rank = foundSub.subcategory_rank;
                              }
                            }
                            // Check bs_category
                            if (rank === undefined && cat.bs_category && cat.bs_category.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') === sanitizedHeader) {
                              rank = cat.bs_rank;
                            }
                            // Check root_bs_category
                            if (rank === undefined && cat.root_bs_category && cat.root_bs_category.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') === sanitizedHeader) {
                              rank = cat.root_bs_rank;
                            }
                          }
                          cellContent = rank !== undefined && rank !== null ? rank : 'N/A';
                        } else if (header.originalKeyword) {
                          const metricKey = `${c.asinCode}_${header.originalKeyword}`;
                          const metric = keywordMetrics[metricKey];
                          const isLoadingCell = isLoadingKeywordData && !metric;
                          if (header.id.startsWith('kw_rank_')) {
                              cellContent = isLoadingCell ? <Info className="h-3 w-3 text-muted-foreground animate-pulse mx-auto" /> : (metric?.organic_rank ?? <span className="text-muted-foreground/70">-</span>);
                          } else if (header.id.startsWith('kw_sov_')) {
                              cellContent = isLoadingCell ? <Info className="h-3 w-3 text-muted-foreground animate-pulse mx-auto" /> : (metric?.sov_percentage !== undefined && metric?.sov_percentage !== null ? `${metric.sov_percentage.toFixed(1)}%` : <span className="text-muted-foreground/70">-</span>);
                          } else {
                              cellContent = 'N/A';
                          }
                        } else {
                          cellContent = 'N/A';
                        }
                        break;
                      }
                    }
                    return (
                        <TableCell
                        key={`${c.id || c.competitorListingId}-${header.id}`}
                        className={cn(
                            baseCellStyles,
                            "border-r border-border",
                            header.textAlign === 'right' && 'text-right',
                            header.textAlign === 'center' && 'text-center',
                            header.isSticky && "sticky z-40",
                            header.isSticky && header.shadow && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]",
                            header.isSticky ? cellEffectiveBgClass : cellEffectiveBgClass
                        )}
                        style={{
                            width: `${header.width}px`,
                            minWidth: `${header.width}px`,
                            left: header.isSticky ? `${header.left}px` : undefined,
                            zIndex: header.isSticky ? header.zIndexCell : undefined,
                            backgroundColor: header.isSticky ? (
                                isMainProductRow ? (isRowHovered ? '#dcfce7' : '#f0fdf4') : 
                                isEvenCompetitorRow ? (isRowHovered ? '#f9fafb' : '#f8fafc') : 
                                (isRowHovered ? '#f9fafb' : '#ffffff')
                            ) : undefined,
                        }}>
                        {cellContent}
                        </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
    </div>
  );
}



