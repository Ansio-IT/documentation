import type { ProductListingUploadError } from '@/lib/types';

export function downloadErrorCSV(errors: ProductListingUploadError[], uploadType: string) {
  if (!errors.length) return;
  let headers = '';
  let csvContent = '';

  if (uploadType === 'productListing') {
    headers = 'RowIndexInExcel,ProductCode,ASIN,Market,Error\n';
    csvContent = errors.map(e => {
      return `${e.rowIndexInExcel || ''},"${e.productCode || ''}","${e.asin || ''}","${e.market || ''}","${String(e.error || '').replace(/"/g, '""')}"`;
    }).join("\n");
  } else if (uploadType === 'salesForecast') {
    headers = 'RowIndexInExcel,SKU,StartDate,EndDate,Channel,Error\n';
    csvContent = errors.map(e => {
      return `${(e as any).rowIndexInExcel || ''},"${(e as any).sku || (e as any).productCode || ''}","${(e as any).startDate || ''}","${(e as any).endDate || ''}","${(e as any).channel || ''}","${String(e.error || '').replace(/"/g, '""')}"`;
    }).join("\n");
  } else if (uploadType === 'brandAnalytics') {
    headers = 'RowIndexInExcel,Error\n';
    csvContent = errors.map(e => {
      const rowIndex = e.rowIndexInExcel ? e.rowIndexInExcel : 'N/A';
      const errorMsg = String(e.error || '').replace(/"/g, '""');
      return `${rowIndex},"${errorMsg}"`;
    }).join("\n");
  } else {
    headers = 'RowIndexInExcel,Error\n';
    csvContent = errors.map(e => {
      return `${e.rowIndexInExcel || ''},"${String(e.error || '').replace(/"/g, '""')}"`;
    }).join("\n");
  }


  const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${uploadType}_upload_errors.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
