// Renders the marketing data table and pagination controls
import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { RefreshCw } from 'lucide-react';
import { flexRender, Table as ReactTable } from '@tanstack/react-table';

interface MarketingTableProps {
  table: ReactTable<any>;
  columns: any[];
  data: any[];
  isLoadingReport: boolean;
  totalDBRowCount: number;
  pageInput: string;
  setPageInput: (v: string) => void;
  handlePageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  pageCount: number;
}

const MarketingTable: React.FC<MarketingTableProps> = ({
  table,
  columns,
  data,
  isLoadingReport,
  totalDBRowCount,
  pageInput,
  setPageInput,
  handlePageInputKeyDown,
  pageCount,
}) => (
  <div className="mt-6 border rounded-lg shadow-sm bg-card">
    <ScrollArea className="w-full rounded-md border max-h-[70vh] bg-card">
      <Table className="min-w-[3000px]">
        <TableCaption className="mt-2 text-sm text-muted-foreground sticky bottom-0 bg-card py-2">
          {isLoadingReport && (!data || data.length === 0) ? (
            "Loading marketing data report..."
          ) : !isLoadingReport && data && data.length === 0 ? (
            "No matching records found for the selected filters."
          ) : !isLoadingReport && (!data || data.length === 0) ? (
            "No marketing data found. Upload a file to see the report."
          ) : (
            <>
              Showing {table.getRowModel().rows?.length ?? 0} of {totalDBRowCount ?? 0} entries.
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </>
          )}
        </TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  className="py-2 px-3 whitespace-nowrap sticky top-0 bg-card z-10"
                  style={{ width: header.getSize() }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  {{
                    asc: ' 🔼',
                    desc: ' 🔽',
                  }[header.column.getIsSorted() as string] ?? null}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoadingReport && (!data || data.length === 0) ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap">
                <div className="flex justify-center items-center">
                  <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mr-2" />
                  Loading marketing data report...
                </div>
              </TableCell>
            </TableRow>
          ) : !isLoadingReport && data && data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap">
                No matching records found for the selected filters.
              </TableCell>
            </TableRow>
          ) : !isLoadingReport && (!data || data.length === 0) ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap">
                No marketing data found. Upload a file to see the report.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className="py-2 px-3 whitespace-nowrap"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" className="h-3 [&>div]:bg-neutral-400 dark:[&>div]:bg-neutral-700 [&>div]:rounded-none" />
      <ScrollBar orientation="vertical" className="w-3 [&>div]:bg-neutral-400 dark:[&>div]:bg-neutral-700 [&>div]:rounded-none" />
    </ScrollArea>
    {pageCount > 0 && (
      <div className="flex items-center justify-end space-x-2 py-4 px-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <div className="flex items-center space-x-1">
          <span className="text-sm text-muted-foreground">Page</span>
          <Input
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            className="h-8 w-16 text-center"
            min="1"
            max={table.getPageCount()}
          />
          <span className="text-sm text-muted-foreground">of {table.getPageCount()}</span>
        </div>
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

export default MarketingTable;
