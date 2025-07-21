
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Product, MarketSetting, ManagerSetting } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Edit, Trash2, Users, AlertCircle, Package, Search, PlusCircle, TrendingUp, DollarSign, Percent, Tag, Building, Truck, CalendarCheck2 } from 'lucide-react';
// Removed: getDisplayCurrencySymbol from marketUtils as it's now handled per product
import { getMarketBadgeTailwindColor } from '@/lib/marketUtils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const columnHelper = createColumnHelper<Product & { initial_price?: number | null, deal_type?: string | null, buybox_seller?: string | null, ships_from?: string | null, delivery?: string[] | null }>();


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
}

const FROZEN_COLUMN_COUNT = 3;
const COLUMN_WIDTHS = [250, 130, 120]; // Corresponds to productInfo, asinCode, productCode

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

const calculateDiscountPercent = (listPrice?: number | null, finalPrice?: number | null): string => {
  if (typeof listPrice === 'number' && typeof finalPrice === 'number' && listPrice > 0 && finalPrice < listPrice && finalPrice > 0) {
    const discount = ((listPrice - finalPrice) / listPrice) * 100;
    return `${discount.toFixed(2)}%`; // Ensures 2 decimal places
  }
  return 'N/A';
};

const getFastestDeliveryText = (delivery?: string[] | null): string => {
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
  setSorting
}: ProductListProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const data = useMemo(() => products, [products]);

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
      cell: info => <p className="truncate text-xs text-muted-foreground" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
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
      header: () => <div className="text-right">Price</div>,
      cell: info => {
        const price = info.getValue();
        const currencySymbol = info.row.original.currency || '£';
        return (
          <div className="text-right text-sm">
            {currencySymbol}{(price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        );
      },
      enableSorting: true,
      size: 90,
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
    columnHelper.accessor('initial_price', {
      header: () => <div className="text-right">List Price</div>,
      cell: info => {
        const price = info.getValue();
        const currencySymbol = info.row.original.currency || '£';
        return (
          <div className="text-right text-sm">
            {price !== null && price !== undefined ? `${currencySymbol}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
          </div>
        );
      },
      enableSorting: true,
      size: 90,
    }),
    columnHelper.accessor(row => ({ initial: row.initial_price, current: row.price }), {
      id: 'discountPercentage',
      header: () => <div className="text-right">Discount %</div>,
      cell: info => {
        const { initial, current } = info.getValue();
        const discountStr = calculateDiscountPercent(initial, current);
        return (
          <div className="text-right">
            <Badge variant={discountStr !== 'N/A' ? 'destructive' : 'secondary'} className="text-xs">
              {discountStr}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
      size: 100,
    }),
    columnHelper.accessor('deal_type', {
      header: () => <span>Deal Type</span>,
      cell: info => {
        const dealType = info.getValue();
        return dealType ? <Badge variant="outline" className="text-xs truncate" title={dealType}>{dealType}</Badge> : <p className="text-xs text-muted-foreground truncate">N/A</p>;
      },
      enableSorting: true,
      size: 120,
    }),
    columnHelper.accessor('buybox_seller', {
      header: () => <span>Sold By</span>,
      cell: info => <p className="truncate text-sm text-muted-foreground" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 130,
    }),
    columnHelper.accessor('ships_from', {
      header: () => <span>Dispatched From</span>,
      cell: info => <p className="truncate text-sm text-muted-foreground" title={info.getValue() || "N/A"}>{info.getValue() || "N/A"}</p>,
      enableSorting: true,
      size: 130,
    }),
    columnHelper.accessor('delivery', {
      id: 'fastestDelivery',
      header: () => <span>Fastest Delivery</span>,
      cell: info => {
        const deliveryInfo = getFastestDeliveryText(info.getValue());
        return <p className="truncate text-sm text-muted-foreground" title={deliveryInfo}>{deliveryInfo}</p>;
      },
      enableSorting: true,
      size: 150,
    }),
    columnHelper.accessor(row => ({ rank: row.rootBsRank, category: row.rootBsCategory }), {
      id: 'rootBSR',
      header: () => <div className="text-right">Root BSR</div>,
      cell: info => {
        const { rank, category } = info.getValue();
        if (rank && category) {
          return <p className="truncate text-sm text-muted-foreground text-right" title={`#${rank.toLocaleString()} in ${category}`}>{`#${rank.toLocaleString()} - ${category}`}</p>;
        }
        return <p className="text-xs text-muted-foreground truncate text-right">N/A</p>;
      },
      enableSorting: true,
      size: 180,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: info => (
        <div className="flex items-center justify-end space-x-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAddCompetitor(info.row.original)} title="Add Competitors">
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditProduct(info.row.original)} title="Edit Product">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => onDeleteProduct(info.row.original.id)} title="Delete Product">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      size: 130,
    }),
  ], [onEditProduct, onDeleteProduct, onAddCompetitor, activeMarketSettings, activeManagerSettings]);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualSorting: true,
    debugTable: false,
  });

  if (isLoading) {
    return (
      <div className="border rounded-lg shadow-sm overflow-hidden bg-card">
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
                     i < FROZEN_COLUMN_COUNT && "sticky bg-card z-10",
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
    );
  }

  if (products.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 min-h-[300px] flex flex-col items-center justify-center bg-card rounded-lg border shadow-sm">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-xl font-semibold text-foreground">No products found.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adding products or adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search all columns..."
          value={globalFilter ?? ''}
          onChange={event => setGlobalFilter(event.target.value)}
          className="pl-8 w-full md:w-1/3"
        />
      </div>
      <div className="rounded-lg border shadow-sm bg-card">
        <ScrollArea className="w-full whitespace-nowrap rounded-md">
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
                          asc: ' \u2191',
                          desc: ' \u2193',
                        }[header.column.getIsSorted() as string] ?? null}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="group">
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
                          isFrozen ? "sticky bg-card group-hover:bg-muted/60 z-10" : "group-hover:bg-muted/50",
                          isFrozen && cellIdx === FROZEN_COLUMN_COUNT -1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        )}
                        style={{ ...leftPositionStyle, width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
            <TableCaption className="py-4 text-sm text-muted-foreground">
              Showing {table.getRowModel().rows.length} of {table.getRowCount()} product(s).
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}.
            </TableCaption>
          </Table>
          <ScrollBar orientation="horizontal" />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
