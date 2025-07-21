
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { MarketingDataEntry, FetchMarketingDataParams, DateRange as CustomDateRange } from '@/lib/types';
import {
  processAndStoreMarketingData,
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
import { UploadCloud, RefreshCw, Search, CalendarIcon, XIcon } from 'lucide-react';
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
import { format, parseISO, isValid as isValidDateFn, subDays, startOfDay, endOfDay, parse as parseDateFns } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formatDateForDisplay = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    let date = parseISO(dateString);
    if (isValidDateFn(date)) return format(date, 'MMM do, yyyy');
    date = new Date(dateString);
    if (isValidDateFn(date)) return format(date, 'MMM do, yyyy');
  } catch (e) { /* ignore */ }
  return dateString;
};

const formatNumberForDisplay = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || String(value).trim() === '' || isNaN(Number(value))) return 'N/A';
  const num = Number(value);
  // Always show 2 decimal places for all numbers as per request
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatCurrency = (value: number | null | undefined, symbol = '£'): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return `${symbol}N/A`;
  return `${symbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A%';
  return `${(Number(value) * 100).toFixed(2)}%`; // Ensures 2 decimal places
};

const numericFields: (keyof MarketingDataEntry)[] = [
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalSalesRevenueExVatSp',
  'totalAdvSpend', 'totalAdvSales', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold',
  'marketingPercent', 'acosPercent', 'zeroAdvProfitSc', 'zeroAdvProfitVc',
  'totalZeroAdvGrossProfit', 'totalGp', 'gpPercent', 'fbaStock', 'bwwActualStock',
  'vcStock', 'totalStock', 'moh'
];

const headerMapping: { [key: string]: keyof MarketingDataEntry } = {
  'DATE': 'date', 'ASIN': 'asin', 'Product Code': 'productCode', 'Product Description': 'productDescription',
  'Person': 'person', 'Portfolio': 'portfolio', 'Sub Portfolio': 'subPortfolio',
  'Total Qty Sold (SC + VC)': 'totalQtySold', 'Total Adv Units Sold': 'totalAdvUnitsSold',
  'Total Revenue Ex VAT (CP)': 'totalRevenueExVatCp', 'Total Sales Revenue Ex VAT (SP)': 'totalSalesRevenueExVatSp',
  'Total Adv Spend': 'totalAdvSpend', 'Total Adv Sales': 'totalAdvSales',
  'per unit Adv Spend on Total Qty Sold': 'perUnitAdvSpendOnTotalQtySold',
  'per unit Adv Spend on Adv Qty Sold': 'perUnitAdvSpendOnAdvQtySold',
  'Marketing%': 'marketingPercent', 'ACOS%': 'acosPercent',
  'Zero Adv Profit SC': 'zeroAdvProfitSc', 'Zero Adv Profit VC': 'zeroAdvProfitVc',
  'Total (SC + VC) Zero Adv Gross Profit': 'totalZeroAdvGrossProfit', 'Total GP': 'totalGp', 'GP%': 'gpPercent',
  'FBA Stock': 'fbaStock', 'BWW Actual Stock': 'bwwActualStock', 'VC Stock': 'vcStock',
  'Total Stock': 'totalStock', 'MOH': 'moh', 'Adv Marketplace': 'advMarketplace',
};

const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined) return null;
  if (typeof excelDate === 'number') {
    if (excelDate < 1 || excelDate > 2958465) return null;
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (date && date.y && date.m && date.d && date.y >= 1900 && date.y < 3000) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  } else if (typeof excelDate === 'string') {
    const commonFormats = [
      'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'MM-dd-yyyy', 'dd-MM-yyyy',
      'M/d/yy', 'd/M/yy', 'yy-M-d', 'M-d-yy', 'd-M-yy',
      'yyyy/MM/dd', 'dd.MM.yyyy', 'MM.dd.yyyy'
    ];
    for (const fmt of commonFormats) {
      try {
        const parsed = parseDateFns(excelDate, fmt, new Date());
        if (isValidDateFn(parsed) && parsed.getFullYear() >= 1900 && parsed.getFullYear() < 3000) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch { /* ignore */ }
    }
    try {
      const d = new Date(excelDate);
      if (isValidDateFn(d) && d.getFullYear() >= 1900 && d.getFullYear() < 3000) {
        return d.toISOString().split('T')[0];
      }
    } catch {/* ignore */}
  }
  return null;
};

const columnHelper = createColumnHelper<MarketingDataEntry>();

const initialColumnsDefinition: ColumnDef<MarketingDataEntry, any>[] = [
  { accessorKey: 'date', header: 'DATE', size: 90, cell: info => formatDateForDisplay(info.getValue()), enableSorting: true },
  { accessorKey: 'asin', header: 'ASIN', size: 100, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
  { accessorKey: 'productCode', header: 'Product Code', size: 90, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
  {
    accessorKey: 'productDescription',
    header: 'Product Description',
    size: 200,
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
  { accessorKey: 'totalQtySold', header: 'Total Qty Sold (SC + VC)', size: 100, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalAdvUnitsSold', header: 'Total Adv Units Sold', size: 80, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  {
    accessorKey: 'totalRevenueExVatCp',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalRevenueExVatCp) || 0), 0);
      return (<div className="text-right"><div className="font-medium">Total Revenue Ex VAT (CP)</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 110, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalSalesRevenueExVatSp',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalSalesRevenueExVatSp) || 0), 0);
      return (<div className="text-right"><div className="font-medium">Total Sales Revenue Ex VAT (SP)</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 120, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalAdvSpend',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalAdvSpend) || 0), 0);
      return (<div className="text-right"><div className="font-medium">Total Adv Spend</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  {
    accessorKey: 'totalAdvSales',
    header: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((acc, row) => acc + (Number(row.original.totalAdvSales) || 0), 0);
      return (<div className="text-right"><div className="font-medium">Total Adv Sales</div><div className="text-xs font-semibold text-primary">{formatCurrency(sum)}</div></div>);
    },
    size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'perUnitAdvSpendOnTotalQtySold', header: 'per unit Adv Spend on Total Qty Sold', size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'perUnitAdvSpendOnAdvQtySold', header: 'per unit Adv Spend on Adv Qty Sold', size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  {
    accessorKey: 'marketingPercent',
    header: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const totalAdvSpend = rows.reduce((sum, row) => sum + (Number(row.original.totalAdvSpend) || 0), 0);
      const totalSalesRevenue = rows.reduce((sum, row) => sum + (Number(row.original.totalSalesRevenueExVatSp) || 0), 0);
      const percentage = totalSalesRevenue !== 0 ? totalAdvSpend / totalSalesRevenue : 0;
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
      const percentage = totalAdvSales !== 0 ? totalAdvSpend / totalAdvSales : 0;
      return (<div className="text-right"><div className="font-medium">ACOS%</div><div className="text-xs font-semibold text-primary">{formatPercentage(percentage)}</div></div>);
    },
    size: 80, cell: info => <span className="block text-right">{formatPercentage(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'zeroAdvProfitSc', header: 'Zero Adv Profit SC', size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'zeroAdvProfitVc', header: 'Zero Adv Profit VC', size: 100, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalZeroAdvGrossProfit', header: 'Total (SC + VC) Zero Adv Gross Profit', size: 110, cell: info => <span className="block text-right">{formatCurrency(info.getValue())}</span>, enableSorting: true },
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
      const percentage = totalRevenue !== 0 ? totalGp / totalRevenue : 0;
      return (<div className="text-right"><div className="font-medium">GP%</div><div className="text-xs font-semibold text-primary">{formatPercentage(percentage)}</div></div>);
    },
    size: 80, cell: info => <span className="block text-right">{formatPercentage(info.getValue())}</span>, enableSorting: true
  },
  { accessorKey: 'fbaStock', header: 'FBA Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'bwwActualStock', header: 'BWW Actual Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'vcStock', header: 'VC Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'totalStock', header: 'Total Stock', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'moh', header: 'MOH', size: 70, cell: info => <span className="block text-right">{formatNumberForDisplay(info.getValue())}</span>, enableSorting: true },
  { accessorKey: 'advMarketplace', header: 'Adv Marketplace', size: 100, cell: info => <span className="block truncate" title={String(info.getValue() ?? 'N/A')}>{info.getValue() ?? 'N/A'}</span>, enableSorting: true },
].map(colDef => {
    const key = (colDef as any).accessorKey as keyof MarketingDataEntry;
    if (numericFields.includes(key) && typeof colDef.header === 'string') {
        return {
            ...colDef,
            header: () => <div className="text-right w-full">{colDef.header}</div>,
        };
    }
    if (typeof colDef.header === 'string' && (colDef.header.includes('%') || colDef.header.toLowerCase().includes('price') || colDef.header.toLowerCase().includes('revenue') || colDef.header.toLowerCase().includes('spend') || colDef.header.toLowerCase().includes('profit') || colDef.header.toLowerCase().includes('gp'))) {
         return {
            ...colDef,
            header: () => <div className="text-right w-full">{colDef.header}</div>,
        };
    }
    return colDef;
});

const standardViewColumnAccessors: (keyof MarketingDataEntry)[] = [
  'date', 'asin', 'productCode', 'productDescription', 'person', 'portfolio', 'subPortfolio',
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalAdvSpend', 'totalAdvSales',
  'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent'
];

const BATCH_SIZE = 1000;

export default function AdvertisementDetailsPage() {
  const [data, setData] = useState<MarketingDataEntry[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [totalDBRowCount, setTotalDBRowCount] = useState(0);

  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgressMessage, setUploadProgressMessage] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('last30days');
  const [dateRange, setDateRange] = useState<CustomDateRange | undefined>(undefined);

  const [availableOwners, setAvailableOwners] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string | undefined>(undefined);

  const [availablePortfolios, setAvailablePortfolios] = useState<string[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | undefined>(undefined);

  const [currentView, setCurrentView] = useState<'standard' | 'all'>('standard');
  const [frozenColumnCount, setFrozenColumnCount] = useState(1);

  const [sorting, setSorting] = useState<SortingState>([]);

  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 100,
  });
  const [pageInput, setPageInput] = useState<string>(String(pageIndex + 1));


  const loadMarketingData = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const params: FetchMarketingDataParams = {
        pageIndex,
        pageSize,
        sorting,
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
    return currentColumnsToUse;
  }, [currentView]);


  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    state: {
      pagination: { pageIndex, pageSize },
      sorting,
      globalFilter,
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
    getColumnCanFreeze: () => true,
    getIsColumnFrozen: (column) => column.getIsFrozen() === 'left',
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

  const handleUploadButtonClick = () => {
    if (selectedFile && !isProcessingFile) {
      handleFileUpload();
    } else if (!isProcessingFile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setFileName(event.target.files[0].name);
    } else {
      setSelectedFile(null);
      setFileName(null);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: "Please select an Excel or CSV file to upload.", variant: "destructive" });
      return;
    }
    setIsProcessingFile(true);
    setUploadProgressMessage("Starting file processing...");
    let totalSuccessfullyProcessed = 0;
    const allErrorsEncountered: any[] = [];

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileData = e.target?.result;
        if (!fileData) throw new Error("File content not readable");

        const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, raw: false, blankrows: false });

        if (jsonData.length < 3) throw new Error("File empty or invalid structure (headers in row 2, data from row 3)");

        const headers: string[] = (jsonData[1] as string[] || []).map(h => String(h || '').trim());
        const rows = jsonData.slice(2);

        if (!headers || headers.length === 0) throw new Error("Header row not found");
        if (rows.length === 0) throw new Error("No data rows found");

        const parsedEntries: Omit<MarketingDataEntry, 'id' | 'createdAt'>[] = rows.map((rowArray: any[]) => {
          const entry: any = {};
          headers.forEach((header, index) => {
            const mappedKey = headerMapping[String(header).trim()];
            if (mappedKey) {
              let value = rowArray[index];
              if (value === undefined || value === null || String(value).trim() === '') {
                entry[mappedKey] = null;
              } else if (mappedKey === 'date') {
                entry[mappedKey] = parseExcelDate(value);
              } else if (numericFields.includes(mappedKey)) {
                let cleanedValue = String(value).replace(/,/g, '');
                if (String(cleanedValue).includes('%')) {
                  cleanedValue = cleanedValue.replace(/%/g, '');
                  const numVal = parseFloat(cleanedValue);
                  entry[mappedKey] = isNaN(numVal) ? null : numVal / 100;
                } else {
                  cleanedValue = String(cleanedValue).replace(/[^\d.-]+/g, "");
                  const numVal = parseFloat(cleanedValue);
                  entry[mappedKey] = isNaN(numVal) ? null : numVal;
                }
              } else {
                entry[mappedKey] = String(value).trim();
              }
            }
          });
          return entry;
        }).filter(entry => Object.values(entry).some(val => val !== null && val !== undefined && String(val).trim() !== ''));

        const uniqueEntriesMap = new Map<string, Omit<MarketingDataEntry, 'id' | 'createdAt'>>();
        parsedEntries.forEach(entry => {
          if (entry.date && entry.asin) {
            const key = `${entry.date}-${entry.asin}`;
            uniqueEntriesMap.set(key, entry);
          } else {
            allErrorsEncountered.push({ message: "Skipping entry from deduplication due to missing date or ASIN", entryData: JSON.stringify(entry).substring(0,100) });
            uniqueEntriesMap.set(Math.random().toString(36).substring(7), entry);
          }
        });
        const deduplicatedEntries = Array.from(uniqueEntriesMap.values());
        const totalEntriesInFile = deduplicatedEntries.length;

        if (deduplicatedEntries.length === 0) throw new Error("No valid data after deduplication");

        for (let i = 0; i < deduplicatedEntries.length; i += BATCH_SIZE) {
          const chunk = deduplicatedEntries.slice(i, i + BATCH_SIZE);
          setUploadProgressMessage(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(deduplicatedEntries.length / BATCH_SIZE)}... (${chunk.length} entries)`);
          const result = await processAndStoreMarketingData(chunk);
          if (result.success) totalSuccessfullyProcessed += result.count || 0;
          if (result.errorsEncountered && result.errorsEncountered.length > 0) allErrorsEncountered.push(...result.errorsEncountered);
          if (!result.success && (!result.errorsEncountered || result.errorsEncountered.length === 0)) {
             allErrorsEncountered.push({ message: `Batch starting at entry ${i + 1} failed: ${result.message}` });
          }
        }

        if (totalSuccessfullyProcessed > 0) toast({ title: "Processing Complete", description: `Successfully processed ${totalSuccessfullyProcessed} of ${totalEntriesInFile} unique marketing data entries (new entries added or existing ones updated based on Date & ASIN).`, duration: 7000 });
        if (allErrorsEncountered.length > 0) {
          console.error("Errors during batch processing:", allErrorsEncountered);
          const sampleError = String(allErrorsEncountered[0]?.message || allErrorsEncountered[0]).substring(0,100);
          toast({ title: "Processing Issues", description: `${allErrorsEncountered.length} errors occurred. Some data may not have been stored. Check console. Example: ${sampleError}...`, variant: "destructive", duration: 10000 });
        }
        if (totalSuccessfullyProcessed === 0 && totalEntriesInFile > 0 && allErrorsEncountered.length > 0) toast({ title: "Upload Failed", description: "No entries were successfully stored. Check errors in console.", variant: "destructive" });
        else if (totalEntriesInFile === 0 && parsedEntries.length > 0 && allErrorsEncountered.length === 0) toast({ title: "No New Data Processed", description: "No new entries to add. Existing entries might have been updated.", variant: "default" });

        loadMarketingData();
      } catch (processingError) {
        console.error("Error during Excel processing:", processingError);
        toast({ title: "Processing Error", description: processingError instanceof Error ? processingError.message : "An error occurred while processing the file.", variant: "destructive" });
      } finally {
        setSelectedFile(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsProcessingFile(false);
        setUploadProgressMessage(null);
      }
    };
    reader.onerror = () => {
      toast({ title: "File Reading Error", description: "An error occurred while trying to read the file.", variant: "destructive" });
      setIsProcessingFile(false);
      setUploadProgressMessage(null);
    };
    try {
      reader.readAsArrayBuffer(selectedFile);
    } catch (readError) {
        console.error("Error initiating file read:", readError);
        toast({ title: "File Read Initiation Error", description: readError instanceof Error ? readError.message : String(readError), variant: "destructive" });
        setIsProcessingFile(false);
        setUploadProgressMessage(null);
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
        <div className="pb-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Advertisement Details</h1>
        </div>

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

            <div className="flex items-end gap-2 md:ml-auto">
                <div>
                <Label htmlFor="freeze-columns-select" className="text-xs font-medium text-muted-foreground mb-0.5 block">Freeze Columns</Label>
                <Select value={String(frozenColumnCount)} onValueChange={(value) => setFrozenColumnCount(Number(value))}>
                    <SelectTrigger id="freeze-columns-select" className="h-9 text-sm w-full min-w-[100px]">
                    <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    {[0, 1, 2, 3].map(num => (
                        <SelectItem key={num} value={String(num)}>{num} Column{num !== 1 ? 's' : ''}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
                <RadioGroup value={currentView} onValueChange={(value: 'standard' | 'all') => setCurrentView(value)} className="flex space-x-1 h-9 items-center">
                    <div className="flex items-center space-x-1"><RadioGroupItem value="standard" id="standard-view" className="h-3.5 w-3.5"/><Label htmlFor="standard-view" className="text-xs font-normal cursor-pointer">Standard</Label></div>
                    <div className="flex items-center space-x-1"><RadioGroupItem value="all" id="all-columns-view" className="h-3.5 w-3.5"/><Label htmlFor="all-columns-view" className="text-xs font-normal cursor-pointer">All</Label></div>
                </RadioGroup>
                <Tooltip><TooltipTrigger asChild><Button onClick={loadMarketingData} disabled={isLoadingReport || isProcessingFile} variant="outline" size="icon" className="h-9 w-9"><RefreshCw className={`h-4 w-4 ${isLoadingReport ? 'animate-spin' : ''}`} /></Button></TooltipTrigger><TooltipContent><p>Refresh Data</p></TooltipContent></Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={handleUploadButtonClick} disabled={isProcessingFile} variant="outline" size="icon" className="h-9 w-9"><UploadCloud className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{selectedFile && fileName ? `Process: ${fileName.substring(0, 30)}${fileName.length > 30 ? '...' : ''}` : "Upload Excel"}</p></TooltipContent>
                </Tooltip>
            </div>
        </div>

        <Input id="marketing-file-upload-hidden" type="file" ref={fileInputRef} accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} className="hidden" />
        {uploadProgressMessage && <p className="text-xs text-primary py-0.5">{uploadProgressMessage}</p>}

        <div className="flex-1 flex flex-col min-h-0 mt-1">
          <ScrollArea className="flex-1 w-full rounded-md border bg-card">
            <Table className="min-w-[800px] whitespace-nowrap">
              <TableCaption className="py-1 text-xs text-muted-foreground sticky bottom-0 bg-card z-10">
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
                    {headerGroup.headers.map(header => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "sticky top-0 bg-card border-b py-0.5 text-sm whitespace-nowrap",
                          header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                          header.index < frozenColumnCount ? "z-30" : "z-20",
                          header.index === frozenColumnCount - 1 && frozenColumnCount > 0 && "border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                          // Check if header text suggests numeric/currency/percentage for right alignment
                           ( (typeof header.column.columnDef.header === 'string' && ( header.column.columnDef.header.includes('%') || header.column.columnDef.header.toLowerCase().includes('price') || header.column.columnDef.header.toLowerCase().includes('revenue') || header.column.columnDef.header.toLowerCase().includes('spend') || header.column.columnDef.header.toLowerCase().includes('profit') || header.column.columnDef.header.toLowerCase().includes('gp') || header.column.columnDef.header.toLowerCase().includes('qty') || header.column.columnDef.header.toLowerCase().includes('units') || header.column.columnDef.header.toLowerCase().includes('stock') || header.column.columnDef.header.toLowerCase().includes('moh') ) )
                           || ['totalRevenueExVatCp','totalSalesRevenueExVatSp', 'totalAdvSpend', 'totalAdvSales', 'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent', 'totalQtySold', 'totalAdvUnitsSold', 'fbaStock', 'bwwActualStock', 'vcStock', 'totalStock', 'moh', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold', 'zeroAdvProfitSc', 'zeroAdvProfitVc', 'totalZeroAdvGrossProfit'].includes(header.column.id)
                           ) ? 'text-right pr-2 pl-1' : 'text-left pl-2 pr-1'
                        )}
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          left: header.index < frozenColumnCount ? header.getStart('css') : undefined,
                         }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder ? null : flexRender( header.column.columnDef.header, header.getContext() )}
                        {{ asc: ' \u2191', desc: ' \u2193',}[(header.column.getIsSorted() as string) ?? '']}
                      </TableHead>
                    ))}
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
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="group">
                      {row.getVisibleCells().map(cell => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-0.5 text-sm whitespace-nowrap group-hover:bg-muted/50 border-b",
                            cell.column.getIndex() < frozenColumnCount ? "sticky bg-card group-hover:bg-muted/60 z-10" : "",
                            cell.column.getIndex() === frozenColumnCount - 1 && frozenColumnCount > 0 && "border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                            // Apply text-right for specific column IDs that are numeric/currency/percentage
                            ['totalRevenueExVatCp','totalSalesRevenueExVatSp', 'totalAdvSpend', 'totalAdvSales', 'marketingPercent', 'acosPercent', 'totalGp', 'gpPercent', 'totalQtySold', 'totalAdvUnitsSold', 'fbaStock', 'bwwActualStock', 'vcStock', 'totalStock', 'moh', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold', 'zeroAdvProfitSc', 'zeroAdvProfitVc', 'totalZeroAdvGrossProfit'].includes(cell.column.id) ? 'text-right pr-2 pl-1' : 'text-left pl-2 pr-1'
                          )}
                          style={{
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            left: cell.column.getIndex() < frozenColumnCount ? cell.column.getStart('css') : undefined,
                           }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" className="h-2.5 [&>div]:bg-neutral-300 dark:[&>div]:bg-neutral-700 [&>div]:rounded-sm" />
            <ScrollBar orientation="vertical" className="w-2.5 [&>div]:bg-neutral-300 dark:[&>div]:bg-neutral-700 [&>div]:rounded-sm" />
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
    </TooltipProvider>
  );
}
