
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { MarketingDataEntry, FetchMarketingDataParams, DateRange as CustomDateRange, ProductListingUploadSummary, ProductListingUploadError } from '@/lib/types';
import {
  fetchMarketingData,
  fetchDistinctMarketingOwners,
  fetchDistinctMarketingPortfolios
} from '@/app/actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, RefreshCw, Search, CalendarIcon, XIcon, FileSpreadsheet, ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isValid as isValidDateFn, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MarketingUploadModal } from '@/components/marketing-upload-modal';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { downloadErrorCSV } from '@/lib/uploadErrorUtils';


const formatDateForDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString); // Directly parse ISO string (YYYY-MM-DD)
    if (isValidDateFn(date)) return format(date, 'MMM do, yyyy');
  } catch (e) { /* ignore if parseISO fails, fallback below */ }
  
  // Fallback for potentially non-ISO string dates (though DB should store consistently)
  try {
      const date = new Date(dateString);
      if (isValidDateFn(date)) return format(date, 'MMM do, yyyy');
  } catch (e) { /* ignore */ }

  return dateString; // Return original string if all parsing fails
};


const formatNumberForDisplay = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || String(value).trim() === '' || isNaN(Number(value))) return 'N/A';
  const num = Number(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCurrency = (value: number | null | undefined, symbol = '£'): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return `${symbol}N/A`;
  return `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A%';
  // Value is already a percentage, e.g., 13.11 for 13.11%
  return `${Number(value).toFixed(2)}%`;
};

const numericFields: (keyof MarketingDataEntry)[] = [
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalSalesRevenueExVatSp',
  'totalAdvSpend', 'totalAdvSales', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold',
  'marketingPercent', 'acosPercent', 'zeroAdvProfitSc', 'zeroAdvProfitVc',
  'totalZeroAdvGrossProfit', 'totalGp', 'gpPercent', 'fbaStock', 'bwwActualStock',
  'vcStock', 'totalStock', 'moh'
];

const toSnakeCaseForSort = (clientSortId: string): string => {
  const mappings: Record<string, string> = {
    productCode: 'product_code', productDescription: 'product_description', subPortfolio: 'sub_portfolio',
    totalQtySold: 'total_qty_sold', totalAdvUnitsSold: 'total_adv_units_sold', totalRevenueExVatCp: 'total_revenue_ex_vat_cp',
    totalSalesRevenueExVatSp: 'total_sales_revenue_ex_vat_sp', totalAdvSpend: 'total_adv_spend', totalAdvSales: 'total_adv_sales',
    perUnitAdvSpendOnTotalQtySold: 'per_unit_adv_spend_on_total_qty_sold', perUnitAdvSpendOnAdvQtySold: 'per_unit_adv_spend_on_adv_qty_sold',
    marketingPercent: 'marketing_percent', acosPercent: 'acos_percent', zeroAdvProfitSc: 'zero_adv_profit_sc',
    zeroAdvProfitVc: 'zero_adv_profit_vc', totalZeroAdvGrossProfit: 'total_zero_adv_gross_profit', totalGp: 'total_gp',
    gpPercent: 'gp_percent', fbaStock: 'fba_stock', bwwActualStock: 'bww_actual_stock', vcStock: 'vc_stock',
    totalStock: 'total_stock', advMarketplace: 'adv_marketplace', createdAt: 'created_at'
    // date, asin, person, portfolio, moh are same in camel and snake
  };
  return mappings[clientSortId] || clientSortId;
};


const columnHelper = createColumnHelper<MarketingDataEntry>();

const getAmazonBaseUrl = (marketplace?: string | null): string => {
  // Simplified: always return .co.uk for this context or make it configurable
  return 'https://www.amazon.co.uk';
};

const formatMultiLineHeader = (text: string): JSX.Element => {
  const words = text.split(' ');
  if (words.length > 2) {
    let line1 = words.slice(0, 2).join(' ');
    let line2 = words.slice(2).join(' ');

    if (text === 'Total Qty Sold (SC + VC)') { line1 = 'Total Qty'; line2 = 'Sold (SC + VC)';}
    else if (text === 'Total Adv Units Sold') { line1 = 'Total Adv'; line2 = 'Units Sold'; }
    else if (text === 'Total Revenue Ex VAT (CP)') { line1 = 'Total Revenue'; line2 = 'Ex VAT (CP)'; }
    else if (text === 'Total Sales Revenue Ex VAT (SP)') { line1 = 'Total Sales'; line2 = 'Revenue Ex VAT (SP)'; }
    else if (text === 'Total Adv Spend') { line1 = 'Total Adv'; line2 = 'Spend'; }
    else if (text === 'Total Adv Sales') { line1 = 'Total Adv'; line2 = 'Sales'; }
    else if (text === 'per unit Adv Spend on Total Qty Sold') { line1 = 'per unit Adv Spend'; line2 = 'on Total Qty Sold'; }
    else if (text === 'per unit Adv Spend on Adv Qty Sold') { line1 = 'per unit Adv Spend'; line2 = 'on Adv Qty Sold'; }
    else if (text === 'Zero Adv Profit SC') { line1 = 'Zero Adv'; line2 = 'Profit SC'; }
    else if (text === 'Zero Adv Profit VC') { line1 = 'Zero Adv'; line2 = 'Profit VC'; }
    else if (text === 'Total (SC + VC) Zero Adv Gross Profit') { line1 = 'Total (SC + VC)'; line2 = 'Zero Adv Gross Profit'; }
    else if (text === 'BWW Actual Stock') { line1 = 'BWW Actual'; line2 = 'Stock'; }
    
    return <>{line1}<br />{line2}</>;
  }
  return <>{text}</>;
};


const initialColumnsDefinition: ColumnDef<MarketingDataEntry, any>[] = [
  { accessorKey: 'date', header: 'DATE', size: 90, cell: info => formatDateForDisplay(info.getValue()), enableSorting: true },
  {
    accessorKey: 'asin',
    header: 'ASIN',
    size: 100,
    cell: info => {
      const asinValue = info.getValue();
      if (!asinValue) return <span className="block truncate" title="N/A">N/A</span>;
      const marketplace = info.row.original.advMarketplace;
      const baseUrl = getAmazonBaseUrl(marketplace);
      const amazonUrl = `${baseUrl}/dp/${asinValue}`;
      return (
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-primary hover:underline"
          title={`View ${asinValue} on Amazon UK`}
        >
          {asinValue}
        </a>
      );
    },
    enableSorting: true
  },
  { accessorKey: 'productCode', header: 'Product Code', size: 90, cell: info => {
      const productCodeValue = info.getValue();
      if (!productCodeValue) return <span className="block truncate" title="N/A">N/A</span>;
      return (
        <Link href={`/settings/advertisement-details/product/${productCodeValue}`} className="block truncate text-primary hover:underline" title={`View details for ${productCodeValue}`}>
          {productCodeValue}
        </Link>
      );
    }, enableSorting: true },
  {
    accessorKey: 'productDescription',
    header: 'Product Description',
    size: 150,
    cell: info => {
      const strVal = String(info.getValue() ?? '');
      const truncatedVal = strVal.length > 25 ? strVal.substring(0, 25) + "..." : strVal;
      return <span className="block truncate" title={strVal}>{truncatedVal}</span>;
    },
    enableSorting: true
  },
  { accessorKey: 'person', header: 'Person', size: 80, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
  { accessorKey: 'portfolio', header: 'Portfolio', size: 80, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
  { accessorKey: 'subPortfolio', header: 'Sub Portfolio', size: 80, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
  { accessorKey: 'totalQtySold', header: () => formatMultiLineHeader('Total Qty Sold (SC + VC)'), size: 100, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalAdvUnitsSold', header: () => formatMultiLineHeader('Total Adv Units Sold'), size: 80, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  {
    accessorKey: 'totalRevenueExVatCp',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalRevenueExVatCp) || 0), 0);
      return (<div className="text-right"><div className="font-medium">{formatMultiLineHeader('Total Revenue Ex VAT (CP)')}</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, 
    cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalSalesRevenueExVatSp',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalSalesRevenueExVatSp) || 0), 0);
      return (<div className="text-right"><div className="font-medium">{formatMultiLineHeader('Total Sales Revenue Ex VAT (SP)')}</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, 
    cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalAdvSpend',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalAdvSpend) || 0), 0);
      return (<div className="text-right"><div className="font-medium">{formatMultiLineHeader('Total Adv Spend')}</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalAdvSales',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalAdvSales) || 0), 0);
      return (<div className="text-right"><div className="font-medium">{formatMultiLineHeader('Total Adv Sales')}</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'perUnitAdvSpendOnTotalQtySold', header: () => formatMultiLineHeader('per unit Adv Spend on Total Qty Sold'), size: 90, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'perUnitAdvSpendOnAdvQtySold', header: () => formatMultiLineHeader('per unit Adv Spend on Adv Qty Sold'), size: 90, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  {
    accessorKey: 'marketingPercent',
    header: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const totalAdvSpend = rows.reduce((sum, row) => sum + (Number(row.original.totalAdvSpend) || 0), 0);
      const totalSalesRevenue = rows.reduce((sum, row) => sum + (Number(row.original.totalSalesRevenueExVatSp) || 0), 0);
      const percentage = totalSalesRevenue !== 0 ? (totalAdvSpend / totalSalesRevenue) * 100 : 0;
      return (<div className="text-right"><div className="font-medium">Marketing%</div><div className="text-xs font-semibold text-primary">{formatPercentage(percentage)}</div></div>);
    },
    size: 80, cell: info => <span className="block text-right">{formatPercentage(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'acosPercent',
    header: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const totalAdvSpend = rows.reduce((sum, row) => sum + (Number(row.original.totalAdvSpend) || 0), 0);
      const totalAdvSales = rows.reduce((sum, row) => sum + (Number(row.original.totalAdvSales) || 0), 0);
      const percentage = totalAdvSales !== 0 ? (totalAdvSpend / totalAdvSales) * 100 : 0;
      return (<div className="text-right"><div className="font-medium">ACOS%</div><div className="text-xs font-semibold text-primary">{formatPercentage(percentage)}</div></div>);
    },
    size: 80, cell: info => <span className="block text-right">{formatPercentage(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'zeroAdvProfitSc', header: () => formatMultiLineHeader('Zero Adv Profit SC'), size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'zeroAdvProfitVc', header: () => formatMultiLineHeader('Zero Adv Profit VC'), size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalZeroAdvGrossProfit', header: () => formatMultiLineHeader('Total (SC + VC) Zero Adv Gross Profit'), size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  {
    accessorKey: 'totalGp',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalGp) || 0), 0);
      return (<div className="text-right"><div className="font-medium">Total GP</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'gpPercent',
    header: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const totalGp = rows.reduce((sum, row) => sum + (Number(row.original.totalGp) || 0), 0);
      const totalRevenue = rows.reduce((sum, row) => sum + (Number(row.original.totalRevenueExVatCp) || 0), 0);
      const percentage = totalRevenue !== 0 ? (totalGp / totalRevenue) * 100 : 0;
      return (<div className="text-right"><div className="font-medium">GP%</div><div className="text-xs font-semibold text-primary">{formatPercentage(percentage)}</div></div>);
    },
    size: 80, cell: info => <span className="block text-right">{formatPercentage(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'fbaStock', header: 'FBA Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'bwwActualStock', header: () => formatMultiLineHeader('BWW Actual Stock'), size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'vcStock', header: 'VC Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalStock', header: 'Total Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'moh', header: 'MOH', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'advMarketplace', header: 'Adv Marketplace', size: 90, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
].map(colDef => {
    const key = (colDef as any).accessorKey as keyof MarketingDataEntry;
    if (numericFields.includes(key) && typeof colDef.header === 'string' && !colDef.header.includes('<br />') && typeof colDef.header !== 'function') {
        return {
            ...colDef,
            header: () => <div className="text-right w-full">{formatMultiLineHeader(colDef.header as string)}</div>,
            enableSorting: true,
        };
    }
     if (typeof colDef.header === 'string' && !colDef.header.includes('<br />') && typeof colDef.header !== 'function' && (colDef.header.includes('%') || colDef.header.toLowerCase().includes('price') || colDef.header.toLowerCase().includes('revenue') || colDef.header.toLowerCase().includes('spend') || colDef.header.toLowerCase().includes('profit') || colDef.header.toLowerCase().includes('gp') || colDef.header.toLowerCase().includes('qty') || colDef.header.toLowerCase().includes('units') || colDef.header.toLowerCase().includes('stock') || colDef.header.toLowerCase().includes('moh') ) ) {
         return {
            ...colDef,
            header: () => <div className="text-right w-full">{formatMultiLineHeader(colDef.header as string)}</div>,
            enableSorting: true,
        };
    }
    if (typeof colDef.header === 'string' && !colDef.header.includes('<br />') && typeof colDef.header !== 'function') {
        return { ...colDef, header: () => formatMultiLineHeader(colDef.header as string), enableSorting: true };
    }
    return { ...colDef, enableSorting: true };
});

const standardViewColumnAccessors: (keyof MarketingDataEntry)[] = [
  'date', 'asin', 'productCode', 'productDescription', 'person', 'portfolio', 'subPortfolio',
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalAdvSpend', 'totalAdvSales',
  'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent'
];

const DEFAULT_FROZEN_COLUMN_COUNT = 3;

export default function AdvertisementDetailsPage() {
  const [data, setData] = useState<MarketingDataEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [totalDBRowCount, setTotalDBRowCount] = useState(0);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const { toast } = useToast();

  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('last30days');
  const [dateRange, setDateRange] = useState<CustomDateRange | undefined>(undefined);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string | undefined>(undefined);
  const [availablePortfolios, setAvailablePortfolios] = useState<string[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | undefined>(undefined);
  const [currentView, setCurrentView] = useState<'standard' | 'all'>('standard');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  const [pageInput, setPageInput] = useState<string>(String(pageIndex + 1));
  const [isMarketingUploadModalOpen, setIsMarketingUploadModalOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<ProductListingUploadSummary | null>(null);
  const [frozenColumnCount, setFrozenColumnCount] = useState(DEFAULT_FROZEN_COLUMN_COUNT);


  const loadMarketingData = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const params: FetchMarketingDataParams = {
        pageIndex,
        pageSize,
        sorting: sorting.map(s => ({ ...s, id: toSnakeCaseForSort(s.id) })),
        globalFilter,
        selectedDatePreset,
        customDateRange: selectedDatePreset === 'custom' ? dateRange : undefined,
        selectedOwner,
        selectedPortfolio,
      };
      const result = await fetchMarketingData(params);
      setData(result.data || []);
      setPageCount(result.pageCount || 0);
      setTotalDBRowCount(result.totalCount || 0);
    } catch (error) {
      console.error("Error loading marketing data:", error);
      toast({ title: "Error", description: `Failed to load marketing data: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
      setData([]);
      setPageCount(0);
      setTotalDBRowCount(0);
    } finally {
      setIsLoadingReport(false);
    }
  }, [pageIndex, pageSize, sorting, globalFilter, selectedDatePreset, dateRange, selectedOwner, selectedPortfolio, toast]);


  useEffect(() => {
    loadMarketingData();
  }, [loadMarketingData]);

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [ownersRes, portfoliosRes] = await Promise.all([
          fetchDistinctMarketingOwners(),
          fetchDistinctMarketingPortfolios()
        ]);
        setAvailableOwners(ownersRes || []);
        setAvailablePortfolios(portfoliosRes || []);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load filter options.", variant: "destructive" });
      }
    };
    fetchDropdownData();
  }, [toast]);

  useEffect(() => {
    setPageInput(String(pageIndex + 1));
  }, [pageIndex]);

  const columns = useMemo(() => {
    let currentColumnsToUse: ColumnDef<MarketingDataEntry, any>[];
    if (currentView === 'standard') {
      const standardColumnsMap = new Map(
        initialColumnsDefinition.map(col => {
          const key = (col as any).accessorKey || col.id;
          return [key, col];
        })
      );
      currentColumnsToUse = standardViewColumnAccessors
        .map(key => standardColumnsMap.get(key))
        .filter(Boolean) as ColumnDef<MarketingDataEntry, any>[];
    } else {
      currentColumnsToUse = initialColumnsDefinition;
    }
    return currentColumnsToUse.map(col => ({ ...col, enableSorting: true }));
  }, [currentView]);


  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    state: {
      pagination: { pageIndex, pageSize },
      sorting,
      globalFilter,
      columnPinning: { left: columns.slice(0, frozenColumnCount).map(c => c.id || (c as any).accessorKey) }
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    debugTable: false,
    enableColumnPinning: true,
  });

  const handlePageInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const pageNum = parseInt(pageInput, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= (table.getPageCount() || 1)) {
        table.setPageIndex(pageNum - 1);
      } else {
        setPageInput(String(pageIndex + 1));
        toast({
          title: "Invalid Page Number",
          description: `Please enter a page number between 1 and ${table.getPageCount() || 1}.`,
          variant: "destructive",
        });
      }
    }
  };

  const clearCustomDateRange = () => {
    setDateRange(undefined);
    if (selectedDatePreset === 'custom') setSelectedDatePreset('last30days');
  };

  const handleGlobalFilterChange = (value: string) => {
    setGlobalFilter(value);
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  };


  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen p-2 md:p-3">
        <h1 className="text-2xl font-semibold text-foreground mb-4 flex items-center">
            <FileSpreadsheet className="mr-3 h-7 w-7 text-primary" />
            Advertisement Details
        </h1>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-3 pb-3 border-b mb-3">
            <div className="relative min-w-[150px] md:min-w-[200px]">
                <Label htmlFor="adv-global-filter" className="text-xs font-medium text-muted-foreground mb-0.5 block">Global Search</Label>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground mt-1.5" />
                <Input id="adv-global-filter" placeholder="Search..." value={globalFilter ?? ''} onChange={(event) => handleGlobalFilterChange(event.target.value)} className="pl-8 w-full h-9 text-sm" />
            </div>
            <div>
                <Label htmlFor="owner-filter" className="text-xs font-medium text-muted-foreground mb-0.5 block">Owner</Label>
                <Select value={selectedOwner || ''} onValueChange={(value) => {setSelectedOwner(value === 'all' || value === '' ? undefined : value); setPagination(prev => ({ ...prev, pageIndex: 0 }));}}>
                    <SelectTrigger id="owner-filter" className="h-9 text-sm w-full min-w-[120px]"><SelectValue placeholder="All Owners" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Owners</SelectItem>{availableOwners.map(owner => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="portfolio-filter" className="text-xs font-medium text-muted-foreground mb-0.5 block">Portfolio</Label>
                <Select value={selectedPortfolio || ''} onValueChange={(value) => {setSelectedPortfolio(value === 'all' || value === '' ? undefined : value); setPagination(prev => ({ ...prev, pageIndex: 0 }));}}>
                    <SelectTrigger id="portfolio-filter" className="h-9 text-sm w-full min-w-[120px]"><SelectValue placeholder="All Portfolios" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Portfolios</SelectItem>{availablePortfolios.map(portfolio => <SelectItem key={portfolio} value={portfolio}>{portfolio}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="date-preset-filter" className="text-xs font-medium text-muted-foreground mb-0.5 block">Date Range</Label>
                <Select value={selectedDatePreset} onValueChange={(value) => {setSelectedDatePreset(value); setPagination(prev => ({ ...prev, pageIndex: 0 }));}}>
                    <SelectTrigger id="date-preset-filter" className="h-9 text-sm w-full min-w-[120px]"><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="last7days">Last 7 Days</SelectItem><SelectItem value="last30days">Last 30 Days</SelectItem>
                        <SelectItem value="last90days">Last 90 Days</SelectItem><SelectItem value="custom">Custom Range</SelectItem>
                        <SelectItem value="alltime">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {selectedDatePreset === 'custom' && (
              <>
                <div>
                  <Label htmlFor="start-date-picker" className="text-xs font-medium text-muted-foreground mb-0.5 block">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="start-date-picker" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm min-w-[150px]", !dateRange?.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />{dateRange?.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange?.from} onSelect={(day) => {setDateRange({ ...dateRange, from: day ? startOfDay(day) : undefined }); setPagination(prev => ({ ...prev, pageIndex: 0 }));}} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="end-date-picker" className="text-xs font-medium text-muted-foreground mb-0.5 block">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="end-date-picker" variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm min-w-[150px]", !dateRange?.to && "text-muted-foreground")}>
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />{dateRange?.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange?.to} onSelect={(day) => {setDateRange({ ...dateRange, to: day ? endOfDay(day) : undefined }); setPagination(prev => ({ ...prev, pageIndex: 0 }));}} disabled={{ before: dateRange?.from }} initialFocus /></PopoverContent>
                  </Popover>
                </div>
                {(dateRange?.from || dateRange?.to) && (
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" onClick={clearCustomDateRange} size="icon" className="shrink-0 h-9 w-9 self-end"><XIcon className="h-4 w-4 text-muted-foreground" /></Button></TooltipTrigger><TooltipContent><p>Clear custom dates</p></TooltipContent></Tooltip>
                )}
              </>
            )}
             <div>
                <Label htmlFor="freeze-columns-select" className="text-xs font-medium text-muted-foreground mb-0.5 block">Freeze Columns</Label>
                <Select
                  value={String(frozenColumnCount)}
                  onValueChange={(value) => setFrozenColumnCount(Number(value))}
                >
                  <SelectTrigger id="freeze-columns-select" className="h-9 text-sm w-full min-w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No Freeze</SelectItem>
                    {columns.slice(0, 5).map((col, index) => {
                      const colDef = col as ColumnDef<MarketingDataEntry, any>;
                      const header = typeof colDef.header === 'function' ? colDef.header({} as any) : colDef.header;
                      const headerText = typeof header === 'string' ? header : 
                                         (colDef.accessorKey as string || colDef.id || `Col ${index + 1}`);
                      return (
                        <SelectItem key={colDef.id || (colDef.accessorKey as string) || index} value={String(index + 1)}>
                           {`${index + 1} Column${index + 1 > 1 ? 's' : ''} (Up to ${headerText.split('<br')[0].trim()})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
            </div>

            <div className="flex items-end gap-2 md:ml-auto">
                <RadioGroup value={currentView} onValueChange={(value: 'standard' | 'all') => setCurrentView(value)} className="flex space-x-1 h-9 items-center">
                    <div className="flex items-center space-x-1"><RadioGroupItem value="standard" id="standard-view" className="h-3.5 w-3.5"/><Label htmlFor="standard-view" className="text-xs font-normal cursor-pointer">Standard</Label></div>
                    <div className="flex items-center space-x-1"><RadioGroupItem value="all" id="all-columns-view" className="h-3.5 w-3.5"/><Label htmlFor="all-columns-view" className="text-xs font-normal cursor-pointer">All</Label></div>
                </RadioGroup>
                <Tooltip><TooltipTrigger asChild><Button onClick={loadMarketingData} disabled={isLoadingReport} variant="outline" size="icon" className="h-9 w-9"><RefreshCw className={`h-4 w-4 ${isLoadingReport ? 'animate-spin' : ''}`} /></Button></TooltipTrigger><TooltipContent><p>Refresh Data</p></TooltipContent></Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button onClick={() => setIsMarketingUploadModalOpen(true)} variant="outline" size="icon" className="h-9 w-9"><UploadCloud className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Upload Excel Sheets</p></TooltipContent>
                </Tooltip>
            </div>
        </div>

         <div className="flex-1 flex flex-col min-h-0 mt-1 overflow-x-hidden">
          <ScrollArea className="w-full rounded-md border bg-card max-h-[500px]">
            <Table className={cn("whitespace-nowrap", currentView === 'standard' ? 'min-w-[1500px]' : 'min-w-[2700px]')}>
              <TableCaption className="py-1 text-xs text-muted-foreground bg-card">
                {(isLoadingReport && (!data || data.length === 0)) ? ( "Loading marketing data report..."
                ) : (!isLoadingReport && data && data.length > 0 && (globalFilter || selectedDatePreset !== 'alltime' || selectedOwner || selectedPortfolio || (dateRange && (dateRange.from || dateRange?.to)))) ? (
                  <>Showing {table.getRowModel().rows?.length ?? 0} of {totalDBRowCount ?? 0} matching entries. Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 0}</>
                ) : (!isLoadingReport && data && data.length === 0 && (globalFilter || selectedDatePreset !== 'alltime' || selectedOwner || selectedPortfolio || (dateRange && (dateRange.from || dateRange?.to)))) ? (
                    "No matching records found for the selected filters."
                ) : (!isLoadingReport && (!data || data.length === 0)) ? (
                  "No marketing data found. Upload a file to see the report."
                ) : (
                  <>Showing {table.getRowModel().rows?.length ?? 0} of {totalDBRowCount ?? 0} entries. Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 0}</>
                )}
              </TableCaption>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, headerIdx) => {
                      const isFrozen = headerIdx < frozenColumnCount;
                      let leftPositionStyle = {};
                       if (isFrozen) {
                        leftPositionStyle = { left: `${header.getStart()}px` };
                      }
                      const zIndex = isFrozen ? 30 - headerIdx : 10;


                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            "sticky top-0 bg-card border-b py-2 text-sm whitespace-nowrap",
                            header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                            isFrozen && (header.index % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-card'),
                            isFrozen && 'group-hover:bg-muted', 
                            isFrozen && headerIdx === frozenColumnCount - 1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]",
                            ( (typeof header.column.columnDef.header === 'string' && ( header.column.columnDef.header.includes('%') || header.column.columnDef.header.toLowerCase().includes('price') || header.column.columnDef.header.toLowerCase().includes('revenue') || header.column.columnDef.header.toLowerCase().includes('spend') || header.column.columnDef.header.toLowerCase().includes('profit') || header.column.columnDef.header.toLowerCase().includes('gp') || header.column.columnDef.header.toLowerCase().includes('qty') || header.column.columnDef.header.toLowerCase().includes('units') || header.column.columnDef.header.toLowerCase().includes('stock') || header.column.columnDef.header.toLowerCase().includes('moh') ) )
                             || ['totalRevenueExVatCp','totalSalesRevenueExVatSp', 'totalAdvSpend', 'totalAdvSales', 'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent', 'totalQtySold', 'totalAdvUnitsSold', 'fbaStock', 'bwwActualStock', 'vcStock', 'totalStock', 'moh', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold', 'zeroAdvProfitSc', 'zeroAdvProfitVc', 'totalZeroAdvGrossProfit'].includes(header.column.id)
                             ) ? 'text-right pr-2 pl-1' : 'text-left pl-2 pr-1'
                          )}
                          style={{
                            ...leftPositionStyle,
                            width: header.getSize(),
                            minWidth: header.getSize(),
                            zIndex: zIndex
                           }}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {header.isPlaceholder ? null : flexRender( header.column.columnDef.header, header.getContext() )}
                          {{ asc: ' ↑', desc: ' ↓',}[(header.column.getIsSorted() as string) ?? '']}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoadingReport && (!data || data.length === 0) ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap"><div className="flex justify-center items-center"><RefreshCw className="h-5 w-5 text-muted-foreground animate-spin mr-2" />Loading marketing data report...</div></TableCell></TableRow>
                ) : (!isLoadingReport && data && data.length === 0 && (globalFilter || selectedDatePreset !== 'alltime' || selectedOwner || selectedPortfolio || (dateRange && (dateRange.from || dateRange?.to)))) ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap">No results found for your filters.</TableCell></TableRow>
                ) : (!isLoadingReport && (!data || data.length === 0)) ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center whitespace-nowrap">No marketing data found. Upload a file to see the report.</TableCell></TableRow>
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
                        const isFrozen = cellIdx < frozenColumnCount;
                        let leftPositionStyle = {};
                         if (isFrozen) {
                            leftPositionStyle = { left: `${cell.column.getStart()}px` };
                        }
                        const zIndex = isFrozen ? 20 - cellIdx : 1;

                        
                        let cellBgClass = row.index % 2 === 0 ? "bg-slate-100 dark:bg-slate-800" : "bg-card";
                        if (isFrozen) {
                           cellBgClass = `group-hover:brightness-95 dark:group-hover:brightness-110 ${cellBgClass}`;
                        } else {
                           cellBgClass = `${cellBgClass} group-hover:bg-muted/50`;
                        }

                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              "py-2 text-sm whitespace-nowrap border-b", 
                              isFrozen ? "sticky" : "",
                              cellBgClass, 
                              isFrozen && cellIdx === frozenColumnCount - 1 && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]",
                              ['totalRevenueExVatCp','totalSalesRevenueExVatSp', 'totalAdvSpend', 'totalAdvSales', 'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent', 'totalQtySold', 'totalAdvUnitsSold', 'fbaStock', 'bwwActualStock', 'vcStock', 'totalStock', 'moh', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold', 'zeroAdvProfitSc', 'zeroAdvProfitVc', 'totalZeroAdvGrossProfit'].includes(cell.column.id) ? 'text-right pr-2 pl-1' : 'text-left pl-2 pr-1'
                            )}
                            style={{
                              ...leftPositionStyle,
                              width: cell.column.getSize(),
                              minWidth: cell.column.getSize(),
                              zIndex: zIndex
                             }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
             <ScrollBar orientation="horizontal" className="h-2 p-0" />
             <ScrollBar orientation="vertical" />
          </ScrollArea>
          {pageCount > 0 && (
            <div className="flex items-center justify-end space-x-2 py-1 px-2 border-t bg-card">
              <div className="flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">Rows:</span>
                <Select value={`${pageSize}`} onValueChange={(value) => { table.setPageSize(Number(value)); }}>
                  <SelectTrigger className="h-8 w-[70px] text-sm"><SelectValue placeholder={`${pageSize}`} /></SelectTrigger>
                  <SelectContent>{[10, 25, 50, 100, 200].map((size) => (<SelectItem key={size} value={`${size}`} className="text-sm">{size}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
              <div className="flex items-center space-x-1">
                <span className="text-sm text-muted-foreground">Page</span>
                <Input type="number" value={pageInput} onChange={(e) => setPageInput(e.target.value)} onKeyDown={handlePageInputKeyDown} className="h-8 w-14 text-sm text-center" min="1" max={table.getPageCount() || 1}/>
                <span className="text-sm text-muted-foreground">of {table.getPageCount() || 0}</span>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
            </div>
          )}
        </div>
      </div>
      <MarketingUploadModal
        isOpen={isMarketingUploadModalOpen}
        onOpenChange={setIsMarketingUploadModalOpen}
        onUploadComplete={(summary) => {
          loadMarketingData();
          setUploadSummary(summary);
          setIsSummaryDialogOpen(true);
        }}
      />
      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Summary</DialogTitle>
            <DialogDescription>
              {uploadSummary ? (
                <>
                  File: <strong>{uploadSummary.fileName || 'N/A'}</strong><br/>
                  Total rows found: {uploadSummary.totalRowsProcessed}.
                  Successfully processed: {uploadSummary.processedCount || 0}.
                  Rejected: {uploadSummary.errorsEncountered.length}.
                </>
              ) : 'Processing complete.'}
            </DialogDescription>
          </DialogHeader>
          {uploadSummary && uploadSummary.errorsEncountered.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Rejection Details:</h4>
              <ScrollArea className="h-40 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row #</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadSummary.errorsEncountered.map((err, index) => (
                      <TableRow key={index}>
                        <TableCell>{err.rowIndexInExcel || 'N/A'}</TableCell>
                        <TableCell>{err.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              <Button
                onClick={() => downloadErrorCSV(uploadSummary.errorsEncountered, 'brandAnalytics')}
                variant="link"
                size="sm"
                className="mt-2 text-sm"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Error Report
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsSummaryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
