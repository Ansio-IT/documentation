
"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { FullDepletionReportEntry, PastSalesData, SortingState, UpcomingPurchaseOrder, StockEntry } from '@/lib/types';
import { getProductByCodeAction } from '@/app/actions/product.actions';
import { fetchDepletionReportDataAction, fetchPast14DaysSalesDataAction, fetchProductUpdateTimestampsAction, findProductForDepletionAction, fetchAllUpcomingPurchaseOrdersAction, refreshDepletionReportAction } from '@/app/actions/depletion.actions';
import { fetchProductStockDetailsAction } from '@/app/actions/stock.actions';
import { searchProductsForSuggestionsAction } from '@/app/actions/product.actions';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, FilterX, ClipboardList, Loader2, Warehouse, RefreshCw } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, isValid, differenceInDays, isSameDay, startOfDay, addDays, subDays } from 'date-fns';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


const formatDateOrNA = (dateString?: string | null, dateFormat = 'dd MMM yyyy'): string => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, dateFormat);
    }
  } catch (e) { /* ignore */ }
  return 'Invalid Date';
};

const formatTimestampOrNA = (dateString?: string | null, dateFormat = 'dd MMM, hh:mm a'): string => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    if (isValid(date)) {
      return format(date, dateFormat);
    }
  } catch (e) { /* ignore */ }
  return 'Invalid Date';
};


