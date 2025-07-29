
import * as XLSX from 'xlsx';
import type { StockEntry, MarketingDataEntry, ParsedProductListingUploadRow, UploadType, ParsedSalesForecastUploadRow, ParsedKeywordUploadRow } from '@/lib/types';
import { isValid as isValidDateFnUtil, parse as parseDateFns, format, parseISO } from 'date-fns';

// A more robust date parsing function to handle both Excel serial numbers and various string formats.
export const parseExcelDate = (excelDate: any): string | null => {
  if (excelDate === null || excelDate === undefined || String(excelDate).trim() === '') {
    return null;
  }

  // Case 1: Excel's numeric serial date format
  if (typeof excelDate === 'number') {
    // Basic sanity check for Excel serial dates (corresponds to years between 1900 and 9999)
    if (excelDate > 0 && excelDate < 2958466) {
      const date = XLSX.SSF.parse_date_code(excelDate);
      if (date && date.y && date.m && date.d) {
        // Construct a Date object. Month is 0-indexed in JS Date constructor.
        const parsed = new Date(Date.UTC(date.y, date.m - 1, date.d));
        if (isValidDateFnUtil(parsed)) {
          return format(parsed, 'yyyy-MM-dd');
        }
      }
    }
  }

  // Case 2: Date is already a string
  if (typeof excelDate === 'string') {
    // First, try parsing as an ISO string, which is a common and unambiguous format.
    const isoParsed = parseISO(excelDate);
    if (isValidDateFnUtil(isoParsed)) {
      return format(isoParsed, 'yyyy-MM-dd');
    }

    // If not ISO, try a list of common formats.
    const commonFormats = [
      'MM/dd/yyyy', 'M/d/yyyy',
      'dd/MM/yyyy', 'd/M/yyyy',
      'MM-dd-yyyy', 'M-d-yyyy',
      'dd-MM-yyyy', 'd-M-yyyy',
      'yyyy-MM-dd',
      'MMMM d, yyyy', 'MMM d, yyyy'
    ];

    for (const fmt of commonFormats) {
      try {
        const parsed = parseDateFns(excelDate, fmt, new Date());
        if (isValidDateFnUtil(parsed)) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        // Ignore parsing errors for this specific format and try the next one.
      }
    }
  }
  
  // Case 3: The `cellDates: true` option in sheet_to_json might have already converted it to a JS Date object.
  if (excelDate instanceof Date) {
    if (isValidDateFnUtil(excelDate)) {
        return format(excelDate, 'yyyy-MM-dd');
    }
  }

  // If all parsing attempts fail, return null.
  console.warn(`Could not parse date from value: '${excelDate}' (type: ${typeof excelDate})`);
  return null;
};


