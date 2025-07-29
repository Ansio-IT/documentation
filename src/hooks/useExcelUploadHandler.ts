
"use client";

import { useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { StockEntry, MarketingDataEntry, ParsedProductListingUploadRow, ProductListingUploadError, ProductListingUploadSummary, ParsedSalesForecastUploadRow } from '@/lib/types';
import { useExcelParser } from './useExcelParser';
import { useBatchUploader } from './useBatchUploader';
import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client'; // Using client for potential client-side pre-checks if needed
import {
  BATCH_SIZE,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  ALLOWED_EXTENSIONS,
  type UploadType,
  UPLOAD_CONFIGS
} from '@/lib/uploadConstants';

interface UseExcelUploadHandlerProps {
  uploadType: UploadType;
  onUploadComplete: () => void;
  onModalClose: () => void;
}

interface ProcessingState {
  isProcessing: boolean;
  message: string;
  progress: number;
  errors: ProductListingUploadError[]; // Re-using this for generic error structure
}

export function useExcelUploadHandler({ uploadType, onUploadComplete, onModalClose }: UseExcelUploadHandlerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    message: '',
    progress: 0,
    errors: []
  });
  const { toast } = useToast();

  const config = UPLOAD_CONFIGS[uploadType];

  const updateProcessingState = useCallback((updates: Partial<ProcessingState>) => {
    setProcessingState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearFileSelection = useCallback(() => {
    setSelectedFile(null);
    setFileName(null);
  }, []);
  
  const resetHandlerState = useCallback(() => {
    clearFileSelection();
    updateProcessingState({ isProcessing: false, message: '', progress: 0, errors: [] });
  }, [clearFileSelection, updateProcessingState]);


  const handleFileSelected = useCallback((file: File | null) => {
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({ title: "File too large", description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB.`, variant: "destructive" });
        clearFileSelection();
        return;
      }
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        toast({ title: "Invalid file type", description: `Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}.`, variant: "destructive" });
        clearFileSelection();
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      updateProcessingState({ errors: [] });
    } else {
      clearFileSelection();
    }
  }, [toast, clearFileSelection, updateProcessingState]);

  const { parseFile } = useExcelParser(uploadType);
  const { uploadBatches } = useBatchUploader(uploadType);

  const performUpload = useCallback(async () => {
    if (!selectedFile) {
      toast({ title: "No File Selected", description: `Please select a file for ${uploadType}.`, variant: "destructive" });
      return;
    }

    updateProcessingState({ isProcessing: true, message: "Initiating upload...", progress: 0, errors: [] });
    console.log(`[ExcelUpload] Starting upload for type: ${uploadType}, file: ${selectedFile.name}`);

    let localParsingErrors: ProductListingUploadError[] = [];
    let rowsSkippedForMissingMandatory = 0;
    let totalSuccessfullyProcessed = 0; 
    let serverErrorsEncountered: ProductListingUploadError[] = []; 
    let rawDataToProcess: any[] = [];
    let duplicatesFound = 0;
    const duplicateEntriesLog: { type: string, key: string, excelRow: number, data: any }[] = [];

    const supabase: SupabaseClient = createClient(); // Client-side Supabase for actions

    try {
      updateProcessingState({ message: "Parsing file...", progress: 5 });
      const { parsedEntries, rowsSkippedForMissingMandatory: skipped, parsingErrors } = await parseFile(selectedFile);
      localParsingErrors.push(...parsingErrors);
      rowsSkippedForMissingMandatory = skipped;
      // Deduplication logic for specific types
      if (uploadType === 'advertisement') {
        const deduplicatedMap = new Map<string, Omit<MarketingDataEntry, 'id' | 'createdAt'> & { rowIndexInExcel: number }>();
        (parsedEntries as (Omit<MarketingDataEntry, 'id'|'createdAt'> & { rowIndexInExcel: number })[]).forEach(entry => {
          if (entry.date && entry.asin) { 
            const key = `${entry.date}-${entry.asin}`;
            if (deduplicatedMap.has(key)) {
              duplicatesFound++;
              duplicateEntriesLog.push({ type: 'advertisement', key: key, excelRow: entry.rowIndexInExcel, data: entry});
            }
            deduplicatedMap.set(key, entry);
          } else {
             localParsingErrors.push({rowIndexInExcel: entry.rowIndexInExcel || 0, error: `Ad entry skipped due to missing Date or ASIN.`});
          }
        });
        rawDataToProcess = Array.from(deduplicatedMap.values());
      } else { 
        rawDataToProcess = parsedEntries;
      }


      console.log(`[ExcelUpload] After parsing/deduplication: ${rawDataToProcess.length} entries to process. Duplicates found: ${duplicatesFound}.`);

      if (rawDataToProcess.length === 0) {
        let message = `No valid data found in ${uploadType} sheet to process.`;
        if (localParsingErrors.length > 0) message += ` ${localParsingErrors.length} parsing errors found.`;
        if (rowsSkippedForMissingMandatory > 0) message += ` ${rowsSkippedForMissingMandatory} rows skipped due to missing required values.`
        toast({ title: `No Data to Process`, description: message, variant: "destructive" });
        updateProcessingState({ isProcessing: false, message: "No valid data.", errors: localParsingErrors });
        onModalClose(); 
        return;
      }
      
      let batchProgress = 0;
      const onBatchProgress = (currentBatchNum: number, numBatches: number) => {
        batchProgress = Math.round((currentBatchNum / numBatches) * 90);
        updateProcessingState({
          message: `Processing batch ${currentBatchNum} of ${numBatches} for ${uploadType}...`,
          progress: 5 + batchProgress
        });
      };
      const { totalSuccessfullyProcessed: totalProcessed, serverErrorsEncountered: initialServerErrors, aggregatedSummary } = await uploadBatches(rawDataToProcess, onBatchProgress);
      totalSuccessfullyProcessed = totalProcessed;
      let serverErrors = initialServerErrors;
      if ((uploadType === 'productListing' || uploadType === 'salesForecast') && aggregatedSummary) {
        serverErrors = aggregatedSummary.errorsEncountered;
      }

      updateProcessingState({ progress: 100, message: "Processing complete!" });

      const allCombinedErrors = [
        ...localParsingErrors, 
        ...serverErrors
      ];
      console.log(`[ExcelUpload] Total successfully processed server-side: ${totalSuccessfullyProcessed}. Combined errors: ${allCombinedErrors.length}`);


      if (allCombinedErrors.length === 0) {
        let title = "Upload Processed";
        let description = "";

        if (rawDataToProcess.length === 0) { 
            title = "No Valid Data";
            description = `No data from ${uploadType} file to send to server after parsing.`;
        } else if (['productListing', 'salesForecast', 'salesReport_vc', 'salesReport_sc'].includes(uploadType) && aggregatedSummary) {
            title = `${UPLOAD_CONFIGS[uploadType].dataTypeForParser} Upload Complete`;
            description = `${aggregatedSummary.totalRowsProcessed} rows from file. ${totalSuccessfullyProcessed} successful.`;
            if (uploadType === 'productListing') {
              description += ` ${aggregatedSummary.productsCreated} new products. ${aggregatedSummary.listingsCreated} new listings. ${aggregatedSummary.cartonSpecsSaved} carton specs.`;
            }
        } else if (totalSuccessfullyProcessed > 0) {
            title = "Processing Complete";
            description = `File for ${uploadType} processed. ${totalSuccessfullyProcessed} entries were reported by the server (new or updated).`;
        } else { 
            title = "Processing Complete";
            description = `File for ${uploadType} processed. No new entries were reported by the server; existing records may have been updated or were already current.`;
        }
        
        console.log(`[ExcelUpload] Final Toast: Title: "${title}", Description: "${description}"`);
        toast({ title, description, duration: 10000 });
        onUploadComplete();
        setTimeout(() => { onModalClose(); resetHandlerState(); }, 2000);

      } else { 
        updateProcessingState({ errors: allCombinedErrors });
        let errorTitle = `${UPLOAD_CONFIGS[uploadType]?.dataTypeForParser || 'Data'} Processing Issues`;
        let errorDescription = `${allCombinedErrors.length} error(s) occurred.`;
        if (totalSuccessfullyProcessed > 0) {
            errorDescription += ` However, ${totalSuccessfullyProcessed} entries were still processed successfully.`;
        }
        errorDescription += " Check error details in the modal.";
        
        console.log(`[ExcelUpload] Final Toast (with errors): Title: "${errorTitle}", Description: "${errorDescription}"`);
        toast({
            title: errorTitle,
            description: errorDescription,
            variant: "destructive",
            duration: 10000
        });
         if (totalSuccessfullyProcessed > 0) onUploadComplete(); 
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown client-side processing error';
      console.error(`[ExcelUpload] Client-side upload error (${uploadType}):`, error);
      updateProcessingState({ errors: [{rowIndexInExcel:0, error: `Client-side ${uploadType} error: ${errorMessage}`}] });
      toast({ title: "Client Error", description: errorMessage, variant: "destructive" });
    } finally {
       setProcessingState(currentProcessingState => {
          if (currentProcessingState.isProcessing && currentProcessingState.errors.length > 0) {
              return { ...currentProcessingState, isProcessing: false };
          } else if (currentProcessingState.isProcessing) {
              return { ...currentProcessingState, isProcessing: false, message: '', progress: 0 };
          }
          return currentProcessingState; 
       });
    }
  }, [selectedFile, uploadType, toast, updateProcessingState, onUploadComplete, onModalClose, resetHandlerState, parseFile, uploadBatches]); 


  return {
    selectedFile,
    fileName,
    processingState,
    updateProcessingState,
    handleFileSelected,
    clearFileSelection,
    performUpload,
    resetHandlerState,
  };
}