const formatNullableNumber = (value: number | null | undefined, precision = 0): string => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return value.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
};

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const constructAmazonUrl = (asinCode: string | undefined | null, marketDomain: string | undefined | null): string => {
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

function DepletionPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const [data, setData] = useState<FullDepletionReportEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  
  const [placeOrderDate, setPlaceOrderDate] = useState<string | null>(null);
  const [requiredOrderQty, setRequiredOrderQty] = useState<number | null>(null);
  const [productInfo, setProductInfo] = useState<{ id: string; name: string | null; code: string; imageUrl: string | null; asin: string | null; marketDomainIdentifier?: string | null; } | null>(null);
  const [stockUpdatedAt, setStockUpdatedAt] = useState<string | null>(null);
  const [forecastUpdatedAt, setForecastUpdatedAt] = useState<string | null>(null);
  const [reportUpdatedAt, setReportUpdatedAt] = useState<string | null>(null);
  const [upcomingPOs, setUpcomingPOs] = useState<UpcomingPurchaseOrder[]>([]);
  
  const [pastSalesData, setPastSalesData] = useState<PastSalesData[]>([]);
  const [isLoadingPastSales, setIsLoadingPastSales] = useState(false);

  const [stockInfo, setStockInfo] = useState<StockEntry | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const query = useMemo(() => searchParams.get('q'), [searchParams]);
  
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ id: string; productCode: string; name: string | null; asin: string | null }[]>([]);

  const debouncedSearch = useCallback(debounce(async (term: string) => {
    if (term.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const results = await searchProductsForSuggestionsAction(term);
    setSearchResults(results);
    setIsSearching(false);
  }, 300), []);
  
  const combinedData = useMemo(() => {
    const timelineMap = new Map<string, any>();
    const today = startOfDay(new Date());

    const processedPastSales = pastSalesData.map(d => {
        let unitsToDisplay = d.unitsSold;
        let alertType = 'Actual';
        if (d.unitsSold === 0 && d.dailyForecast !== null && d.dailyForecast !== undefined && d.dailyForecast > 0) {
            unitsToDisplay = d.dailyForecast;
            alertType = 'Forecast';
        }
        return {
            ...d,
            unitsSold: unitsToDisplay,
            alertType: alertType,
            isForecast: false,
            etaDateVal: null,
            incomingQtyVal: null,
            statusFlag: null,
        };
    });
    
    const historicalDates = new Set(pastSalesData.map(d => d.date));

    const futureForecasts = data
      .filter(d => d.forecastDate && !historicalDates.has(d.forecastDate))
      .map(d => ({
        date: d.forecastDate,
        day: d.dayName,
        remainingStock: d.remainingStock,
        unitsSold: d.dailyForecast,
        alertType: d.statusFlag,
        isForecast: true,
        etaDateVal: d.etaDate,
        incomingQuantity: d.incomingQuantity,
        statusFlag: d.statusFlag,
      }));

    const finalTimelineData = [...processedPastSales, ...futureForecasts].filter(d => d.date);
    
    finalTimelineData.forEach(d => {
        if (!d.date) return;
        const rowDate = parseISO(d.date);
        let note = '';
        const isToday = isSameDay(today, rowDate);
        if (isValid(rowDate)) {
            const diffDays = differenceInDays(rowDate, today);
             if (diffDays >= -13 && diffDays < 0) {
                note = `T-${Math.abs(diffDays)}`;
            } else if(isToday) {
                note = 'Today';
            }
        }
        
        let finalAlertType = d.alertType;
        if (d.statusFlag && d.statusFlag.includes('Alert')) {
            finalAlertType = 'Depletion Alert';
        }

        timelineMap.set(d.date, {
            ...d,
            isEvent: false,
            note: note,
            isToday: isToday,
            alertType: finalAlertType,
            requiredOrderQtyVal: null,
        });
    });

    if (placeOrderDate) {
        const existing = timelineMap.get(placeOrderDate) || { date: placeOrderDate, day: format(parseISO(placeOrderDate), 'EEEE'), isForecast: true, alertType: 'Forecast' };
        timelineMap.set(placeOrderDate, { 
          ...existing, 
          isEvent: true, 
          note: 'Place Order', 
          alertType: 'Place Order',
          requiredOrderQtyVal: requiredOrderQty,
        });
    }

    upcomingPOs.forEach(po => {
        if (po.etaDate) {
            const etaDateStr = format(parseISO(po.etaDate), 'yyyy-MM-dd');
            const existing = timelineMap.get(etaDateStr) || { date: etaDateStr, day: format(parseISO(etaDateStr), 'EEEE'), isForecast: true, note: '', alertType: 'Forecast' };
            const existingQty = existing.incomingQtyVal || 0;
            const newQty = po.incomingQty || 0;
            timelineMap.set(etaDateStr, {
                ...existing,
                isEvent: true,
                note: (existing.note && existing.note !== 'Forecast' ? existing.note + ', ' : '') + 'ETA Date',
                alertType: (existing.alertType && existing.alertType !== 'Forecast' ? existing.alertType + ', ' : '') + 'ETA',
                etaDateVal: po.etaDate,
                incomingQtyVal: existingQty + newQty,
            });
        }
    });

    return Array.from(timelineMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [pastSalesData, data, placeOrderDate, upcomingPOs, requiredOrderQty]);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);
  
  const handleProductSelect = (productCode: string) => {
    const params = new URLSearchParams();
    params.set('q', productCode);
    router.push(`/depletion?${params.toString()}`, { scroll: false });
    setIsSearchPopoverOpen(false);
  };

  const findAndFetchData = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setIsLoadingPastSales(true);
    setIsLoadingStock(true);
    setReportUpdatedAt(null);

    const { productCode, error } = await findProductForDepletionAction(searchQuery);

    if (error || !productCode) {
      toast({ title: "Search Failed", description: error || "Could not find a unique product.", variant: "destructive" });
      setData([]);
      setTotalCount(0);
      setProductInfo(null);
      setIsLoading(false);
      setIsLoadingPastSales(false);
      setIsLoadingStock(false);
      return;
    }

    const productResult = await getProductByCodeAction(productCode);
    const productId = productResult?.id;

    const params = {
      productCode: productCode,
      pageIndex: 0,
      pageSize: 365, // Fetch a full year for stock-out calculation
      sorting: [],
    };

    try {
      const promises: any[] = [
        fetchDepletionReportDataAction(params),
        Promise.resolve(productResult),
        fetchPast14DaysSalesDataAction(productCode),
        fetchProductUpdateTimestampsAction(productCode),
      ];

      if (productId) {
          promises.push(fetchAllUpcomingPurchaseOrdersAction(productId));
          promises.push(fetchProductStockDetailsAction(productId)); // Add this new fetch
      } else {
          promises.push(Promise.resolve([])); // for allPOsResult
          promises.push(Promise.resolve(null)); // for stockDetailsResult
      }

      const [reportResult, fetchedProductResult, pastSalesResult, updateTimestampsResult, allPOsResult, stockDetailsResult] = await Promise.all(promises);
      
      setStockInfo(stockDetailsResult); // Set stock info state
      const processedData = reportResult.data;
      
      setData(processedData);
      setTotalCount(reportResult.data.length);
      setPastSalesData(pastSalesResult);

      if (reportResult.data && reportResult.data.length > 0) {
          if (reportResult.data[0].updatedAt) {
            setReportUpdatedAt(reportResult.data[0].updatedAt);
          }
          const reorderLeadTime = reportResult.data[0].reorderLeadTime ?? 100;
          const stockOutEntry = reportResult.data.find((entry: FullDepletionReportEntry) => entry.remainingStock !== null && entry.remainingStock <= 0);
          
          if (stockOutEntry && stockOutEntry.forecastDate) {
              try {
                  const calculatedPlaceOrderDate = subDays(parseISO(stockOutEntry.forecastDate), reorderLeadTime);
                  const orderDateStr = format(calculatedPlaceOrderDate, 'yyyy-MM-dd');
                  setPlaceOrderDate(orderDateStr);
                  
                  const orderDateEntry = processedData.find((d: FullDepletionReportEntry) => d.forecastDate === stockOutEntry.forecastDate);
                  setRequiredOrderQty(orderDateEntry?.requiredOrderQuantity ?? null);
              } catch (e) {
                  console.error("Error calculating place order date:", e);
                  setPlaceOrderDate(null);
                  setRequiredOrderQty(null);
              }
          } else {
              setPlaceOrderDate(null);
              setRequiredOrderQty(null);
          }
      } else {
        setPlaceOrderDate(null);
        setRequiredOrderQty(null);
      }
      
      if (updateTimestampsResult) {
          setStockUpdatedAt(updateTimestampsResult.stockUpdatedAt);
          setForecastUpdatedAt(updateTimestampsResult.forecastUpdatedAt);
      } else {
          setStockUpdatedAt(null);
          setForecastUpdatedAt(null);
      }

      if (allPOsResult) {
          setUpcomingPOs(allPOsResult);
      } else {
          setUpcomingPOs([]);
      }

      if (fetchedProductResult) {
        setProductInfo({
          id: fetchedProductResult.id,
          name: fetchedProductResult.name,
          code: fetchedProductResult.productCode,
          imageUrl: fetchedProductResult.imageUrl,
          asin: fetchedProductResult.asinCode ?? null,
          marketDomainIdentifier: fetchedProductResult.marketDomainIdentifier,
        });
      } else if (reportResult.data && reportResult.data.length > 0) {
        const firstEntry = reportResult.data[0];
         setProductInfo({
          id: firstEntry.productId,
          name: firstEntry.productName,
          code: firstEntry.productCode,
          imageUrl: firstEntry.imageUrl,
          asin: null,
        });
      } else {
          setProductInfo(null);
      }

    } catch (fetchError) {
      console.error("Error fetching depletion report data:", fetchError);
      toast({ title: "Fetch Error", description: "Could not fetch report data.", variant: "destructive" });
      setData([]);
      setTotalCount(0);
      setProductInfo(null);
    } finally {
      setIsLoading(false);
      setIsLoadingPastSales(false);
      setIsLoadingStock(false);
    }
  }, [toast]);

  useEffect(() => {
    setSearchTerm(query || '');

    if (!query) {
      setData([]);
      setTotalCount(0);
      setIsLoading(false);
      setPlaceOrderDate(null);
      setRequiredOrderQty(null);
      setProductInfo(null);
      setPastSalesData([]);
      setStockUpdatedAt(null);
      setForecastUpdatedAt(null);
      setUpcomingPOs([]);
      setStockInfo(null);
      return;
    }
    findAndFetchData(query);
  }, [query, findAndFetchData]);
  
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('q', searchTerm.trim());
    } else {
      params.delete('q');
    }
    router.push(`/depletion?${params.toString()}`, { scroll: false });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setPlaceOrderDate(null);
    setProductInfo(null);
    setPastSalesData([]);
    router.push('/depletion', { scroll: false });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast({ title: "Refreshing Report", description: "Please wait while the data is being updated..." });
    const result = await refreshDepletionReportAction();
    if (result.success) {
      toast({ title: "Refresh Successful", description: "The depletion report has been updated." });
      if (query) {
        await findAndFetchData(query);
      }
    } else {
      toast({ title: "Refresh Failed", description: result.message || "Could not update the report.", variant: "destructive" });
    }
    setIsRefreshing(false);
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="p-4">
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }
  
    if (data.length === 0) {
      return (
        <div className="text-center py-6 min-h-[100px] flex flex-col items-center justify-center">
          <p className="text-sm text-muted-foreground">No forecast data available for this product.</p>
        </div>
      );
    }

    return (
        <ScrollArea className="w-full whitespace-nowrap">
            <Table className="min-w-max border-collapse">
                <TableHeader>
                    <TableRow className="text-xs h-auto">
                        <TableHead className="sticky left-0 z-20 bg-card p-1 text-sm font-semibold align-bottom border-r w-28">Date</TableHead>
                        {data.slice(0, 14).map((entry) => (
                            <TableHead
                                key={entry.id}
                                className={cn(
                                    "p-1 border-b text-left min-w-[50px] w-14",
                                    entry.isWeekend && "bg-amber-50 dark:bg-amber-900/10"
                                )}
                            >
                                <div className="flex flex-col items-end justify-end">
                                    <span className={cn("font-semibold text-xs", entry.isWeekend && "text-amber-700")}>{entry.dayName}</span>
                                    <span className="font-mono text-xs">{format(parseISO(entry.forecastDate), 'dd/MM/yy')}</span>
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell className="sticky left-0 bg-card p-1 text-sm font-semibold border-r">Depletion</TableCell>
                        {data.slice(0, 14).map((entry) => (
                            <TableCell key={entry.id} className={cn("py-1 px-1 text-right align-middle font-mono text-sm", entry.isWeekend && "bg-amber-50 dark:bg-amber-900/10")}>
                                {entry.remainingStock?.toLocaleString() ?? 'N/A'}
                            </TableCell>
                        ))}
                    </TableRow>
                     <TableRow>
                        <TableCell className="sticky left-0 bg-card py-1 px-1 text-sm font-semibold border-r">Daily Sales Forecast</TableCell>
                        {data.slice(0, 14).map((entry) => (
                            <TableCell key={`${entry.id}-forecast`} className={cn("py-1 px-1 text-right align-middle font-mono text-sm text-muted-foreground", entry.isWeekend && "bg-amber-50 dark:bg-amber-900/10")}>
                                {entry.dailyForecast?.toLocaleString() ?? 'N/A'}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    );
  };

  const renderPastSalesTable = () => {
    if (!query) return null;
    
    if (isLoadingPastSales) {
      return (
        <Card>
          <CardHeader><CardTitle>Sales &amp; Order Events</CardTitle></CardHeader>
          <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
      );
    }

    if (combinedData.length === 0) {
      return (
        <Card>
          <CardHeader><CardTitle>Sales &amp; Order Events</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground p-4">No historical sales data or upcoming order events found.</p></CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-start gap-x-6 p-3">
          <div className="flex-grow">
              <CardTitle>Sales &amp; Order Events</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full" style={{ height: '80vh' }}>
            <Table className="min-w-[500px]">
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="p-1 text-left">📅 Date</TableHead>
                  <TableHead className="p-1 text-left">🗓️ Day</TableHead>
                  <TableHead className="text-right tabular-nums p-1">📦 Remaining Stock</TableHead>
                  <TableHead className="text-right tabular-nums p-1">📈 Sold/Forecast</TableHead>
                  <TableHead className="p-1 text-center">📝 Note</TableHead>
                  <TableHead className="p-1 text-left">⚠️ Alert Type</TableHead>
                  <TableHead className="text-right tabular-nums p-1">🚢 ETA (In)</TableHead>
                  <TableHead className="text-right tabular-nums p-1">📥 Incoming Qty</TableHead>
                  <TableHead className="text-right tabular-nums p-2">Required Order Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedData.map((item, index) => {
                  if (!item.date) return null;
                  const rowDateObj = parseISO(item.date);
                  if (!isValid(rowDateObj)) return null;

                  const day = item.day || format(rowDateObj, 'EEEE');
                  const isWeekend = day.startsWith('Saturday') || day.startsWith('Sunday');
                  
                  return (
                    <TableRow 
                        key={`${item.date}-${item.note || index}`}
                        className={cn(
                            isWeekend && "bg-amber-50 dark:bg-amber-900/10",
                            item.isToday && "bg-primary/25 text-foreground font-bold dark:bg-primary/35 dark:text-foreground"
                        )}
                    >
                      <TableCell className="p-1 text-sm text-left">{format(rowDateObj, 'dd-MMM-yyyy')}</TableCell>
                      <TableCell className={cn("p-1 text-sm text-left", isWeekend && "text-amber-700")}>{day}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums p-1 text-sm">{!item.isEvent || (item.remainingStock !== undefined) ? (item.remainingStock?.toLocaleString() ?? 'N/A') : ''}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums p-1 text-sm">{!item.isEvent || (item.unitsSold !== undefined) ? (item.unitsSold?.toLocaleString() ?? 'N/A') : ''}</TableCell>
                      <TableCell className="p-1 text-sm text-center font-semibold">{item.note ?? ''}</TableCell>
                      <TableCell className="p-1 text-sm text-left">
                        {item.alertType === 'Depletion Alert' || item.alertType === 'Critical - Stockout' ? (
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-600 font-medium">{item.alertType}</span>
                          </div>
                        ) : (
                          item.alertType ?? ''
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums p-1 text-sm">{item.etaDateVal ? formatDateOrNA(item.etaDateVal, 'dd-MMM-yyyy') : ''}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums p-1 text-sm">{item.incomingQtyVal ? formatNullableNumber(item.incomingQtyVal, 0) : ''}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums p-2">{item.requiredOrderQtyVal ? formatNullableNumber(item.requiredOrderQtyVal, 0) : ''}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  const StockInfoSummary = () => {
    if (!productInfo) return null;
    if (isLoadingStock) {
      return (
        <div className="bg-card p-2 rounded-lg border flex items-center justify-around gap-x-4 mb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      );
    }
    if (!stockInfo) {
      return null;
    }
    const totalStock = (stockInfo.bwwAvailableStock ?? 0) + (stockInfo.fbaGbStock ?? 0) + (stockInfo.vcStock ?? 0);
    return (
      <div className="bg-card p-2 rounded-lg border flex flex-wrap items-center justify-left gap-x-1 gap-y-2 mb-4 text-xs font-semibold">
          <div className="flex items-center gap-2" title="Total available stock from all sources">
              <Warehouse className="h-4 w-4 text-muted-foreground"/>
              <span className="text-foreground">Stock In Hand:</span>
              <span className="font-mono text-primary">{totalStock.toLocaleString()}</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="BWW Available Stock">
              <span className="text-muted-foreground">BWW Avail:</span>
              <span className="font-mono">{formatNullableNumber(stockInfo.bwwAvailableStock)}</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="FBA GB Stock">
              <span className="text-muted-foreground">FBA GB:</span>
              <span className="font-mono">{formatNullableNumber(stockInfo.fbaGbStock)}</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
           <div className="flex items-center gap-1.5" title="VC Stock">
              <span className="text-muted-foreground">VC Stock:</span>
              <span className="font-mono">{formatNullableNumber(stockInfo.vcStock)}</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
           <div className="flex items-center gap-1.5" title="UK Transit">
              <span className="text-muted-foreground">UK Transit:</span>
              <span className="font-mono">N/A</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
           <div className="flex items-center gap-1.5" title="UK to EU Transit">
              <span className="text-muted-foreground">UK to EU Transit:</span>
              <span className="font-mono">N/A</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="Stock Ordered">
              <span className="text-muted-foreground">Stock Ordered:</span>
              <span className="font-mono">N/A</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="Sailing Stock">
              <span className="text-muted-foreground">Sailing Stock:</span>
              <span className="font-mono">N/A</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="Sailing Arrival">
              <span className="text-muted-foreground">Sailing Arrival:</span>
              <span className="font-mono">N/A</span>
          </div>
          <div className="h-4 border-l mx-1"></div>
          <div className="flex items-center gap-1.5" title="In Production">
              <span className="text-muted-foreground">In Production:</span>
              <span className="font-mono">N/A</span>
          </div>
      </div>
    );
  }


  return (
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-2xl font-semibold text-foreground flex items-center">
          <ClipboardList className="mr-3 h-7 w-7 text-primary" />
          Depletion Report
        </h1>

        <div className="flex items-center gap-2 flex-grow justify-end">
          <div className="relative w-full max-w-lg">
            <Label htmlFor="depletion-search" className="sr-only">Search Product</Label>
            <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
              <PopoverTrigger asChild>
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="depletion-search"
                    placeholder="Search by Product Code, Name, or ASIN..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (!isSearchPopoverOpen) setIsSearchPopoverOpen(true);
                    }}
                    onClick={() => setIsSearchPopoverOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-8 w-full"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <Command shouldFilter={false}>
                  <CommandList>
                    {isSearching && (
                      <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                      </div>
                    )}
                    {!isSearching && searchTerm.length > 1 && searchResults.length === 0 && (
                      <CommandEmpty>No products found.</CommandEmpty>
                    )}
                    {!isSearching && searchResults.length > 0 && (
                      <CommandGroup heading="Suggestions">
                        {searchResults.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.productCode}-${product.name}-${product.asin}`}
                            onSelect={() => handleProductSelect(product.productCode)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{product.name || 'Unnamed Product'}</span>
                              <span className="text-xs text-muted-foreground">
                                SKU: {product.productCode} {product.asin && `| ASIN: ${product.asin}`}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={handleSearch} className="w-full sm:w-auto">
                <Search className="mr-2 h-4 w-4 sm:hidden" /> Search
              </Button>
              <Button onClick={handleResetFilters} variant="outline" className="w-full sm:w-auto">
                <FilterX className="mr-2 h-4 w-4 sm:hidden" /> Reset
              </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="icon" className="ml-4" disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="sr-only">Refresh Report</span>
          </Button>
        </div>
      </div>
      
      {isLoading && !productInfo && query ? (
          <div className="flex flex-col md:flex-row items-start gap-x-6 p-4 mb-4 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-x-4 shrink-0 mb-4 md:mb-0">
                  <Skeleton className="h-20 w-20 rounded-md shrink-0" />
                  <div className="flex-grow space-y-2">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                  </div>
              </div>
              <div className="flex-grow pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                      <div className="flex flex-col space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <div className="flex flex-col space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                  </div>
              </div>
          </div>
        ) : productInfo && (
            <div className="bg-card p-3 rounded-lg shadow-md border mb-4">
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                    {/* Row 1 */}
                    <div className="md:row-span-2 flex items-center md:pr-4 md:border-r">
                         <div className="relative w-16 h-16 shrink-0">
                            <Image
                                src={productInfo.imageUrl || 'https://placehold.co/100x100.png'}
                                alt={productInfo.name || 'Product'}
                                fill
                                className="rounded-md object-contain border"
                                data-ai-hint="product photo"
                            />
                        </div>
                        <div className="ml-3">
                             <h2 className="text-base font-semibold text-foreground truncate max-w-[200px]" title={productInfo.name || ''}>
                                {productInfo.name}
                            </h2>
                            <div className="text-xs text-muted-foreground flex items-center gap-x-2">
                                <span>SKU: {productInfo.code}</span>
                                {productInfo.asin && (
                                <>
                                    <span className="text-gray-300">|</span>
                                    <span>
                                        ASIN: 
                                        <a href={constructAmazonUrl(productInfo.asin, productInfo.marketDomainIdentifier)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                                            {productInfo.asin}
                                        </a>
                                    </span>
                                </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm items-center">
                        <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">To be Ordered</span><span className="font-semibold text-primary">{formatDateOrNA(placeOrderDate)}</span></div>
                        <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">PO Date</span><span className="font-semibold text-primary">{formatDateOrNA(upcomingPOs[0]?.poDate)}</span></div>
                        <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">ETA Date</span><span className="font-semibold text-primary">{formatDateOrNA(upcomingPOs[0]?.etaDate)}</span></div>
                        <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">Required Order Qty</span><span className="font-semibold text-primary">{formatNullableNumber(requiredOrderQty)}</span></div>
                    </div>
                    {/* Row 2 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm items-center">
                       <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">Stock Last Updated</span><span className="font-semibold text-primary">{formatTimestampOrNA(stockUpdatedAt)}</span></div>
                       <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">Forecast Last Updated</span><span className="font-semibold text-primary">{formatTimestampOrNA(forecastUpdatedAt)}</span></div>
                       <div className="flex flex-col"><span className="text-xs font-medium text-muted-foreground">Report Last Updated</span><span className="font-semibold text-primary">{formatTimestampOrNA(reportUpdatedAt)}</span></div>
                    </div>
                </div>
            </div>
        )}

      <div className="flex-grow overflow-y-auto min-h-0 space-y-6">
        {productInfo && (
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1" className="border rounded-lg shadow-sm bg-card">
              <AccordionTrigger className="p-4 hover:no-underline text-base font-semibold">
                14-Day Forecast Details
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 border-t pt-4">
                <StockInfoSummary />
                {renderContent()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {!productInfo && !isLoading && (
            <div className="text-center py-12 min-h-[100px] flex flex-col items-center justify-center rounded-md border bg-card shadow-sm">
              <Search className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-semibold text-foreground">Search for a Product</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enter a Product Code, Name, or ASIN to view its depletion report.
              </p>
            </div>
        )}
        
        {productInfo && renderPastSalesTable()}
      </div>
    </div>
  );
}

export default function DepletionPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading depletion report...</div>}>
      <DepletionPageContent />
    </Suspense>
  );
}



    