export const parseExcelSheet = <T extends StockEntry | MarketingDataEntry | ParsedProductListingUploadRow | ParsedSalesForecastUploadRow | ParsedKeywordUploadRow>(
    fileData: ArrayBuffer,
    headerMapping: { [key: string]: string },
    numericFieldsList: string[],
    dataType: UploadType, // Use the UploadType union
    mandatoryColumnKey?: string,
    mandatoryColumnName?: string,
    secondaryMandatoryKeys?: Array<{key: string; name: string}>
  ): { parsedEntries: (Omit<T, 'id' | 'createdAt' | 'createdOn' | 'updatedOn'> & { rowIndexInExcel: number })[], rowsSkippedForMissingMandatoryValue: number, parsingErrors: string[] } => {
    const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let headerRowIndex = 0; 
    if (dataType === 'advertisement' || dataType === 'brandAnalytics' ){
      headerRowIndex = 1;
    }
    const dataStartRowIndex = headerRowIndex + 1;
    
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, raw: false, blankrows: false, defval: null });

    let rowsSkippedForMissingMandatoryValue = 0;
    const parsingErrors: string[] = [];

    if (jsonData.length < dataStartRowIndex) {
        const errorMsg = `File empty or missing headers. Expected headers in row ${headerRowIndex + 1} and data starting from row ${dataStartRowIndex + 1}.`;
        parsingErrors.push(errorMsg);
        return { parsedEntries: [], rowsSkippedForMissingMandatoryValue, parsingErrors };
    }

    const headers: string[] = (jsonData[headerRowIndex] as string[] || []).map(h => String(h || '').trim());

    if (!headers || headers.length === 0) {
        const errorMsg = `Header row (${headerRowIndex + 1}) not found or is empty in the first sheet.`;
        parsingErrors.push(errorMsg);
        return { parsedEntries: [], rowsSkippedForMissingMandatoryValue, parsingErrors };
    }
    
    const allMandatoryHeaders = [{key: mandatoryColumnKey, name: mandatoryColumnName}, ...(secondaryMandatoryKeys || [])];
    for (const mandatory of allMandatoryHeaders) {
        if (mandatory.key && mandatory.name) {
             const expectedHeaderName = mandatory.name.trim().toLowerCase();
             const headerExists = headers.some(h => h.trim().toLowerCase() === expectedHeaderName);
             if (!headerExists) {
                parsingErrors.push(`❌ Missing required column '${mandatory.name}'. Please check your file header.`);
             }
        }
    }
    if (parsingErrors.length > 0) {
        return { parsedEntries: [], rowsSkippedForMissingMandatoryValue, parsingErrors };
    }

    let dataRowsToProcess = jsonData.slice(dataStartRowIndex);
    if ((dataType === 'stock' || dataType === 'advertisement') && dataRowsToProcess.length > 0) {
        const lastRow = dataRowsToProcess[dataRowsToProcess.length - 1];
        if (lastRow && (!lastRow[0] || String(lastRow[0]).toLowerCase().includes('total') || String(lastRow[0]).toLowerCase().includes('grand total'))) {
            dataRowsToProcess = dataRowsToProcess.slice(0, -1);
        }
    }

    if (dataRowsToProcess.length === 0){
        console.warn(`${dataType} sheet: No data rows to process after header and potential footer removal.`);
    }

    let mappedRows = dataRowsToProcess.map((rowArray: any[], rowIndex) => {
      const excelRowNumber = rowIndex + dataStartRowIndex + 1;
      
      const mandatoryHeaderIndex = mandatoryColumnName ? headers.findIndex(h => h.trim().toLowerCase() === mandatoryColumnName.trim().toLowerCase()) : -1;
      let hasErrorInRow = false;
      
      if (mandatoryHeaderIndex !== -1) {
        const mandatoryValue = rowArray[mandatoryHeaderIndex];
        if (mandatoryValue === undefined || mandatoryValue === null || String(mandatoryValue).trim() === '') {
          return null;
        }
      }

      const entry: any = { rowIndexInExcel: excelRowNumber };
      let missingMandatoryInThisRow = false;

      headers.forEach((header, index) => {
        const mappedKey = headerMapping[String(header).trim()];
        if (mappedKey) {
          let value = rowArray[index];
          if (value === undefined || value === null || String(value).trim() === '') {
            entry[mappedKey] = null;
          } else {
            if ((mappedKey === 'date' && dataType === 'advertisement') || (['startDate', 'endDate'].includes(mappedKey) && dataType === 'salesForecast')) {
              const parsedDateString = parseExcelDate(value);
              entry[mappedKey] = parsedDateString;
               if (parsedDateString === null) {
                  parsingErrors.push(`❌ Invalid date format in row ${excelRowNumber} for '${header}'. Please use YYYY-MM-DD or a similar valid format. Original value: '${value}'`);
                  hasErrorInRow = true;
              }
            } else if (numericFieldsList.includes(mappedKey as string)) {
              let stringValue = String(value).trim();
              stringValue = stringValue.replace(/[£$€]/g, '').trim();

              if (stringValue === '-' || stringValue === '') {
                entry[mappedKey] = null;
              } else {
                let cleanedValue = stringValue.replace(/,/g, ''); 
                const numVal = parseFloat(cleanedValue);
                if (isNaN(numVal)) {
                    entry[mappedKey] = null;
                    parsingErrors.push(`❌ Invalid number in '${header}' at row ${excelRowNumber}. Value: '${value}'`);
                    hasErrorInRow = true;
                } else {
                    entry[mappedKey] = numVal;
                }
              }
            } else {
              entry[mappedKey] = String(value).trim();
            }
          }
        }
      });
      
      const checkMandatoryValue = (mKey?: string, mName?: string) => {
        if (mKey && mName) {
            const valueForMandatoryColumn = entry[mKey];
            if (valueForMandatoryColumn === null || String(valueForMandatoryColumn).trim() === '') {
                parsingErrors.push(`⚠️ Empty value in '${mKey}' on row ${excelRowNumber}. Please complete the data.`);
                hasErrorInRow = true;
            }
        }
        return true;
      };
      
      if(secondaryMandatoryKeys){
        for(const secKey of secondaryMandatoryKeys){
            if(!checkMandatoryValue(secKey.key, secKey.name)){
                 rowsSkippedForMissingMandatoryValue++;
                 return null;
            }
        }
      }
      
      if(hasErrorInRow) {
         rowsSkippedForMissingMandatoryValue++;
         return null;
      }

      return entry as (Omit<T, 'id' | 'createdAt' | 'createdOn' | 'updatedOn'> & { rowIndexInExcel: number });
    });

    let filteredRows = mappedRows.filter(Boolean) as (Omit<T, 'id' | 'createdAt' | 'createdOn' | 'updatedOn'> & { rowIndexInExcel: number })[];

    if (dataType === 'salesForecast') {
      const forecastsBySku = new Map<string, any[]>();
      (filteredRows as unknown as ParsedSalesForecastUploadRow[]).forEach(row => {
        if (!row.sku) return;
        if (!forecastsBySku.has(row.sku)) {
          forecastsBySku.set(row.sku, []);
        }
        forecastsBySku.get(row.sku)!.push(row);
      });

      const finalRows: any[] = [];
      forecastsBySku.forEach((rows, sku) => {
        rows.sort((a,b) => a.rowIndexInExcel - b.rowIndexInExcel);
        const uniqueRanges: any[] = [];
        for (const row of rows) {
          const newStart = parseISO(row.startDate);
          const newEnd = parseISO(row.endDate);
          let isOverlapped = false;
          for (let i = 0; i < uniqueRanges.length; i++) {
            const existingStart = parseISO(uniqueRanges[i].startDate);
            const existingEnd = parseISO(uniqueRanges[i].endDate);
            // Check for overlap
            if (newStart <= existingEnd && newEnd >= existingStart) {
              // This new row overlaps or is identical to an existing unique one.
              // Replace the old one with this new one (from later in the file).
              uniqueRanges[i] = row;
              isOverlapped = true;
              break;
            }
          }
          if (!isOverlapped) {
            uniqueRanges.push(row);
          }
        }
        finalRows.push(...uniqueRanges);
      });
      filteredRows = finalRows;
    }


    return { parsedEntries: filteredRows, rowsSkippedForMissingMandatoryValue, parsingErrors };
  };
