"use client";

import React, { Suspense, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ChevronDown, ChevronUp, Search, Loader2 } from 'lucide-react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  createColumnHelper,
  Header,
  sortingFns,
  SortingFn,
  Row,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { formatInTimeZone } from 'date-fns-tz';
import { format, subDays, setHours, setMinutes, setSeconds, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { PortfolioSetting, BrandAnalyticsData } from '@/lib/types';
import { fetchAllPortfoliosAction, fetchSubPortfoliosAction } from '@/app/actions/portfolio.actions';
import { fetchActivePrioritiesAction, type Priority } from '@/app/actions/priority.actions';
import { 
  fetchBrandAnalyticsData, 
  fetchLatestSovDateAction, 
  fetchLatestBrandAnalyticsDateAction, 
  fetchAvailableBrandAnalyticsDates,
  fetchAvailableSovCrawlDates,
  fetchAvailableSovCrawlTimestamps
} from '@/app/actions/brand-analytics.actions';
import { useToast } from '@/hooks/use-toast';

const formatNullableNumber = (value: number | string | null | undefined, toFixed: number = 2) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString(undefined, { minimumFractionDigits: toFixed, maximumFractionDigits: toFixed });
};

const formatPercentage = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  return `${(num).toFixed(2)}%`;
}

const columnHelper = createColumnHelper<BrandAnalyticsData>();

// Custom sorting function to handle 'N/A' and '-' as 0
const numericSortWithNullsAsZero: SortingFn<BrandAnalyticsData> = (rowA, rowB, columnId) => {
  let a = rowA.getValue<number | null>(columnId);
  let b = rowB.getValue<number | null>(columnId);

  if (a === null || a === undefined) a = 0;
  if (b === null || b === undefined) b = 0;

  return a < b ? 1 : a > b ? -1 : 0;
};

// FIXED: Better debounce function with cleanup
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  // Add cancel method for cleanup
  debounced.cancel = () => {
    clearTimeout(timeout);
  };

  return debounced;
}

