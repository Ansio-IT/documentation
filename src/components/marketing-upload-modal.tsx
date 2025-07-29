
"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { MarketingDataEntry } from '@/lib/types';
import { processAndStoreMarketingData } from '@/app/actions';
import { parseExcelSheet } from '@/lib/excelUtils';

// Constants
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv'];
const BATCH_SIZE = 500;

const marketingHeaderMapping: { [key: string]: keyof MarketingDataEntry } = {
  'DATE': 'date', 
  'ASIN': 'asin', 
  'Product Code': 'productCode', 
  'Product Description': 'productDescription',
  'Person': 'person', 
  'Portfolio': 'portfolio', 
  'Sub Portfolio': 'subPortfolio',
  'Total Qty Sold (SC + VC)': 'totalQtySold', 
  'Total Adv Units Sold': 'totalAdvUnitsSold',
  'Total Revenue Ex VAT (CP)': 'totalRevenueExVatCp', 
  'Total Sales Revenue Ex VAT (SP)': 'totalSalesRevenueExVatSp',
  'Total Adv Spend': 'totalAdvSpend', 
  'Total Adv Sales': 'totalAdvSales',
  'per unit Adv Spend on Total Qty Sold': 'perUnitAdvSpendOnTotalQtySold',
  'per unit Adv Spend on Adv Qty Sold': 'perUnitAdvSpendOnAdvQtySold',
  'Marketing%': 'marketingPercent', 
  'ACOS%': 'acosPercent',
  'Zero Adv Profit SC': 'zeroAdvProfitSc', 
  'Zero Adv Profit VC': 'zeroAdvProfitVc',
  'Total (SC + VC) Zero Adv Gross Profit': 'totalZeroAdvGrossProfit', 
  'Total GP': 'totalGp', 
  'GP%': 'gpPercent',
  'FBA Stock': 'fbaStock', 
  'BWW Actual Stock': 'bwwActualStock', 
  'VC Stock': 'vcStock',
  'Total Stock': 'totalStock', 
  'MOH': 'moh', 
  'Adv Marketplace': 'advMarketplace',
};

const marketingNumericFields: (keyof MarketingDataEntry)[] = [
  'totalQtySold', 'totalAdvUnitsSold', 'totalRevenueExVatCp', 'totalSalesRevenueExVatSp',
  'totalAdvSpend', 'totalAdvSales', 'perUnitAdvSpendOnTotalQtySold', 'perUnitAdvSpendOnAdvQtySold',
  'marketingPercent', 'acosPercent', 'zeroAdvProfitSc', 'zeroAdvProfitVc',
  'totalZeroAdvGrossProfit', 'totalGp', 'gpPercent', 'fbaStock', 'bwwActualStock',
  'vcStock', 'totalStock', 'moh'
];

interface MarketingUploadModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUploadComplete: () => void;
}

interface ProcessingState {
  isProcessing: boolean;
  message: string;
  progress: number;
  errors: string[];
}

