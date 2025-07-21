
"use client";

import React from 'react';
import Image from 'next/image';
import type { MarketSetting, ProductListingData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Trash2, TrendingUp, Star } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  getDisplayCurrencySymbol
} from '@/lib/marketUtils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface DisplayCompetitor extends ProductListingData {
  id: string;
  competitorListingId: string;
  isMainProduct?: boolean; // Flag to identify the main product
}

interface CompetitorListProps {
  competitors: DisplayCompetitor[];
  activeMarketSettings: MarketSetting[];
  onDeleteCompetitorLink: (listingId: string, competitorAsin?: string) => void;
}

const calculateDiscountPercent = (listPrice?: number | null, finalPrice?: number | null): string => {
  if (typeof listPrice === 'number' && typeof finalPrice === 'number' && listPrice > 0 && finalPrice < listPrice && finalPrice > 0) {
    const discount = ((listPrice - finalPrice) / listPrice) * 100;
    return `${discount.toFixed(2)}%`;
  }
  return 'N/A';
};

const getFastestDelivery = (delivery?: string[] | null): string => {
    if (delivery && delivery.length > 0) {
        const firstDelivery = delivery[0];
        if (firstDelivery) {
            if (firstDelivery.toLowerCase().includes("fastest delivery")) {
                const match = firstDelivery.match(/fastest delivery\s*([^.]+)/i);
                return match ? match[1].trim() : firstDelivery.split('.')[0] || 'N/A';
            }
            return firstDelivery.split('.')[0] || 'N/A';
        }
    }
    return 'N/A';
}

const constructAmazonUrl = (asinCode: string | undefined | null, marketDomain: string | undefined | null): string => {
  if (!asinCode) return '#';
  let base = marketDomain || 'www.amazon.com';
  if (!base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }
  try {
    const url = new URL(base); // Validate or normalize base
    return `${url.origin}/dp/${asinCode}`;
  } catch (e) {
    console.warn(`Invalid market domain: ${base}, falling back to amazon.com`);
    return `https://www.amazon.com/dp/${asinCode}`;
  }
};


