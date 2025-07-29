
import React, { useMemo } from 'react';
import { Product, StockEntry, SortingState, AssociatedStockItem } from '../lib/types';
import { format, isValid } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';
import { constructAmazonUrl } from '@/lib/productUtils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { Loader2 } from 'lucide-react';


const ProductStockInfoCard = ({
  product,
  stockInfo,
  isLoadingStockInfo,
  showAssociatedProductsStock,
  setShowAssociatedProductsStock,
  associatedProductsStockData,
  isLoadingAssociatedStock,
  stockSorting,
  setStockSorting,
}: {
  product: Product;
  stockInfo: StockEntry | null;
  isLoadingStockInfo: boolean;
  showAssociatedProductsStock: boolean;
  setShowAssociatedProductsStock: (show: boolean) => void;
  associatedProductsStockData: AssociatedStockItem[];
  isLoadingAssociatedStock: boolean;
  stockSorting: SortingState;
  setStockSorting: React.Dispatch<React.SetStateAction<SortingState>>;
}) => {

const getSortValue = (item: AssociatedStockItem | { productCode: string, name?: string | null, brand?: string | null, asinCode?: string | null }, stockData: StockEntry | null, columnId: string): string | number | null => {
    switch (columnId) {
        case 'brand':
            const productCodeForBrand = 'productCode' in item ? item.productCode : product.productCode;
            const brand = productCodeForBrand?.split(' ')[0];
            return brand || null;
        case 'productName':
            return ('name' in item ? item.name : product.name) || ('productCode' in item ? item.productCode : product.productCode) || null;
        case 'asinCode':
            return ('asinCode' in item ? item.asinCode : product.asinCode) || null;
        case 'productCode':
             return 'productCode' in item ? item.productCode : product.productCode;
        case 'stockInHand':
        case 'bwwAvailableStock':
        case 'fbaGbStock':
        case 'vcStock':
            if (!stockData) return null;
            if (columnId === 'stockInHand') return (stockData.bwwAvailableStock ?? 0) + (stockData.fbaGbStock ?? 0) + (stockData.vcStock ?? 0);
            return stockData[columnId as keyof StockEntry] as number ?? null;
        case 'ukTransit':
        case 'ukToEuTransit':
        case 'stockOrdered':
        case 'sailingStock':
        case 'sailingArrival':
        case 'inProduction':
        case 'totalStockValue':
            return null;
        default:
            return null;
    }
};

const sortedAssociatedProductsStockData = useMemo(() => {
    if (!showAssociatedProductsStock || associatedProductsStockData.length === 0) {
        return associatedProductsStockData;
    }
    if (stockSorting.length === 0) {
        return associatedProductsStockData;
    }

    const { id: columnId, desc } = stockSorting[0];

    return [...associatedProductsStockData].sort((a, b) => {
        const valA = getSortValue(a, a.stockEntry, columnId);
        const valB = getSortValue(b, b.stockEntry, columnId);

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        let comparison = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
            comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        return desc ? -comparison : comparison;
    });
}, [showAssociatedProductsStock, associatedProductsStockData, stockSorting, product.productCode, product.name, product.asinCode]);


const handleStockSort = (columnId: string) => {
    setStockSorting(prev => {
        const currentSort = prev[0];
        if (currentSort && currentSort.id === columnId) {
            return currentSort.desc ? [] : [{ id: columnId, desc: true }];
        }
        return [{ id: columnId, desc: false }];
    });
};

const renderStockSortIndicator = (columnId: string) => {
    const currentSort = stockSorting.find(s => s.id === columnId);
    if (!currentSort) return null;
    return currentSort.desc ? ' 🔽' : ' 🔼';
};

  const stockTableHeadersConfig: Array<{ id: string, label: React.ReactNode, isNumeric?: boolean, width?: number, isSticky?: boolean, left?: string, zIndexHeader?: number, shadow?: boolean }> = [
    { id: 'brand', label: 'Brand', width: 100, isSticky: true, left: '0px', zIndexHeader: 50 },
    { id: 'productName', label: 'Product Name', width: 200, isSticky: true, left: '100px', zIndexHeader: 40 },
    { id: 'asinCode', label: 'ASIN', width: 120, isSticky: true, left: '300px', zIndexHeader: 30, shadow: true },
    { id: 'productCode', label: 'SKU', width: 100 },
    { id: 'stockInHand', label: 'Stock In Hand', isNumeric: true, width: 100 },
    { id: 'bwwAvailableStock', label: 'BWW Avail.', isNumeric: true, width: 90 },
    { id: 'fbaGbStock', label: 'FBA GB', isNumeric: true, width: 80 },
    { id: 'vcStock', label: 'VC Stock', isNumeric: true, width: 80 },
    { id: 'ukTransit', label: 'UK Transit', isNumeric: true, width: 90 },
    { id: 'ukToEuTransit', label: 'UK to EU Transit', isNumeric: true, width: 110 },
    { id: 'stockOrdered', label: 'Stock Ordered', isNumeric: true, width: 100 },
    { id: 'sailingStock', label: 'Sailing Stock', isNumeric: true, width: 100 },
    { id: 'sailingArrival', label: 'Sailing Arrival', isNumeric: true, width: 110 },
    { id: 'inProduction', label: 'In Production', isNumeric: true, width: 100 },
    { id: 'totalStockValue', label: 'Total Stock Val', isNumeric: true, width: 110 },
  ];

  const renderStockRow = (
    itemData: { productCode: string; name?: string | null; brand?: string | null; asinCode?: string | null },
    stockData: StockEntry | null,
    isLoadingThisStockRow: boolean,
    isMainProductRow: boolean = false,
    isEvenAssociatedRow: boolean = false,
  ) => {
    const stockOrdered = "N/A";
    const sailingStock = "N/A";
    const sailingArrival = "N/A";
    const inProduction = "N/A";
    const totalStockValue = "N/A";

    let stockInHand = 0;
    let bwwAvailable = 0;
    let fbaGb = 0;
    let vcStockCalc = 0;

    if (stockData) {
        bwwAvailable = stockData.bwwAvailableStock ?? 0;
        fbaGb = stockData.fbaGbStock ?? 0;
        vcStockCalc = stockData.vcStock ?? 0;
        stockInHand = bwwAvailable + fbaGb + vcStockCalc;
    }

    const baseCellClassName = "px-1 py-1 text-xs";
    const rightAlignCellClassName = `${baseCellClassName} text-right`;

    let rowSpecificBgClass;
    if (isMainProductRow) {
      rowSpecificBgClass = "group-hover:brightness-95 dark:group-hover:brightness-110";
    } else {
      rowSpecificBgClass = isEvenAssociatedRow ? "bg-muted/40 dark:bg-muted/20 group-hover:bg-muted/50" : "bg-card group-hover:bg-muted/50";
    }
    const rowClass = cn("group", rowSpecificBgClass);

    const rawProductName = itemData.name || itemData.productCode || "N/A";
    const truncatedDisplayName = rawProductName.length > 35 ? `${rawProductName.substring(0, 35)}...` : rawProductName;

    const getBrandFromProductCode = (code: string | undefined | null): string => {
      if (!code || typeof code !== 'string') return "N/A";
      const trimmedCode = code.trim();
      if (!trimmedCode) return "N/A";
      const parts = trimmedCode.split(' ');
      return parts[0] || "N/A";
    };

    const displayBrandValue = getBrandFromProductCode(itemData.productCode);
    const displayAsinForLink = itemData.asinCode;
    const marketDomainForLink = product.marketDomainIdentifier;

    const stickyCellBaseClass = "sticky bg-card group-hover:bg-muted";

    return (
      <TableRow key={itemData.productCode || Math.random().toString()} className={rowClass}>
        <TableCell
          className={cn(
            baseCellClassName,
            "left-0 z-[30]",
            stickyCellBaseClass,
            isMainProductRow ? "text-primary font-medium" : ""
          )}
          style={{ width: `${stockTableHeadersConfig[0].width}px`, minWidth: `${stockTableHeadersConfig[0].width}px` }}
          title={displayBrandValue}
        >
          {displayBrandValue}
        </TableCell>
        <TableCell
          className={cn(
            baseCellClassName,
            "left-[100px] z-[29]",
            stickyCellBaseClass,
            isMainProductRow ? "text-primary font-medium" : ""
          )}
          style={{ width: `${stockTableHeadersConfig[1].width}px`, minWidth: `${stockTableHeadersConfig[1].width}px`, left: '100px' }}
          title={rawProductName}
        >
          {truncatedDisplayName}
        </TableCell>
        <TableCell
          className={cn(
            baseCellClassName,
            "left-[300px] z-[28]",
            stickyCellBaseClass,
            "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]",
            isMainProductRow ? "text-primary font-medium" : ""
          )}
          style={{ width: `${stockTableHeadersConfig[2].width}px`, minWidth: `${stockTableHeadersConfig[2].width}px`, left: '300px' }}
          title={displayAsinForLink || 'N/A'}
        >
          {displayAsinForLink && displayAsinForLink !== 'N/A' ? (
            <a
              href={constructAmazonUrl(displayAsinForLink, marketDomainForLink)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline block truncate"
              title={`View ASIN ${displayAsinForLink}`}
            >
              {displayAsinForLink}
            </a>
          ) : (
            <span className="block truncate" title="N/A">N/A</span>
          )}
        </TableCell>
        <TableCell className={`${baseCellClassName} truncate min-w-[100px] w-[100px]`} title={itemData.productCode}>{itemData.productCode}</TableCell>

        {isLoadingThisStockRow ? (<TableCell className={rightAlignCellClassName} colSpan={11}><div className="flex items-center justify-end"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Loading stock...</div></TableCell>): stockData ? (<><TableCell className={`${rightAlignCellClassName} font-medium`}>{stockInHand.toLocaleString()}</TableCell><TableCell className={rightAlignCellClassName}>{bwwAvailable.toLocaleString()}</TableCell><TableCell className={rightAlignCellClassName}>{fbaGb.toLocaleString()}</TableCell><TableCell className={rightAlignCellClassName}>{vcStockCalc.toLocaleString()}</TableCell><TableCell className={rightAlignCellClassName}>N/A</TableCell><TableCell className={rightAlignCellClassName}>N/A</TableCell><TableCell className={rightAlignCellClassName}>{stockOrdered}</TableCell><TableCell className={rightAlignCellClassName}>{sailingStock}</TableCell><TableCell className={rightAlignCellClassName}>{sailingArrival}</TableCell><TableCell className={rightAlignCellClassName}>{inProduction}</TableCell><TableCell className={rightAlignCellClassName}>{totalStockValue}</TableCell></>) : (<TableCell className={rightAlignCellClassName} colSpan={11}>N/A</TableCell>)}
      </TableRow>
    );
  };

  let stockUpdatedTimestamp = 'N/A';
  if (stockInfo?.updatedOn && isValid(new Date(stockInfo.updatedOn))) {
    stockUpdatedTimestamp = format(new Date(stockInfo.updatedOn), "MMM dd, yyyy, hh:mm a");
  } else if (stockInfo?.createdOn && isValid(new Date(stockInfo.createdOn))) {
     stockUpdatedTimestamp = format(new Date(stockInfo.createdOn), "MMM dd, yyyy, hh:mm a");
  }


  return (
    <Card className="mt-4">
      <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg whitespace-nowrap font-semibold leading-none tracking-tight">
            Product Stock Info
          </CardTitle>
          <div className="flex items-center gap-x-3 sm:gap-x-4">
            <p className="text-xs text-muted-foreground whitespace-nowrap">
                Stock updated: {stockUpdatedTimestamp}
            </p>
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="show-associated-stock"
                    checked={showAssociatedProductsStock}
                    onCheckedChange={(checked) => setShowAssociatedProductsStock(Boolean(checked))}
                    disabled={!product?.associatedProducts || product.associatedProducts.length === 0 || isLoadingAssociatedStock}
                />
                <Label htmlFor="show-associated-stock" className="text-xs font-medium whitespace-nowrap">
                    {isLoadingAssociatedStock ? "Loading..." : "Associated Products"}
                </Label>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <Table className="min-w-[1500px]">
             <TableHeader>
              <TableRow className="sticky top-0 bg-card z-20">
                {stockTableHeadersConfig.map(header => (
                  <TableHead
                    key={header.id}
                    className={cn(
                        "px-1 py-1 text-xs whitespace-nowrap sticky top-0 bg-card cursor-pointer select-none",
                        header.isNumeric && "text-right",
                        header.isSticky && `left-[${header.left}]`,
                        header.isSticky && header.shadow && "shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_-2px_rgba(255,255,255,0.05)]"
                    )}
                     style={{
                        width: header.width ? `${header.width}px` : 'auto',
                        minWidth: header.width ? `${header.width}px` : 'auto',
                        left: header.isSticky ? header.left : undefined,
                        backgroundColor: 'hsl(var(--card))',
                        zIndex: header.isSticky ? header.zIndexHeader : undefined
                     }}
                    onClick={() => handleStockSort(header.id)}
                  >
                    {header.label}
                    {renderStockSortIndicator(header.id)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderStockRow(
                { productCode: product.productCode, name: product.name, brand: product.brand, asinCode: product.asinCode },
                stockInfo,
                isLoadingStockInfo,
                true
              )}
              {showAssociatedProductsStock && sortedAssociatedProductsStockData.map((item, idx) =>
                renderStockRow(
                  { productCode: item.productCode, name: item.productName, brand: item.brand, asinCode: item.asinCode },
                  item.stockEntry,
                  isLoadingAssociatedStock,
                  false,
                  idx % 2 === 0
                )
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" className="h-2.5 [&>div]:bg-neutral-300 dark:[&>div]:bg-neutral-700 [&>div]:rounded-sm" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ProductStockInfoCard;
