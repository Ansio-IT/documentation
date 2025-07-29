

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, MarketSetting, ManagerSetting } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';
import Image from 'next/image';
import Link from 'next/link';
import { Edit, Trash2, Users, AlertCircle, Package, Search, PlusCircle, TrendingUp, DollarSign, Percent, Tag, Building, Truck, CalendarCheck2, RefreshCw, UploadCloud, FilterX, BarChart3 } from 'lucide-react';
import { getMarketBadgeTailwindColor } from '@/lib/marketUtils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { getDeliveryInfo, calculateDiscountPercent } from '@/lib/productUtils';

const columnHelper = createColumnHelper<Product & { initial_price?: number | null, deal_type?: string | null, buybox_seller?: string | null, ships_from?: string | null, delivery?: string[] | null }>();

const ALL_MARKETS_SELECT_VALUE = "##ALL_MARKETS##";
const ALL_MANAGERS_SELECT_VALUE = "##ALL_MANAGERS##";

interface ProductListProps {
  products: Product[];
  isLoading: boolean;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAddCompetitor: (product: Product) => void;
  activeMarketSettings: MarketSetting[];
  activeManagerSettings: ManagerSetting[];
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  onSyncProducts: () => Promise<{ success: boolean; message: string; count?: number }>;
  onOpenUploadModal: () => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  filterMarketId: string;
  onFilterMarketIdChange: (marketId: string) => void;
  filterManagerId: string;
  onFilterManagerIdChange: (managerId: string) => void;
  filterMinPrice: string;
  onFilterMinPriceChange: (price: string) => void;
  filterMaxPrice: string;
  onFilterMaxPriceChange: (price: string) => void;
  filterAttention: 'all' | 'yes' | 'no';
  onFilterAttentionChange: (value: 'all' | 'yes' | 'no') => void;
  onResetFilters: () => void;
  lastSyncTime: string | null;
}

const FROZEN_COLUMN_COUNT = 3;
const COLUMN_WIDTHS = [250, 130, 120];

const constructProductPageUrl = (asinCode?: string | null, domain?: string | null): string => {
  if (!asinCode) return '#';
  let baseUrl = domain || 'www.amazon.com';
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/dp/${asinCode}`;
  } catch (e) {
    if (!baseUrl.includes('://') && baseUrl.includes('.')) {
        return `https://${baseUrl}/dp/${asinCode}`;
    }
    console.warn(`Invalid domain for ASIN link construction: ${domain}, falling back to amazon.com`);
    return `https://www.amazon.com/dp/${asinCode}`;
  }
};