export function CompetitorList({
  competitors,
  activeMarketSettings,
  onDeleteCompetitorLink
}: CompetitorListProps) {
  const isMobile = useIsMobile();
  const currencySymbol = '£'; // Always use £

  const dynamicBsrCategories = React.useMemo(() => {
    const categories = new Set<string>();
    competitors.forEach(c => {
      if (c.rootBsCategory) categories.add(c.rootBsCategory);
      if (c.bsCategory) categories.add(c.bsCategory);
      if (c.subcategoryRanks) {
        c.subcategoryRanks.forEach(sr => {
          if (sr.subcategoryName) categories.add(sr.subcategoryName);
        });
      }
    });
    return Array.from(categories).sort();
  }, [competitors]);

  const getRankForCategory = (competitor: DisplayCompetitor, categoryName: string): string => {
    let rankValue: number | undefined | null;
    if (competitor.rootBsCategory === categoryName && competitor.rootBsRank !== null && competitor.rootBsRank !== undefined) rankValue = competitor.rootBsRank;
    else if (competitor.bsCategory === categoryName && competitor.bsRank !== null && competitor.bsRank !== undefined) rankValue = competitor.bsRank;
    else if (competitor.subcategoryRanks) {
      const subRank = competitor.subcategoryRanks.find(sr => sr.subcategoryName === categoryName);
      if (subRank && subRank.subcategoryRank !== null && subRank.subcategoryRank !== undefined) rankValue = subRank.subcategoryRank;
    }
    return typeof rankValue === 'number' ? rankValue.toLocaleString() : 'N/A';
  };
  

  const staticColumnWidths = {
    brand: 100,
    productName: 180,
    asin: 100,
    currentPrice: 80, 
    listPrice: 80, 
    discount: 70, 
    dealType: 100,
    dispatchedFrom: 100,
    soldBy: 100,
    fastestDelivery: 100,
    actions: 60,
  };

  const dynamicColumnBaseWidth = 90;
  const tableMinWidth = Object.values(staticColumnWidths).reduce((sum, width) => sum + width, 0) + (dynamicBsrCategories.length * dynamicColumnBaseWidth);


  if (!competitors || competitors.length === 0) {
    return (
      <div className="text-center py-10 bg-card rounded-lg border shadow-sm h-full flex flex-col items-center justify-center">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No product or competitor details found for comparison.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ScrollArea className="flex-1 w-full">
        <div className="space-y-3 p-0.5">
          {competitors.map((c) => {
            const dataAiHint = c.dataAiHint || c.title?.split(" ")[0]?.toLowerCase() || "product";
            const productUrl = constructAmazonUrl(c.asinCode, c.marketDomainIdentifier || c.url); // Use marketDomainIdentifier or fallback to c.url for domain
            const discountPercent = calculateDiscountPercent(c.initial_price, c.price);
            const fastestDeliveryText = getFastestDelivery(c.delivery);
            const cardClasses = c.isMainProduct ? "border-primary ring-2 ring-primary/50 bg-primary/5" : "bg-card";
            const displayBrand = c.brand && c.brand.length > 15 ? `${c.brand.substring(0,15)}...` : c.brand || "Brand N/A";

            return (
              <Card key={c.id} className={`overflow-hidden shadow-md ${cardClasses}`}>
                <CardHeader className="p-3 flex flex-row items-start gap-2.5 space-y-0">
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt={c.title || 'Product Image'}
                      width={56}
                      height={56}
                      className="rounded object-cover aspect-square border"
                      data-ai-hint={dataAiHint}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-muted rounded flex items-center justify-center border shrink-0">
                      <Package className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-grow overflow-hidden">
                    <CardTitle className="text-sm font-semibold truncate" title={c.title || 'N/A'}>
                      {c.title && c.title.length > 35 ? `${c.title.substring(0, 35)}...` : c.title || "N/A"}
                    </CardTitle>
                    {c.isMainProduct ? (
                       <p className="text-xs text-muted-foreground truncate mt-0.5" title={c.asinCode || 'N/A'}>ASIN: {c.asinCode || 'N/A'}</p>
                    ) : c.asinCode ? (
                      <a
                        href={productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                        title={`View ASIN ${c.asinCode}`}
                      >
                        ASIN: {c.asinCode}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">ASIN: N/A</p>
                    )}
                     <p className="text-xs text-muted-foreground truncate mt-0.5" title={c.brand || 'N/A'}>Brand: {displayBrand}</p>
                  </div>
                  {!c.isMainProduct && (
                      <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive/90 shrink-0"
                          onClick={() => onDeleteCompetitorLink(c.competitorListingId, c.asinCode || 'Unknown ASIN')}
                          title="Delete Competitor Link"
                      >
                          <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                  )}
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Price:</span>
                    <span className={`font-semibold ${c.isMainProduct ? 'text-primary' : 'text-foreground'}`}>{currencySymbol}{(c.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">List Price:</span>
                    <span>{c.initial_price ? `${currencySymbol}${c.initial_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Discount:</span>
                    <Badge variant={discountPercent !== 'N/A' ? 'destructive' : 'secondary'} className="px-1.5 py-0.5 text-[10px]">{discountPercent}</Badge>
                  </div>
                  <div className="flex justify-between items-center truncate" title={c.deal_type || 'N/A'}>
                    <span className="text-muted-foreground">Deal:</span>
                    {c.deal_type ? <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] truncate">{c.deal_type}</Badge> : <span className="truncate">N/A</span>}
                  </div>
                  <div className="flex justify-between items-center truncate" title={c.ships_from || 'N/A'}>
                    <span className="text-muted-foreground">Dispatched:</span>
                    <span className="truncate">{c.ships_from || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center truncate" title={c.buybox_seller || c.sellerName || 'N/A'}>
                    <span className="text-muted-foreground">Sold by:</span>
                    <span className="truncate">{c.buybox_seller || c.sellerName || 'N/A'}</span>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-muted-foreground mb-0.5">BSR Details:</p>
                    <div className="pl-1.5 space-y-0.5">
                      {c.rootBsRank && c.rootBsCategory && (
                          <div className="flex items-center truncate" title={`(#${c.rootBsRank.toLocaleString()}) ${c.rootBsCategory}`}>
                              <TrendingUp className="h-2.5 w-2.5 mr-1 text-green-500 shrink-0" />
                              <span className="font-medium mr-0.5">(#{c.rootBsRank.toLocaleString()})</span> <span className="truncate">{c.rootBsCategory}</span>
                          </div>
                      )}
                      {c.bsRank && c.bsCategory && (
                          <div className="flex items-center truncate" title={`(#${c.bsRank.toLocaleString()}) ${c.bsCategory}`}>
                              <TrendingUp className="h-2.5 w-2.5 mr-1 text-blue-500 shrink-0" />
                              <span className="font-medium mr-0.5">(#{c.bsRank.toLocaleString()})</span> <span className="truncate">{c.bsCategory}</span>
                          </div>
                      )}
                      {c.subcategoryRanks && c.subcategoryRanks.map((rank, idx) => (
                          <div key={idx} className="flex items-center truncate" title={`(#${rank.subcategoryRank.toLocaleString()}) ${rank.subcategoryName}`}>
                              <TrendingUp className="h-2.5 w-2.5 mr-1 text-purple-500 shrink-0" />
                            <span className="font-medium mr-0.5">(#{rank.subcategoryRank.toLocaleString()})</span> <span className="truncate">{rank.subcategoryName}</span>
                          </div>
                      ))}
                      {!c.rootBsRank && !c.bsRank && (!c.subcategoryRanks || c.subcategoryRanks.length === 0) && <p className="text-muted-foreground">N/A</p>}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Delivery:</span>
                    <span className="truncate">{fastestDeliveryText}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 w-full rounded-md border bg-card whitespace-nowrap">
      <Table className="table-auto" style={{ minWidth: `${tableMinWidth}px` }}>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-30 bg-card px-1 py-1 text-xs whitespace-nowrap shadow-[1px_0_3px_-1px_rgba(0,0,0,0.1)]" style={{ width: `${staticColumnWidths.brand}px` }}>Brand/Role</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.productName}px` }}>Product Name</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.asin}px` }}>ASIN</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-right text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.currentPrice}px` }}>Price</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-right text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.listPrice}px` }}>List Price</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-center text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.discount}px` }}>Disc %</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.dealType}px` }}>Deal Type</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.dispatchedFrom}px` }}>Dispatched From</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.soldBy}px` }}>Sold By</TableHead>
            {dynamicBsrCategories.map(categoryName => (
              <TableHead
                key={categoryName}
                className="sticky top-0 z-10 bg-card px-1 py-1 text-right text-xs whitespace-nowrap"
                style={{ width: `${dynamicColumnBaseWidth}px` }}
              >
                <span>{categoryName}</span>
              </TableHead>
            ))}
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.fastestDelivery}px` }}>Fastest Delivery</TableHead>
            <TableHead className="sticky top-0 z-10 bg-card px-1 py-1 text-center text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.actions}px` }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitors.map((c) => {
            const productUrl = constructAmazonUrl(c.asinCode, c.marketDomainIdentifier || c.url);
            const discountPercent = calculateDiscountPercent(c.initial_price, c.price);
            const fastestDeliveryText = getFastestDelivery(c.delivery);
            const rowClasses = c.isMainProduct ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50";
            const displayBrand = c.brand && c.brand.length > 10 ? `${c.brand.substring(0,10)}...` : c.brand || "Brand N/A";


            return (
              <TableRow key={c.id} className={cn(rowClasses, "group")}>
                <TableCell className="sticky left-0 z-20 bg-card group-hover:bg-muted/60 px-1 py-1 align-top text-xs whitespace-nowrap shadow-[1px_0_3px_-1px_rgba(0,0,0,0.1)]" style={{ width: `${staticColumnWidths.brand}px` }}>
                  {c.isMainProduct ? (
                      <Badge variant="default" className="bg-primary text-primary-foreground text-[10px] flex items-center gap-1 truncate" title={c.brand || "Brand N/A"}>
                          <Star className="h-3 w-3 shrink-0" /> <span className="truncate">{displayBrand}</span>
                      </Badge>
                  ) : (
                      <p className="truncate" title={c.brand || "N/A"}>{c.brand || "N/A"}</p>
                  )}
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.productName}px` }}>
                  <p className="truncate" title={c.title || "N/A"}>
                     {c.title && c.title.length > 35 ? `${c.title.substring(0, 35)}...` : c.title || "N/A"}
                  </p>
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.asin}px` }}>
                  {c.asinCode ? (
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      title={`View ASIN ${c.asinCode}`}
                    >
                      {c.asinCode}
                    </a>
                  ) : (
                    <p className="text-muted-foreground truncate" title="N/A">N/A</p>
                  )}
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-right text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.currentPrice}px` }}>
                  {c.price !== null && c.price !== undefined ? `${currencySymbol}${c.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-right text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.listPrice}px` }}>
                  {c.initial_price !== null && c.initial_price !== undefined ? `${currencySymbol}${c.initial_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-center text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.discount}px` }}>
                  <Badge variant={discountPercent !== 'N/A' ? 'destructive' : 'secondary'} className="px-1.5 py-0.5 text-[10px]">{discountPercent}</Badge>
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.dealType}px` }}>
                   {c.deal_type ? <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] truncate" title={c.deal_type}>{c.deal_type}</Badge> : <p className="truncate" title="N/A">N/A</p>}
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.dispatchedFrom}px` }}>
                   <p className="truncate" title={c.ships_from || "N/A"}>{c.ships_from || "N/A"}</p>
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.soldBy}px` }}>
                  <p className="truncate" title={c.buybox_seller || c.sellerName || "N/A"}>{c.buybox_seller || c.sellerName || "N/A"}</p>
                </TableCell>
                {dynamicBsrCategories.map(categoryName => (
                  <TableCell
                    key={`${c.id}-${categoryName}`}
                    className="px-1 py-1 text-right whitespace-nowrap align-top text-xs"
                    style={{ width: `${dynamicColumnBaseWidth}px` }}
                  >
                    {getRankForCategory(c, categoryName)}
                  </TableCell>
                ))}
                <TableCell className="px-1 py-1 align-top text-xs whitespace-nowrap" style={{ width: `${staticColumnWidths.fastestDelivery}px` }}>
                    <p className="truncate" title={fastestDeliveryText}>{fastestDeliveryText}</p>
                </TableCell>
                <TableCell className="px-1 py-1 align-top text-center whitespace-nowrap" style={{ width: `${staticColumnWidths.actions}px` }}>
                  {!c.isMainProduct ? (
                      <div className="flex items-center justify-center">
                      <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive/90"
                          onClick={() => onDeleteCompetitorLink(c.competitorListingId, c.asinCode || 'Unknown ASIN')}
                          title="Delete Competitor Link"
                      >
                          <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      </div>
                  ) : (
                      <span className="text-muted-foreground text-[10px]">N/A</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" className="h-2.5 [&>div]:bg-neutral-300 dark:[&>div]:bg-neutral-700 [&>div]:rounded-sm" />
      <ScrollBar orientation="vertical" className="w-2.5 [&>div]:bg-neutral-300 dark:[&>div]:bg-neutral-700 [&>div]:rounded-sm" />
    </ScrollArea>
  );
}

