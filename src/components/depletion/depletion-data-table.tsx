
"use client";

import React from 'react';
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';
import type { FullDepletionReportEntry } from '@/lib/types';

interface DepletionDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading: boolean;
  totalCount: number;
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
}

export function DepletionDataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  totalCount,
  sorting,
  setSorting,
}: DepletionDataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true,
  });
  
  return (
    <div className="rounded-md border bg-card shadow-sm h-full flex flex-col">
      <ScrollArea className="w-full flex-grow">
        <Table>
          <TableCaption className="py-2 text-xs">
            {isLoading && data.length === 0 ? "Loading depletion data..." : 
             !isLoading && data.length === 0 ? "No depletion data found for the current filters." :
             `Displaying forecast for ${totalCount} dates.`}
          </TableCaption>
          <TableHeader className="sticky top-0 bg-card z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "p-2",
                        header.column.getCanSort() && "cursor-pointer select-none"
                      )}
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
            {isLoading && data.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`skeleton-row-${i}`}>
                        {Array.from({ length: columns.length }).map((_, j) => (
                            <TableCell key={`skeleton-cell-${i}-${j}`} className="p-2">
                                <Skeleton className="h-6 w-full" />
                            </TableCell>
                        ))}
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => {
                const originalData = row.original as FullDepletionReportEntry;
                const isWeekend = originalData.isWeekend;
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(isWeekend && "bg-amber-50 dark:bg-amber-900/10")}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="p-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                   <div className="text-center py-12 min-h-[200px] flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-lg font-semibold text-foreground">No Data Found.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Try searching for a different product or check the configuration.
                        </p>
                    </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