export function ProductList({
  products,
  isLoading,
  onEditProduct,
  onDeleteProduct,
  onAddCompetitor,
  activeMarketSettings,
  activeManagerSettings,
  sorting,
  setSorting,
  onSyncProducts,
  onOpenUploadModal,
  searchTerm,
  onSearchTermChange,
  filterMarketId,
  onFilterMarketIdChange,
  filterManagerId,
  onFilterManagerIdChange,
  filterMinPrice,
  onFilterMinPriceChange,
  filterMaxPrice,
  onFilterMaxPriceChange,
  filterAttention,
  onFilterAttentionChange,
  onResetFilters,
  lastSyncTime
}: ProductListProps) {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const data = useMemo(() => products, [products]);

   const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncProducts();
    setIsSyncing(false);
  };
  
  const columns = useMemo<ColumnDef<Product & { initial_price?: number | null, deal_type?: string | null, buybox_seller?: string | null, ships_from?: string | null, delivery?: string[] | null }, any>[]>(() => [
    columnHelper.accessor(row => ({ name: row.name, imageUrl: row.imageUrl, id: row.id, attentionNeeded: row.attentionNeeded, dataAiHint: row.dataAiHint }), {
      id: 'productInfo',
      header: () => <span>Product</span>,
      cell: info => {
        const { name, imageUrl, id, attentionNeeded, dataAiHint } = info.getValue();
        const productDataAiHint = dataAiHint || name?.split(" ")[0]?.toLowerCase() || "product";
        return (
          <div className="flex items-center space-x-3">
            <Link href={`/product/${id}`} className="shrink-0">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={name || 'Product Image'}
                  width={48}
                  height={48}
                  className="rounded-md object-cover aspect-square border group-hover:opacity-80 transition-opacity"
                  data-ai-hint={productDataAiHint}
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center border shrink-0 group-hover:opacity-80 transition-opacity">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="flex-grow overflow-hidden">
              <Link href={`/product/${id}`} className="hover:underline">
                <span className="font-medium text-sm truncate block" title={name || "N/A"}>
                  {name || "N/A"}
                </span>
              </Link>
              {attentionNeeded && (
                <Badge variant="destructive" className="mt-1 text-xs py-0.5 px-1.5 flex items-center w-fit">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Attention
                </Badge>
              )}
            </div>
          </div>
        );
      },
      enableSorting: true,
      size: COLUMN_WIDTHS[0],
    }),
    columnHelper.accessor('asinCode', {
      header: () => <span>ASIN</span>,
      cell: info => {
        const asin = info.getValue();
        const marketDomain = info.row.original.marketDomainIdentifier;
        if (!asin) {
          return <p className="truncate text-xs text-muted-foreground" title="N/A">N/A</p>;
        }
        const productUrl = constructProductPageUrl(asin, marketDomain);
        return (
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline truncate text-xs"
            title="View on Amazon"
          >
            {asin}
          </a>
        );
      },
      enableSorting: true,
      size: COLUMN_WIDTHS[1],
    }),
    columnHelper.accessor('productCode', {
      header: () => <span>Product Code</span>,
      cell: info => {
        const productCode = info.getValue();
        if (!productCode) {
          return <p className="truncate text-xs text-muted-foreground" title="N/A">N/A</p>;
        }
        return (
          <Link href={`/depletion?q=${encodeURIComponent(productCode)}`} className="text-primary hover:underline text-xs truncate block" title={`View Depletion Report for ${productCode}`}>
            {productCode}
          </Link>
        );
      },
      enableSorting: true,
      size: COLUMN_WIDTHS[2],
    }),
    columnHelper.accessor('description', {
      header: () => <span>Description</span>,
      cell: info => <p className="truncate text-sm text-muted-foreground max-w-[200px]" title={info.getValue() || "-"}>{info.getValue() || "-"}</p>,
      enableSorting: true,
      size: 200,
    }),
    columnHelper.accessor('price', {
      header: () => <div className="text-right">Current<br />Price</div>,
      cell: info => {
        const price = info.getValue();
        if (price === null || price === undefined) {
          return <div className="text-right text-sm">N/A</div>;
        }
        const currencySymbol = info.row.original.currency || '£';
        return (
          <div className="text-right text-sm">
            {currencySymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        );
      },
      enableSorting: true,
      size: 100,
    }),
    columnHelper.accessor('listPrice', {
      header: () => <div className="text-right">List Price</div>,
      cell: info => {
        const price = info.getValue();
        if (price === null || price === undefined) {
          return <div className="text-right text-sm">N/A</div>;
        }
        const currencySymbol = info.row.original.currency || '£';
        return (
          <div className="text-right text-sm">
            {currencySymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        );
      },
      enableSorting: true,
      size: 90,
    }),
    columnHelper.accessor(row => ({ initial: row.listPrice, current: row.price }), {
      id: 'discountPercentage',
      header: () => <div className="text-right">Discount %</div>,
      cell: info => {
        const { initial, current } = info.getValue();
        const discountInfo = calculateDiscountPercent(initial, current);
        return (
          <div className="text-right">
            <Badge variant={discountInfo.value != null && discountInfo.value > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {discountInfo.display}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
      size: 100,
    }),
    columnHelper.accessor('dealType', {
      header: () => <span>Deal Type</span>,
      cell: info => {
        const dealType = info.getValue();
        return dealType ? <Badge variant="outline" className="text-xs truncate" title={dealType}>{dealType}</Badge> : <p className="text-xs text-muted-foreground truncate">N/A</p>;
      },
      enableSorting: true,
      size: 120,
    }),
    columnHelper.accessor('soldBy', {
      header: () => <span>Sold By</span>,
      cell: info => <p className="truncate text-sm text-muted-foreground" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 130,
    }),
    columnHelper.accessor('dispatchedFrom', {
      header: () => <span>Dispatched From</span>,
      cell: info => <p className="truncate text-sm text-muted-foreground" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 130,
    }),
    columnHelper.accessor('deliveryInfo', {
      id: 'rawDeliveryInfo',
      header: () => <span>Delivery Info</span>,
      cell: info => {
        const deliveryArr = info.row.original.deliveryInfo;
        const displayInfo = getDeliveryInfo(deliveryArr ? [deliveryArr] : []);
        return <p className="truncate text-sm text-muted-foreground" title={displayInfo.rawString}>{displayInfo.rawString}</p>;
      },
      enableSorting: false,
      size: 200,
    }),
    columnHelper.accessor(row => getDeliveryInfo(row.deliveryInfo ? [row.deliveryInfo] : []).parsedDate, {
      id: 'deliveryDate',
      header: () => <span>Delivery Date</span>,
      cell: info => {
        const parsedDate = info.getValue();
        const displayInfo = getDeliveryInfo(info.row.original.deliveryInfo ? [info.row.original.deliveryInfo] : []);
        return <p className="text-sm">{displayInfo.displayDate}</p>;
      },
      enableSorting: true,
      sortingFn: 'datetime',
      size: 120,
    }),
    columnHelper.accessor(row => row.categoryRanks, {
      id: 'rootBSR',
      header: () => <div className="text-right">Root BSR</div>,
      cell: info => {
        const categoryRanks = info.getValue();
        if (
          !categoryRanks ||
          typeof categoryRanks !== 'object' ||
          !categoryRanks.root_bs_rank ||
          !categoryRanks.root_bs_category
        ) {
          return <p className="text-xs text-muted-foreground truncate text-right">N/A</p>;
        }
        const item = `#${categoryRanks.root_bs_rank.toLocaleString()} - ${categoryRanks.root_bs_category}`;
        return (
          <span className="truncate text-sm text-muted-foreground text-right" title={item}>{item}</span>
        );
      },
      enableSorting: true,
      size: 180,
    }),
    columnHelper.accessor('portfolioName', {
      header: () => <span>Portfolio</span>,
      cell: info => <p className="truncate text-sm" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 120,
    }),
    columnHelper.accessor('subPortfolioName', {
      header: () => <span>Subportfolio</span>,
      cell: info => <p className="truncate text-sm" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 120,
    }),
    columnHelper.accessor('market', {
      header: () => <div className="text-center">Market</div>,
      cell: info => {
        const marketName = info.getValue();
        const badgeColorClass = getMarketBadgeTailwindColor(marketName);
        return (
          <div className="text-center">
            <Badge variant="default" className={`text-xs ${badgeColorClass}`}>
              {marketName || 'N/A'}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
      size: 100,
    }),
    columnHelper.accessor('primaryListingManagerName', {
      header: () => <span>Manager</span>,
      cell: info => <p className="truncate text-sm" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 120,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-end space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/keyword-sov-report?asin=${info.row.original.asinCode}`)} disabled={!info.row.original.asinCode}>
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyword &amp; SOV% Report</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAddCompetitor(info.row.original)}>
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Competitors</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditProduct(info.row.original)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Update Product</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => onDeleteProduct(info.row.original.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Product</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      size: 160,
    }),
  ], [onEditProduct, onDeleteProduct, onAddCompetitor, activeMarketSettings, activeManagerSettings, router]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualFiltering: true,
    manualSorting: true,
    debugTable: false,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex justify-end mb-4">
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="bg-card border-b border-border shadow-sm py-3 -mx-4 px-4">
          <div className="flex flex-wrap items-end gap-3">
            {Array.from({length: 6}).map((_,i) => <Skeleton key={i} className="h-10 flex-grow min-w-[120px]" />)}
          </div>
        </div>
        <div className="flex-1 border rounded-lg shadow-sm overflow-hidden bg-card">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns.length }).map((_, i) => (
                <TableHead key={i} className={cn(
                  "p-2 sticky top-0 z-20 bg-card",
                  i < FROZEN_COLUMN_COUNT && `left-[${i === 0 ? 0 : i === 1 ? COLUMN_WIDTHS[0] : COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]}px]`,
                  i === 0 && "z-30",
                  i === FROZEN_COLUMN_COUNT - 1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                )}>
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {Array.from({ length: columns.length }).map((_, i) => (
                  <TableCell key={i} className={cn(
                    "p-2 align-top",
                     i < FROZEN_COLUMN_COUNT && "sticky bg-transparent z-10",
                     i === 0 && "left-0",
                     i === 1 && `left-[${COLUMN_WIDTHS[0]}px]`,
                     i === 2 && `left-[${COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]}px]`,
                     i === FROZEN_COLUMN_COUNT - 1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                  )}>
                    {i === 0 ? (
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                        <div className="flex-grow space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ) : (
                      <Skeleton className="h-4 w-20" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col flex-1 p-4 space-y-4 overflow-hidden">
      {/* Action Buttons Bar (Top Right) */}
      <div className="flex justify-end mb-2 space-x-2 items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onOpenUploadModal} variant="outline" size="icon">
                <UploadCloud className="h-4 w-4" />
                <span className="sr-only">Upload Excel</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Upload Excel Sheets</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border-b border-border shadow-sm py-3 -mx-4 px-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 justify-between">
          {/* Filters Group (Left and Center) */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2 flex-grow">
            {/* Search Input */}
            <div className="relative flex-grow min-w-[200px] sm:min-w-[250px]">
              <Label htmlFor="search-products" className="text-xs font-medium text-muted-foreground">Search</Label>
              <Search className="absolute left-2.5 top-8 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-products"
                type="search"
                placeholder="Title, Product Code, ASIN..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="pl-8 w-full mt-1"
              />
            </div>
            {/* Market Filter */}
            <div className="flex-grow min-w-[120px]">
              <Label htmlFor="filter-market" className="text-xs font-medium text-muted-foreground">Market</Label>
              <Select value={filterMarketId || ALL_MARKETS_SELECT_VALUE} onValueChange={onFilterMarketIdChange}>
                <SelectTrigger id="filter-market" className="w-full mt-1">
                  <SelectValue placeholder="All Markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MARKETS_SELECT_VALUE}>All Markets</SelectItem>
                  {activeMarketSettings.map(market => (
                    <SelectItem key={market.id} value={market.id}>{market.marketName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Manager Filter */}
            <div className="flex-grow min-w-[120px]">
              <Label htmlFor="filter-manager" className="text-xs font-medium text-muted-foreground">Manager</Label>
              <Select value={filterManagerId || ALL_MANAGERS_SELECT_VALUE} onValueChange={onFilterManagerIdChange}>
                <SelectTrigger id="filter-manager" className="w-full mt-1">
                  <SelectValue placeholder="All Managers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_MANAGERS_SELECT_VALUE}>All Managers</SelectItem>
                  {activeManagerSettings.map(manager => (
                    <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Price Filters */}
            <div className="flex gap-2 flex-grow min-w-[180px]">
              <div className="flex-1">
                <Label htmlFor="filter-min-price" className="text-xs font-medium text-muted-foreground">Min Price</Label>
                <Input
                  id="filter-min-price"
                  type="number"
                  placeholder="Min"
                  value={filterMinPrice}
                  onChange={(e) => onFilterMinPriceChange(e.target.value)}
                  className="w-full mt-1"
                  min="0"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="filter-max-price" className="text-xs font-medium text-muted-foreground">Max Price</Label>
                <Input
                  id="filter-max-price"
                  type="number"
                  placeholder="Max"
                  value={filterMaxPrice}
                  onChange={(e) => onFilterMaxPriceChange(e.target.value)}
                  className="w-full mt-1"
                  min="0"
                />
              </div>
            </div>
            {/* Attention Needed Filter */}
            <div className="flex-grow min-w-[120px]">
                <Label htmlFor="filter-attention" className="text-xs font-medium text-muted-foreground">Attention Needed</Label>
                <Select value={filterAttention} onValueChange={(value) => onFilterAttentionChange(value as 'all' | 'yes' | 'no')}>
                  <SelectTrigger id="filter-attention" className="w-full mt-1">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            {/* Reset Button (aligned with filters) */}
            <div className="flex-shrink-0">
                <Label htmlFor="reset-filters-button" className="text-xs font-medium text-muted-foreground invisible">Reset</Label> {/* Invisible label for alignment */}
                <TooltipProvider>
                    <Tooltip>
                    <TooltipTrigger asChild>
                        <Button id="reset-filters-button" onClick={onResetFilters} variant="outline" size="icon" className="shrink-0 h-10 w-10 mt-1">
                        <FilterX className="h-4 w-4" />
                        <span className="sr-only">Reset Filters</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reset Filters</p>
                    </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 rounded-lg border shadow-sm bg-card overflow-hidden min-h-0">
        <ScrollArea className="h-full w-full">
          <Table className="table-fixed w-full min-w-[1800px]">
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header, headerIdx) => {
                    const isFrozen = headerIdx < FROZEN_COLUMN_COUNT;
                    let leftPositionStyle = {};
                    if (isFrozen) {
                      if (headerIdx === 0) leftPositionStyle = { left: 0 };
                      else if (headerIdx === 1) leftPositionStyle = { left: `${COLUMN_WIDTHS[0]}px` };
                      else if (headerIdx === 2) leftPositionStyle = { left: `${COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]}px` };
                    }
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "p-2 sticky top-0 bg-card",
                          header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                          isFrozen ? 'z-30' : 'z-20',
                          isFrozen && headerIdx === FROZEN_COLUMN_COUNT -1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        )}
                        style={{ ...leftPositionStyle, width: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? null}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {products.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      <div className="text-center py-12 min-h-[200px] flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-lg font-semibold text-foreground">No products found.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try adjusting your filters or adding new products.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(
                        "group",
                        row.index % 2 === 0 ? "bg-slate-100 dark:bg-slate-800" : "bg-card"
                      )}
                    >
                      {row.getVisibleCells().map((cell, cellIdx) => {
                        const isFrozen = cellIdx < FROZEN_COLUMN_COUNT;
                        let leftPositionStyle = {};
                         if (isFrozen) {
                          if (cellIdx === 0) leftPositionStyle = { left: 0 };
                          else if (cellIdx === 1) leftPositionStyle = { left: `${COLUMN_WIDTHS[0]}px` };
                          else if (cellIdx === 2) leftPositionStyle = { left: `${COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1]}px` };
                        }
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "p-2 align-top",
                               isFrozen ? "sticky bg-transparent z-10" : "group-hover:bg-muted/50",
                               isFrozen && (row.index % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-card'),
                               isFrozen && 'group-hover:bg-muted',
                               isFrozen && cellIdx === FROZEN_COLUMN_COUNT -1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                            )}
                            style={{ ...leftPositionStyle, width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )
              }
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" className="h-2 p-0" />
        </ScrollArea>
      </div>

      {/* Pagination Section */}
      <div className="flex items-center justify-end space-x-6 py-4">
          <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                      table.setPageSize(Number(value));
                  }}
              >
                  <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                      {[10, 20, 50, 100].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
              >
                  Previous
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
              >
                  Next
              </Button>
          </div>
      </div>
    </div>
  );
}



