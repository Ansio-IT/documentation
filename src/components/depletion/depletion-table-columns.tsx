
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO, isValid } from 'date-fns';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FullDepletionReportEntry } from '@/lib/types';

export const depletionColumns: ColumnDef<FullDepletionReportEntry>[] = [
  {
    accessorKey: 'forecastDate',
    header: 'Date',
    cell: ({ row }) => {
      const date = parseISO(row.original.forecastDate);
      const isWeekend = row.original.isWeekend;
      return (
        <div className={cn("font-medium", isWeekend && "text-amber-700 font-semibold")}>
          {isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date'}
        </div>
      );
    },
  },
  {
    accessorKey: 'dayName',
    header: 'Day',
    cell: ({ row }) => {
       const isWeekend = row.original.isWeekend;
       return <div className={cn(isWeekend && "text-amber-700 font-semibold")}>{row.original.dayName}</div>
    }
  },
  {
    accessorKey: 'remainingStock',
    header: () => <div className="text-right">Remaining Stock</div>,
    cell: ({ row }) => {
      const amount = row.original.remainingStock;
      const formatted = amount !== null && amount !== undefined ? amount.toLocaleString() : 'N/A';
      return <div className="text-right font-mono">{formatted}</div>;
    },
  },
  {
    accessorKey: 'dailyForecast',
    header: () => <div className="text-right">Daily Forecast</div>,
    cell: ({ row }) => {
      const amount = row.original.dailyForecast;
      const formatted = amount !== null && amount !== undefined ? amount.toLocaleString() : 'N/A';
      return <div className="text-right font-mono text-muted-foreground">{formatted}</div>;
    },
  },
  {
    accessorKey: 'statusFlag',
    header: 'Status',
    cell: ({ row }) => {
        const status = row.original.statusFlag;
        if (!status) return null;
        
        const isAlert = status.includes('Alert');
        const isOrder = status.includes('Order');
        
        return (
             <Badge variant={isOrder ? "destructive" : isAlert ? "default" : "secondary"} className={cn(isAlert && !isOrder && "bg-amber-500 text-amber-50")}>
                {status}
            </Badge>
        );
    }
  }
];