export function MarketingUploadModal({ isOpen, onOpenChange, onUploadComplete }: MarketingUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    message: '',
    progress: 0,
    errors: []
  });
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation
  const validateFile = useCallback((file: File): string[] => {
    const errors: string[] = [];
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push(`Invalid file type. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }
    
    return errors;
  }, []);

  // Update processing state
  const updateProcessingState = useCallback((updates: Partial<ProcessingState>) => {
    setProcessingState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      toast({
        title: "Invalid File",
        description: validationErrors.join('. '),
        variant: "destructive"
      });
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, [validateFile, toast]);

  // Clear file selection
  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Process data in batches
  const processBatches = useCallback(async (data: Omit<MarketingDataEntry, 'id' | 'createdAt'>[]) => {
    const numBatches = Math.ceil(data.length / BATCH_SIZE);
    let totalProcessed = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE);
      const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
      
      updateProcessingState({
        message: `Processing batch ${currentBatch} of ${numBatches} (${chunk.length} entries)...`,
        progress: Math.round((currentBatch / numBatches) * 90) // Leave 10% for completion
      });

      try {
        const result = await processAndStoreMarketingData(chunk);
        
        if (result && typeof result.success === 'boolean') {
            if (result.success) {
                totalProcessed += result.count || 0;
            }
            if (result.errorsEncountered?.length) {
                allErrors.push(...result.errorsEncountered.map(e => (typeof e === 'string' ? e : e.message || String(e))));
            }
            if (!result.success && (!result.errorsEncountered || result.errorsEncountered.length === 0)) {
                allErrors.push(`Batch ${currentBatch} failed: ${result.message || 'Unknown server error during batch processing.'}`);
            }
        } else {
             allErrors.push(`Batch ${currentBatch} error: Unexpected response from server.`);
             console.error("Unexpected response from processAndStoreMarketingData for batch", currentBatch, result);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';
        allErrors.push(`Batch ${currentBatch} error: ${errorMessage}`);
      }
    }

    return { totalProcessed, allErrors };
  }, [updateProcessingState]);

  // Main upload handler
  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a marketing data file to upload.",
        variant: "destructive"
      });
      return;
    }

    updateProcessingState({
      isProcessing: true,
      message: "Starting file processing...",
      progress: 0,
      errors: []
    });

    try {
      // Parse file
      updateProcessingState({ message: "Parsing marketing data...", progress: 10 });
      
      const fileData = await selectedFile.arrayBuffer();
      const { 
        parsedEntries: rawData, 
        rowsSkippedForMissingMandatoryValue, 
        parsingErrors 
      } = parseExcelSheet<MarketingDataEntry>(
        fileData,
        marketingHeaderMapping,
        marketingNumericFields,
        'marketing',
        'date',
        'DATE'
      );

      // Handle parsing errors
      if (parsingErrors.length > 0) {
        updateProcessingState({
          errors: parsingErrors.map(e => `Parsing error: ${e}`)
        });
      }

      // Deduplicate data
      updateProcessingState({ message: "Deduplicating entries...", progress: 20 });
      
      const deduplicationMap = new Map<string, Omit<MarketingDataEntry, 'id' | 'createdAt'>>();
      let duplicatesFound = 0;

      rawData.forEach(entry => {
        if (entry.date && entry.asin) {
          const key = `${entry.date}-${entry.asin}`;
          if (deduplicationMap.has(key)) {
            duplicatesFound++;
          }
          deduplicationMap.set(key, entry);
        }
      });

      const deduplicatedData = Array.from(deduplicationMap.values());

      // Show warnings for skipped rows and duplicates
      if (rowsSkippedForMissingMandatoryValue > 0) {
        toast({
          title: "Rows Skipped",
          description: `${rowsSkippedForMissingMandatoryValue} rows skipped due to missing required data.`,
          duration: 6000
        });
      }

      if (duplicatesFound > 0) {
        toast({
          title: "Duplicates Found",
          description: `${duplicatesFound} duplicate entries found and merged (based on Date & ASIN).`,
          duration: 6000
        });
      }

      // Check if we have data to process
      if (deduplicatedData.length === 0) {
        toast({
          title: "No Valid Data",
          description: "No valid marketing data found in the file after processing.",
          variant: "destructive"
        });
        updateProcessingState({ isProcessing: false, message: "No valid data found." });
        clearFile();
        return;
      }

      // Process data in batches
      updateProcessingState({ message: "Processing data...", progress: 30 });
      
      const { totalProcessed, allErrors } = await processBatches(deduplicatedData);

      // Final progress update
      updateProcessingState({ progress: 100, message: "Processing complete!" });

      // Show results
      if (totalProcessed > 0) {
        toast({
          title: "Upload Successful",
          description: `Successfully processed ${totalProcessed} of ${deduplicatedData.length} marketing entries.`,
          duration: 7000
        });
        onUploadComplete();
      }

      if (allErrors.length > 0) {
        console.error("Marketing upload errors:", allErrors);
        updateProcessingState({ errors: allErrors });
        
        toast({
          title: "Processing Issues",
          description: `${allErrors.length} errors occurred. Check the error details below.`,
          variant: "destructive",
          duration: 10000
        });
      }

      if (totalProcessed === 0 && allErrors.length === 0 && parsingErrors.length === 0 && rowsSkippedForMissingMandatoryValue === 0 ) {
        // This case means deduplicatedData was empty, but no specific error was caught.
        // This toast is handled above if deduplicatedData.length === 0.
      } else if (totalProcessed === 0 && (allErrors.length > 0 || parsingErrors.length > 0 || rowsSkippedForMissingMandatoryValue > 0)) {
         toast({
          title: "Upload Failed",
          description: "No marketing entries were successfully processed due to errors or missing data.",
          variant: "destructive"
        });
      }


      // Close modal on success or if there are only informational toasts
      if ((totalProcessed > 0 && allErrors.length === 0 && parsingErrors.length === 0) || (totalProcessed === 0 && allErrors.length === 0 && parsingErrors.length === 0 && deduplicatedData.length === 0)) {
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      }


    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      console.error("Marketing upload error:", error);
      
      updateProcessingState({
        errors: [errorMessage]
      });
      
      toast({
        title: "Processing Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      // Reset processing state after a delay, unless there are errors to show
      if (processingState.errors.length === 0) {
        setTimeout(() => {
          updateProcessingState({
            isProcessing: false,
            message: '',
            progress: 0
          });
          clearFile();
        }, 3000);
      } else {
         updateProcessingState({ isProcessing: false });
      }
    }
  }, [selectedFile, toast, updateProcessingState, processBatches, onUploadComplete, onOpenChange, clearFile, processingState.errors.length]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (!processingState.isProcessing) {
      onOpenChange(false);
      // Reset state when closing
      setProcessingState({
        isProcessing: false,
        message: '',
        progress: 0,
        errors: []
      });
      clearFile();
    }
  }, [processingState.isProcessing, onOpenChange, clearFile]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl bg-card shadow-lg rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Upload Marketing Data Sheet
          </DialogTitle>
          <DialogDescription>
            Upload Excel or CSV file containing marketing data. Maximum file size: {MAX_FILE_SIZE_MB}MB.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="marketing-file-upload" className="font-medium">
              Marketing Data File
            </Label>
            <div className="flex items-center space-x-2">
              <Input
                id="marketing-file-upload"
                type="file"
                ref={fileInputRef}
                accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
                onChange={handleFileChange}
                className="hidden"
                disabled={processingState.isProcessing}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingState.isProcessing}
                className="flex-grow justify-start text-left"
              >
                <FileText className="mr-2 h-4 w-4" />
                {selectedFile?.name || `Choose file (${ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(', ')})`}
              </Button>
              {selectedFile && !processingState.isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Processing Status */}
          {processingState.isProcessing && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 border border-border rounded-md">
                <div className="flex items-center text-sm text-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <p>{processingState.message}</p>
                </div>
              </div>
              <Progress value={processingState.progress} className="w-full h-2" />
            </div>
          )}

          {/* Error Display */}
          {processingState.errors.length > 0 && !processingState.isProcessing && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Processing Errors:</p>
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {processingState.errors.slice(0, 5).map((error, index) => (
                      <li key={index} className="list-disc list-inside">
                        {error}
                      </li>
                    ))}
                    {processingState.errors.length > 5 && (
                      <li className="text-muted-foreground">
                        ...and {processingState.errors.length - 5} more errors
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={processingState.isProcessing}
          >
            {processingState.isProcessing ? "Processing..." : "Cancel"}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || processingState.isProcessing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
          >
            {processingState.isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