function BrandAnalyticsTable({ 
    data, 
    isLoading,
    globalFilter, 
    setGlobalFilter,
    sorting,
    setSorting,
    brandAnalyticsDate,
    setBrandAnalyticsDate,
    sovDate,
    setSovDate,
    availableBrandAnalyticsDates,
    availableSovDates,
    availableSovTimestamps,
    setAvailableSovTimestamps,
    fetchTimestampsForDate,
}: { 
    data: BrandAnalyticsData[];
    isLoading: boolean;
    globalFilter: string; 
    setGlobalFilter: (value: string) => void;
    sorting: SortingState;
    setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
    brandAnalyticsDate: Date;
    setBrandAnalyticsDate: (date: Date) => void;
    sovDate: Date;
    setSovDate: (date: Date) => void;
    availableBrandAnalyticsDates: string[];
    availableSovDates: string[];
    availableSovTimestamps: string[];
    setAvailableSovTimestamps: (timestamps: string[]) => void;
    fetchTimestampsForDate: (date: Date, abortSignal?: AbortSignal) => Promise<void>;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const floatingScrollbarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const columnWidths = {
    searchTerm: 120,
    brand: 100,
    competitorAsin: 110,
  }

  // Use a Set for efficient date checking
  const analyticsDateSet = useMemo(() => new Set(availableBrandAnalyticsDates), [availableBrandAnalyticsDates]);
  const sovDateSet = useMemo(() => new Set(availableSovDates), [availableSovDates]);

  // FIXED: Extract handlers to reduce column dependencies
  const handleBrandAnalyticsDateChange = useCallback((date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const noonDate = new Date(`${dateString}T12:00:00`);
    setBrandAnalyticsDate(noonDate);
  }, [setBrandAnalyticsDate]);

  const handleSovDateChange = useCallback((date: Date) => {
    fetchTimestampsForDate(date);
    // Default to the first timestamp of the new day if available, otherwise keep time
    const newDate = setSeconds(setMinutes(setHours(date, sovDate.getHours()), sovDate.getMinutes()), 0);
    setSovDate(newDate);
  }, [fetchTimestampsForDate, sovDate, setSovDate]);

  const handleTimestampChange = useCallback((timestampStr: string) => {
    if (timestampStr) {
      setSovDate(parseISO(timestampStr));
    }
  }, [setSovDate]);

  // FIXED: Reduced column dependencies
  const columns = useMemo<ColumnDef<BrandAnalyticsData>[]>(() => [
    columnHelper.group({
      id: 'common',
      columns:[
        columnHelper.accessor('Search Term', { header: 'Search term', size: columnWidths.searchTerm, cell: info => info.getValue() || 'N/A', enableSorting: true }),
        columnHelper.accessor('Brand', { header: 'Brand', size: columnWidths.brand, cell: info => info.getValue() || 'N/A', enableSorting: true }),
        columnHelper.accessor('Competitor ASIN', { header: () => <>Competitor<br/>ASIN</>, size: columnWidths.competitorAsin, cell: info => info.getValue() || 'N/A', enableSorting: true }),
        columnHelper.accessor('Keyword Status', { header: () => <>Keyword<br/>Status</>, size: 120, cell: info => info.getValue() || 'N/A', enableSorting: true }),
        columnHelper.accessor('ASIN Status', { header: () => <>ASIN<br/>Status</>, size: 100, cell: info => info.getValue() || 'N/A', enableSorting: true }),
        columnHelper.accessor('Title', { header: 'Title', size: 100, cell: info => (<div className="truncate w-[100px]" title={info.getValue() ?? undefined}>{info.getValue() || 'N/A' }</div>), enableSorting: true }),
        columnHelper.accessor('Type', { header: 'Type', size: 100, cell: info => info.getValue() || 'N/A', enableSorting: true }),
      ]
    }),
    columnHelper.group({
      id: 'brandAnalytics',
      header: () => (
        <div className="text-center font-semibold">
          Brand Analytics
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={cn("block w-full h-auto p-0 font-normal text-xs text-muted-foreground hover:bg-transparent", "hover:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0")}>
                ({format(brandAnalyticsDate, 'dd-MM-yyyy, EEE')})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
                <Calendar 
                    mode="single" 
                    selected={brandAnalyticsDate} 
                    onSelect={(date) => { if (date) handleBrandAnalyticsDateChange(date); }} 
                    disabled={(date) => !analyticsDateSet.has(format(date, 'yyyy-MM-dd'))}
                    initialFocus 
                />
            </PopoverContent>
          </Popover>
        </div>
      ),
      columns: [
        columnHelper.accessor('Search Frequency Rank', { header: 'Search frequency rank', size: 120, cell: info => info.getValue()?.toLocaleString() ?? 'N/A', enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('Click Share (ASIN)', { header: () => <div className="text-center">Click Share<br/><span className="text-xs font-normal">(ASIN)</span></div>, size: 110, cell: info => formatPercentage(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('Conversion Share (ASIN)', { header: () => <div className="text-center">Conversion Share<br/><span className="text-xs font-normal">(ASIN)</span></div>, size: 120, cell: info => formatPercentage(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('Top Clicked Brand', { header: () => <>Top<br />Clicked Brand</>, size: 120, cell: info => info.getValue() || 'N/A', enableSorting: true }),
      ],
    }),
    columnHelper.group({
      id: 'sov',
      header: () => {
        const bstDisplay = `(${formatInTimeZone(sovDate, 'Europe/London', "dd/MM/yyyy, hh:mm aa 'BST'")})`;
        return (
            <div className="text-center font-semibold">
            SOV
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="ghost" className={cn("block w-full h-auto p-0 font-normal text-xs text-muted-foreground hover:bg-transparent", "hover:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0")}>
                    {bstDisplay}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar 
                    mode="single" 
                    selected={sovDate} 
                    onSelect={(date) => { 
                      if (date) { 
                        handleSovDateChange(date);
                      }
                    }} 
                    disabled={(date) => !sovDateSet.has(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                  />
                  <div className="p-2 border-t space-y-2">
                     <div>
                        <Label htmlFor="timestamps-available" className="text-xs">Timestamps Available (BST)</Label>
                        <Select
                          disabled={availableSovTimestamps.length === 0}
                          onValueChange={handleTimestampChange}
                          value={availableSovTimestamps.includes(sovDate.toISOString()) ? sovDate.toISOString() : ''}
                        >
                            <SelectTrigger id="timestamps-available" className="mt-1 h-8 text-xs">
                                <SelectValue placeholder={availableSovTimestamps.length > 0 ? "Select a timestamp" : "No timestamps found"} />
                            </SelectTrigger>
                            <SelectContent>
                               {availableSovTimestamps.map(ts => (
                                 <SelectItem key={ts} value={ts}>
                                   {formatInTimeZone(parseISO(ts), 'Europe/London', "HH:mm:ss 'BST'")}
                                 </SelectItem>
                               ))}
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                </PopoverContent>
            </Popover>
            </div>
        );
      },
      columns: [
        columnHelper.accessor('Amazon Choice', { header: 'Amazon Choice', size: 100, cell: info => info.getValue() ? 'TRUE' : 'FALSE', enableSorting: true }),
        columnHelper.accessor('Spons Rank', { header: 'Spons Rank', size: 90, cell: info => info.getValue()?.toLocaleString() ?? 'N/A', enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('Organic Rank', { header: 'Organic Rank', size: 90, cell: info => info.getValue()?.toLocaleString() ?? 'N/A', enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('All Rank', { header: 'All Rank', size: 80, cell: info => info.getValue()?.toLocaleString() ?? 'N/A', enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV Ads Top of Search', { header: () => <div className="text-center">SOV Ads<br/><span className="text-xs font-normal">(Top of Search)</span></div>, size: 120, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV (TOS & 4 stars and above Ads)', { header: () => <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="cursor-help border-b border-dashed border-muted-foreground text-center">SOV<br /><span className="text-xs font-normal">(TOS & High-Rank Ads)</span></div></TooltipTrigger><TooltipContent><p>SOV (TOS & "4 stars and above Ads" (Anything overall rank is less than 20))</p></TooltipContent></Tooltip></TooltipProvider>, size: 150, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV Ads Rest of Search (> 20 ranks)', { header: () => <div className="text-center">SOV Ads Rest of Search<br/><span className="text-xs font-normal">( > 20 ranks)</span></div>, size: 160, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV Ads All', { header: () => <div className="text-center">SOV Ads<br/><span className="text-xs font-normal">(All)</span></div>, size: 120, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV Only Organic', { header: 'SOV Only Organic', size: 110, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
        columnHelper.accessor('SOV All (both Ads and Organic)', { header: () => <div className="text-center">SOV All<br/><span className="text-xs font-normal">(both Ads and Organic)</span></div>, size: 140, cell: info => formatNullableNumber(info.getValue()), enableSorting: true, sortingFn: numericSortWithNullsAsZero }),
      ],
    }),
  ], [
    brandAnalyticsDate, 
    sovDate, 
    analyticsDateSet, 
    sovDateSet, 
    availableSovTimestamps,
    handleBrandAnalyticsDateChange,
    handleSovDateChange,
    handleTimestampChange
  ]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  useEffect(() => {
    const tableEl = tableContainerRef.current;
    const scrollbarEl = floatingScrollbarRef.current;
    if (!tableEl || !scrollbarEl) return;
    let isTableScrolling = false;
    let isScrollbarScrolling = false;
    const handleTableScroll = () => { if (isScrollbarScrolling) return; isTableScrolling = true; requestAnimationFrame(() => { scrollbarEl.scrollLeft = tableEl.scrollLeft; isTableScrolling = false; }); };
    const handleScrollbarScroll = () => { if (isTableScrolling) return; isScrollbarScrolling = true; requestAnimationFrame(() => { tableEl.scrollLeft = scrollbarEl.scrollLeft; isScrollbarScrolling = false; }); };
    tableEl.addEventListener('scroll', handleTableScroll);
    scrollbarEl.addEventListener('scroll', handleScrollbarScroll);
    return () => { tableEl.removeEventListener('scroll', handleTableScroll); scrollbarEl.removeEventListener('scroll', handleScrollbarScroll); };
  }, []);

  useEffect(() => {
    const tableEl = tableContainerRef.current;
    const scrollbarContainerEl = floatingScrollbarRef.current;
    if (!tableEl || !scrollbarContainerEl) return;
    const scrollbarContentEl = scrollbarContainerEl.firstElementChild as HTMLDivElement | null;
    if (!scrollbarContentEl) return;
    const syncVisibilityAndWidth = () => {
      const scrollWidth = tableEl.scrollWidth;
      const clientWidth = tableEl.clientWidth;
      if (scrollWidth > clientWidth) { scrollbarContainerEl.style.display = 'block'; scrollbarContentEl.style.width = `${scrollWidth}px`; } else { scrollbarContainerEl.style.display = 'none'; }
    };
    const resizeObserver = new ResizeObserver(syncVisibilityAndWidth);
    resizeObserver.observe(tableEl);
    if(tableEl.firstElementChild) { resizeObserver.observe(tableEl.firstElementChild); }
    syncVisibilityAndWidth();
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <>
      <div className="rounded-md border bg-card shadow-sm flex-grow flex flex-col min-h-0 overflow-x-auto" ref={tableContainerRef}>
        <Table>
          <TableHeader className="sticky top-0 bg-card z-30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const parentId = header.column.parent?.id;
                  const isBrandAnalytics = parentId === 'brandAnalytics' || header.id === 'brandAnalytics';
                  const isSponsSov = header.id === 'Spons Rank';
                  const isSpecialSov = header.id === 'All Rank' || header.id === 'SOV All (both Ads and Organic)';
                  const isOrganicSov = header.id === 'Organic Rank' || header.id === 'SOV Only Organic';
                  const isSov = parentId === 'sov';
                  const isSticky = index < 3;
                  
                  const headerBgClass = isBrandAnalytics ? "bg-blue-300/40 dark:bg-blue-900/40" :
                                      isSpecialSov ? "bg-purple-300/20 dark:bg-purple-900/20" :
                                      isOrganicSov ? "bg-green-300/20 dark:bg-green-900/20" :
                                      isSponsSov ? "bg-orange-200/50 dark:bg-orange-900/40" :
                                      isSov ? "bg-teal-300/40 dark:bg-teal-900/40" :
                                      "bg-card";

                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} style={{ minWidth: header.getSize(), width: header.getSize(), left: isSticky ? (index === 0 ? 0 : index === 1 ? columnWidths.searchTerm : columnWidths.searchTerm + columnWidths.brand) : undefined }} className={cn("p-2 align-top", header.column.getCanSort() && "cursor-pointer select-none", isSticky ? 'sticky z-20' : `z-10`, headerBgClass)}>
                      <div className="flex items-center justify-center gap-1 text-center" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                            asc: <ChevronUp className="h-4 w-4 text-muted-foreground" />,
                            desc: <ChevronDown className="h-4 w-4 text-muted-foreground" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                        {columns.flatMap(group => (group.columns || [group])).map((col, j) => (
                            <TableCell key={`skel-cell-${i}-${j}`} className={cn(j < 3 && "sticky z-10 bg-card", j === 0 && "left-0", j === 1 && `left-[${columnWidths.searchTerm}px]`, j === 2 && `left-[${columnWidths.searchTerm + columnWidths.brand}px]`)}>
                                <Skeleton className="h-6 w-full" />
                            </TableCell>
                        ))}
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const isAnsioRow = row.original['Brand'] === 'ANSIO';
                const rowId = row.original['Search Term'] + row.original['Competitor ASIN'];
                const isHovering = hoveredRowId === rowId;
                
                return (
                  <TableRow
                    key={row.id}
                    onMouseEnter={() => setHoveredRowId(rowId)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isSticky = index < 3;
                      const parentId = cell.column.parent?.id;

                      const getCellBgClass = () => {
                        let baseClass = 'bg-card'; // Default background
                        if (isAnsioRow) {
                          baseClass = 'bg-yellow-200/100 dark:bg-yellow-800/50';
                        } else if (parentId === 'brandAnalytics') {
                          baseClass = 'bg-blue-300/40 dark:bg-blue-900/40';
                        } else if (parentId === 'sov') {
                          const sovHeaderId = cell.column.id;
                          if (sovHeaderId === 'All Rank' || sovHeaderId === 'SOV All (both Ads and Organic)') {
                            baseClass = 'bg-purple-300/20 dark:bg-purple-900/20';
                          } else if (sovHeaderId === 'Organic Rank' || sovHeaderId === 'SOV Only Organic') {
                            baseClass = 'bg-green-300/20 dark:bg-green-900/20';
                          } else if (sovHeaderId === 'Spons Rank') {
                            baseClass = 'bg-orange-200/50 dark:bg-orange-900/40';
                          } else {
                            baseClass = 'bg-teal-300/40 dark:bg-teal-900/40';
                          }
                        }
                        
                        // For sticky columns, their background must be solid to hide scrolling content
                        // For non-sticky columns, we can apply hover effects.
                        if (isHovering) {
                            if (!isSticky) return `${baseClass} filter brightness-95 dark:brightness-110`;
                        }

                        return baseClass;
                      };
                      
                      const cellBgClass = getCellBgClass();

                      return (
                        <TableCell 
                          key={cell.id} 
                          style={{ left: isSticky ? (index === 0 ? 0 : index === 1 ? columnWidths.searchTerm : columnWidths.searchTerm + columnWidths.brand) : undefined }} 
                          className={cn(
                            "p-2 text-sm text-center",
                            isSticky ? "sticky z-10" : "",
                            cellBgClass
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div ref={floatingScrollbarRef} className="fixed bottom-0 z-50 h-[17px] overflow-x-auto overflow-y-hidden bg-muted/70 backdrop-blur-sm" style={{ display: 'none', right: '0.75rem', left: isMobile ? '0.5rem' : 'calc(var(--sidebar-width-icon, 3rem) + 0.75rem)', '--scrollbar-track': 'transparent', '--scrollbar-thumb': 'hsl(var(--foreground) / 0.4)' }}>
          <div className="h-full" />
      </div>
    </>
  );
}

const ALL_FILTER_VALUE = 'all';

function BrandAnalyticsPageContent() {
  const [globalFilter, setGlobalFilter] = useState('');
  const [allPortfolios, setAllPortfolios] = useState<PortfolioSetting[]>([]);
  const [filteredSubPortfolios, setFilteredSubPortfolios] = useState<PortfolioSetting[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
  const [selectedSubPortfolio, setSelectedSubPortfolio] = useState<string>('');
  const [availablePriorities, setAvailablePriorities] = useState<Priority[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState('uk');
  const { toast } = useToast();
  
  const [tableData, setTableData] = useState<BrandAnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'Search Term', desc: false }]);

  const [brandAnalyticsDate, setBrandAnalyticsDate] = useState<Date>(() => subDays(new Date(), 2));
  const [sovDate, setSovDate] = useState<Date>(new Date());
  const [availableBrandAnalyticsDates, setAvailableBrandAnalyticsDates] = useState<string[]>([]);
  const [availableSovDates, setAvailableSovDates] = useState<string[]>([]);
  const [availableSovTimestamps, setAvailableSovTimestamps] = useState<string[]>([]);

  // FIXED: Properly handle debounced function cleanup
  const debouncedSetGlobalFilter = useMemo(
    () => debounce((value: string) => {
      setGlobalFilter(value);
    }, 300),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      // @ts-ignore - debounce libraries usually have a cancel method
      if (debouncedSetGlobalFilter.cancel) {
        debouncedSetGlobalFilter.cancel();
      }
    };
  }, [debouncedSetGlobalFilter]);

  // FIXED: Remove toast from dependencies and add abort controller
  const loadData = useCallback(async (abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) return;
    
    setIsLoading(true);
    try {
      const dateString = format(brandAnalyticsDate, 'yyyy-MM-dd');
      const noonDate = new Date(`${dateString}T12:00:00`);
      const data = await fetchBrandAnalyticsData({
        portfolioId: selectedPortfolio || null,
        subPortfolioId: selectedSubPortfolio || null,
        priorityId: selectedPriority || null,
        globalFilter: globalFilter || null,
        brandAnalyticsDate: noonDate,
        sovDate: sovDate,
      });
      
      if (!abortSignal?.aborted) {
        setTableData(data);
      }
    } catch (err: any) {
      if (!abortSignal?.aborted) {
        toast({ 
          title: "Error", 
          description: `Failed to load analytics data: ${err.message}`, 
          variant: "destructive" 
        });
      }
    } finally {
      if (!abortSignal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [selectedPortfolio, selectedSubPortfolio, selectedPriority, globalFilter, brandAnalyticsDate, sovDate]);

  // FIXED: Add abort controller for fetchTimestampsForDate
  const fetchTimestampsForDate = useCallback(async (date: Date, abortSignal?: AbortSignal) => {
    if (abortSignal?.aborted) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      const timestamps = await fetchAvailableSovCrawlTimestamps(dateStr);
      
      if (!abortSignal?.aborted) {
        setAvailableSovTimestamps(timestamps);
        if (timestamps.length > 0) {
          setSovDate(parseISO(timestamps[0]));
        }
      }
    } catch (error) {
      if (!abortSignal?.aborted) {
        console.error('Error fetching timestamps:', error);
      }
    }
  }, []);

  // FIXED: Fix initial data loading with proper abort handling
  useEffect(() => {
    const abortController = new AbortController();
    
    async function loadInitialFilters() {
      if (abortController.signal.aborted) return;
      
      setIsLoading(true);
      try {
        const tMinus2 = subDays(new Date(), 2);
        const [portfolios, priorities, latestSov, latestBA, allBaDates, allSovDates] = await Promise.all([
          fetchAllPortfoliosAction(),
          fetchActivePrioritiesAction(),
          fetchLatestSovDateAction(),
          fetchLatestBrandAnalyticsDateAction(tMinus2),
          fetchAvailableBrandAnalyticsDates(),
          fetchAvailableSovCrawlDates()
        ]);

        if (abortController.signal.aborted) return;

        setAllPortfolios(portfolios);
        setAvailablePriorities(priorities);
        setAvailableBrandAnalyticsDates(allBaDates);
        setAvailableSovDates(allSovDates);

        // FIXED: Proper date handling without unnecessary parsing
        if (latestBA) {
          // Just use the date directly, don't parse/format/parse again
          setBrandAnalyticsDate(startOfDay(latestBA));
        } else {
          setBrandAnalyticsDate(tMinus2);
        }

        // FIXED: Properly await timestamp fetching before setting SOV date
        if (latestSov) {
          setSovDate(latestSov);
          // Wait for timestamps to load before continuing
          await fetchTimestampsForDate(latestSov, abortController.signal);
        }

        const priorityOne = priorities.find(p => p.priority_name === 'Priority 1');
        if (priorityOne && !abortController.signal.aborted) {
          setSelectedPriority(priorityOne.priority_id);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          toast({
            title: "Filter Load Error",
            description: "Could not load initial filter data.",
            variant: "destructive",
          });
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialFilters();

    return () => {
      abortController.abort();
    };
  }, []);

  // FIXED: Add abort controller to loadData effect
  useEffect(() => {
    const abortController = new AbortController();
    loadData(abortController.signal);
    
    return () => {
      abortController.abort();
    };
  }, [loadData]);

  const handlePortfolioChange = async (portfolioId: string) => {
    const actualPortfolioId = portfolioId === ALL_FILTER_VALUE ? '' : portfolioId;
    setSelectedPortfolio(actualPortfolioId);
    setSelectedSubPortfolio(''); 
    if (actualPortfolioId) { 
      const subPortfolios = await fetchSubPortfoliosAction(actualPortfolioId); 
      setFilteredSubPortfolios(subPortfolios); 
    } else { 
      setFilteredSubPortfolios([]); 
    }
  };
  
  const handleSubPortfolioChange = (subPortfolioId: string) => { 
    const actualSubPortfolioId = subPortfolioId === ALL_FILTER_VALUE ? '' : subPortfolioId; 
    setSelectedSubPortfolio(actualSubPortfolioId); 
  };

  const handlePriorityChange = (priorityId: string) => { 
    const actualPriorityId = priorityId === ALL_FILTER_VALUE ? '' : priorityId; 
    setSelectedPriority(actualPriorityId); 
  };

  const handleLocationChange = (location: string) => { 
    setSelectedLocation(location); 
  };

  const subPortfolioSelect = (
    <Select onValueChange={handleSubPortfolioChange} value={selectedSubPortfolio || ALL_FILTER_VALUE} disabled={!selectedPortfolio}>
      <SelectTrigger className="w-auto min-w-[150px] max-w-xs" id="subportfolio-select">
        <SelectValue placeholder="Select Subportfolio" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_FILTER_VALUE}>All Subportfolios</SelectItem>
         {filteredSubPortfolios.length > 0 ? ( 
           filteredSubPortfolios.map(sp => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>) 
         ) : ( 
           <div className="text-center text-sm text-muted-foreground p-2">No options</div> 
         )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col min-h-0 relative space-y-4">
      <div className="flex items-end gap-3 justify-end flex-wrap">
        <div className="flex flex-col">
          <Label htmlFor="portfolio-select" className="text-xs font-medium text-muted-foreground mb-1">Portfolio</Label>
          <Select onValueChange={handlePortfolioChange} value={selectedPortfolio || ALL_FILTER_VALUE}>
            <SelectTrigger id="portfolio-select" className="w-auto min-w-[150px] max-w-xs">
              <SelectValue placeholder="All Portfolios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All Portfolios</SelectItem>
              {allPortfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="subportfolio-select" className="text-xs font-medium text-muted-foreground mb-1">Subportfolio</Label>
          <TooltipProvider>
            <Tooltip open={!selectedPortfolio ? undefined : false}>
              <TooltipTrigger asChild>
                <div className={cn(!selectedPortfolio && "cursor-not-allowed")} id="subportfolio-select-wrapper">
                  {subPortfolioSelect}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Select a Portfolio to view Subportfolios.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex flex-col">
            <Label htmlFor="priority-select" className="text-xs font-medium text-muted-foreground mb-1">Priority</Label>
            <Select onValueChange={handlePriorityChange} value={selectedPriority || ALL_FILTER_VALUE}>
                <SelectTrigger id="priority-select" className="w-auto min-w-[150px] max-w-xs">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All Priorities</SelectItem>
                  {availablePriorities.length > 0 ? ( 
                    availablePriorities.map(p => (
                      <SelectItem key={p.priority_id} value={p.priority_id}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{p.priority_name}</span>
                            </TooltipTrigger>
                            {p.priority_description && (
                              <TooltipContent>
                                <p>{p.priority_description}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </SelectItem>
                    )) 
                  ) : ( 
                    <div className="text-center text-sm text-muted-foreground p-2">Loading...</div> 
                  )}
                </SelectContent>
            </Select>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="location-select" className="text-xs font-medium text-muted-foreground mb-1">Location</Label>
          <Select onValueChange={handleLocationChange} value={selectedLocation}>
            <SelectTrigger id="location-select" className="w-auto min-w-[150px] max-w-xs">
              <SelectValue placeholder="Select Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uk">United Kingdom (UK)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-auto max-w-sm flex-grow">
          <Label htmlFor="table-search" className="text-xs font-medium text-muted-foreground mb-1">Search</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground mt-2" />
          <Input 
            id="table-search" 
            placeholder="Search table..." 
            onChange={(e) => debouncedSetGlobalFilter(e.target.value)} 
            className="pl-9"
          />
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground pr-1">
        <p>All times are shown in BST</p>
      </div>
      <BrandAnalyticsTable 
        data={tableData} 
        isLoading={isLoading} 
        globalFilter={globalFilter} 
        setGlobalFilter={setGlobalFilter} 
        sorting={sorting} 
        setSorting={setSorting}
        brandAnalyticsDate={brandAnalyticsDate}
        setBrandAnalyticsDate={setBrandAnalyticsDate}
        sovDate={sovDate}
        setSovDate={setSovDate}
        availableBrandAnalyticsDates={availableBrandAnalyticsDates}
        availableSovDates={availableSovDates}
        availableSovTimestamps={availableSovTimestamps}
        setAvailableSovTimestamps={setAvailableSovTimestamps}
        fetchTimestampsForDate={fetchTimestampsForDate}
       />
      <div className="text-left text-xs text-muted-foreground pl-1 mt-2">
        <p>Further columns can be added later.</p>
      </div>
    </div>
  );
}

export default function BrandAnalyticsPage() {
  return (
    <div className="p-2 md:p-3 h-screen flex flex-col">
        <h1 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
            <BarChart3 className="mr-3 h-7 w-7 text-primary" />
            Brand Analytics and SOV% Report
        </h1>
        <Suspense fallback={<div className="p-4 md:p-6 space-y-4 flex-1"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-[70vh] w-full" /></div>}>
            <BrandAnalyticsPageContent />
        </Suspense>
    </div>
  );
}