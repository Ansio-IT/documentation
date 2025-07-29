
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { UploadCloud, FileText, X, Loader2, AlertTriangle, Download, Calendar as CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useExcelUploadHandler } from '@/hooks/useExcelUploadHandler';
import type { UploadType, ProductListingUploadError } from '@/lib/types';
import { UPLOAD_CONFIGS, MAX_FILE_SIZE_MB, ALLOWED_EXTENSIONS } from '@/lib/uploadConstants';
import { downloadErrorCSV } from '@/lib/uploadErrorUtils';
import * as XLSX from 'xlsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { processStocksReportUploadBatchAction } from '@/app/actions/stocks-report.actions';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseExcelSheet } from '@/lib/excelUtils';

interface UploadExcelModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUploadComplete: () => void;
}

type ExtendedUploadType = UploadType | 'keywordAndSov' | 'brandAnalytics' | 'salesReport' | 'stocksReport';

export function UploadExcelModal({ isOpen, onOpenChange, onUploadComplete }: UploadExcelModalProps) {
  const [currentUploadType, setCurrentUploadType] = useState<ExtendedUploadType>('stocksReport');
  const [salesReportSubType, setSalesReportSubType] = useState<'vc' | 'sc'>('vc');
  const [stocksReportSubType, setStocksReportSubType] = useState<'bww' | 'vc' | 'sc_fba'>('bww');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const effectiveUploadType = currentUploadType === 'salesReport' ? `salesReport_${salesReportSubType}` as UploadType : (currentUploadType as UploadType);

  const {
    selectedFile,
    fileName,
    processingState,
    updateProcessingState,
    handleFileSelected,
    performUpload,
    resetHandlerState,
  } = useExcelUploadHandler({
    uploadType: effectiveUploadType,
    onUploadComplete,
    onModalClose: () => onOpenChange(false),
  });

  useEffect(() => {
    if (!isOpen) {
      resetHandlerState();
      setStocksReportSubType('bww');
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen, resetHandlerState]);


  const handleDialogClose = () => {
    if (!processingState.isProcessing) {
      onOpenChange(false);
    }
  };

  const getHelpText = () => {
    if (currentUploadType === 'stocksReport') {
        const subType = stocksReportSubType;
        const configKey = subType ? `stocksReport_${subType}` as UploadType : null;
        if (configKey && UPLOAD_CONFIGS[configKey]) {
            const config = UPLOAD_CONFIGS[configKey];
             let help = `Mandatory: '${config.mandatoryName || 'N/A'}'. Headers in first row.`;
            if (config.secondaryMandatoryKeys) {
                help += config.secondaryMandatoryKeys.map(sec => ` Also required: '${sec.name}'`).join('.');
            }
            return help;
        }
        return "Select a stock report type to see requirements.";
    }
    const config = UPLOAD_CONFIGS[effectiveUploadType as UploadType];
    if (!config) return "Select an upload type.";
    let help = `Mandatory: '${config.mandatoryName || 'N/A'}'. Headers in first row.`;
    if (config.secondaryMandatoryKeys) {
        help += config.secondaryMandatoryKeys.map(sec => ` Also required: '${sec.name}'`).join('.');
    }
    return help;
  };

  const handleMainUpload = async () => {
    if (currentUploadType === 'stocksReport') {
      handleStocksReportUpload();
    } else {
      performUpload();
    }
  };

  const { toast } = useToast();

  const handleStocksReportUpload = async () => {
    if (!selectedFile) {
        toast({ title: 'No File Selected', description: 'Please select a file.', variant: 'destructive' });
        return;
    }
    if (!stocksReportSubType) {
        toast({ title: 'Stock Type Required', description: 'Please select a stock report type (BWW, VC, or SC FBA).', variant: 'destructive' });
        return;
    }
    
    updateProcessingState({ isProcessing: true, message: 'Starting stocks report processing...', progress: 0, errors: [] });
    
    try {
        const effectiveStocksUploadType = `stocksReport_${stocksReportSubType}` as UploadType;
        const config = UPLOAD_CONFIGS[effectiveStocksUploadType];

        const { parsedEntries, rowsSkippedForMissingMandatory, parsingErrors } = await parseExcelSheet(
            await selectedFile.arrayBuffer(), config.mapping, config.numericFields, config.dataTypeForParser, config.mandatoryKey, config.mandatoryName, config.secondaryMandatoryKeys
        );

        if (parsingErrors.length > 0) {
            updateProcessingState({ errors: parsingErrors.map(e => ({ error: e })), isProcessing: false });
            return;
        }

        if (parsedEntries.length === 0) {
            toast({ title: 'No Data Found', description: `No valid data to process. ${rowsSkippedForMissingMandatory} rows were skipped due to missing required values.`, variant: 'destructive' });
            updateProcessingState({ isProcessing: false });
            return;
        }
        
        updateProcessingState({ message: `Processing ${parsedEntries.length} entries...`, progress: 50 });
        const result = await processStocksReportUploadBatchAction(parsedEntries, stocksReportSubType);

        if (result.errors.length > 0) {
            updateProcessingState({ errors: result.errors, progress: 100, isProcessing: false });
            toast({ title: 'Upload Complete with Errors', description: `${result.count} entries succeeded. ${result.errors.length} failed. See modal for details.`, variant: 'destructive' });
        } else {
            updateProcessingState({ message: 'Upload successful!', progress: 100, isProcessing: false });
            toast({ title: 'Upload Successful', description: `${result.count} stock entries processed.` });
            onUploadComplete();
            setTimeout(() => onOpenChange(false), 1500);
        }

    } catch (e: any) {
        updateProcessingState({ errors: [{ error: `An unexpected error occurred: ${e.message}` }], isProcessing: false });
        toast({ title: 'Upload Failed', description: e.message, variant: 'destructive' });
    }
  };


  const isFormDisabled = processingState.isProcessing;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-xl bg-card shadow-lg rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Upload Data Sheet
          </DialogTitle>
          <DialogDescription>
            Select upload type and attach your Excel or CSV file. Max file size: {MAX_FILE_SIZE_MB}MB.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="upload-type-select" className="font-medium">Upload Type</Label>
            <Select
              value={currentUploadType}
              onValueChange={(value: ExtendedUploadType) => {
                setCurrentUploadType(value);
                resetHandlerState();
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={isFormDisabled}
            >
              <SelectTrigger id="upload-type-select" className="mt-1">
                <SelectValue placeholder="Select upload type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stocksReport">Update Stock Levels (BWW/VC/FBA)</SelectItem>
                <SelectItem value="advertisement">Advertisement Details</SelectItem>
                <SelectItem value="productListing">Product + Listing Template</SelectItem>
                <SelectItem value="salesForecast">Sales Forecast</SelectItem>
                <SelectItem value="salesReport">Sales Report (VC/SC)</SelectItem>
                <SelectItem value="keyword">Keyword Master</SelectItem>
                <SelectItem value="brandAnalytics">Brand Analytics File</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentUploadType === 'salesReport' && (
            <div className="space-y-2 border-t pt-4">
              <Label className="font-medium">Sales Report Type</Label>
              <RadioGroup value={salesReportSubType} onValueChange={(v: 'vc' | 'sc') => setSalesReportSubType(v)} className="mt-2 flex gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="vc" id="sub-vc" disabled={isFormDisabled} /><Label htmlFor="sub-vc">VC Sales</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sc" id="sub-sc" disabled={isFormDisabled} /><Label htmlFor="sub-sc">SC Sales</Label></div>
              </RadioGroup>
            </div>
          )}

          {currentUploadType === 'stocksReport' && (
             <div className="space-y-2 border-t pt-4">
              <Label className="font-medium">Stocks Report Type</Label>
              <RadioGroup value={stocksReportSubType || undefined} onValueChange={(v: 'bww' | 'vc' | 'sc_fba') => setStocksReportSubType(v)} className="mt-2 flex gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="bww" id="stock-bww" disabled={isFormDisabled} /><Label htmlFor="stock-bww">BWW Stock</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="vc" id="stock-vc" disabled={isFormDisabled} /><Label htmlFor="stock-vc">VC Stock</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="sc_fba" id="stock-sc" disabled={isFormDisabled} /><Label htmlFor="stock-sc">SC FBA Stock</Label></div>
              </RadioGroup>
            </div>
          )}

            <div className="space-y-1">
              <Label htmlFor="data-file-upload" className="font-medium">
                Upload File
              </Label>
              <div className="flex items-center space-x-2">
                <Input id="data-file-upload" type="file" ref={fileInputRef} accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')} onChange={(e) => handleFileSelected(e.target.files?.[0] || null)} className="hidden" disabled={isFormDisabled} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isFormDisabled} className="flex-grow justify-start text-left">
                  <FileText className="mr-2 h-4 w-4" />
                  {fileName || "Choose file..."}
                </Button>
                {selectedFile && !isFormDisabled && ( <Button variant="ghost" size="icon" onClick={() => { handleFileSelected(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={isFormDisabled} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></Button> )}
              </div>
              <p className="text-xs text-muted-foreground pt-1">{getHelpText()}</p>
            </div>


          {processingState.isProcessing && (
            <div className="mt-2 space-y-2">
                <div className="p-3 bg-muted/50 border border-border rounded-md"><div className="flex items-center text-sm text-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /><p>{processingState.message || "Processing..."}</p></div></div>
                <Progress value={processingState.progress} className="w-full h-2" />
            </div>
          )}
          {processingState.errors.length > 0 && !processingState.isProcessing && (
            <Alert variant="destructive" className="mt-2"><AlertTriangle className="h-4 w-4" /><AlertDescription><div className="flex items-center justify-between"><p className="font-medium">{processingState.errors.length} error(s) occurred.</p>{(<Button onClick={() => downloadErrorCSV(processingState.errors, effectiveUploadType)} variant="link" size="sm" className="h-auto p-0 text-destructive hover:text-destructive/80"><Download className="mr-1 h-3.5 w-3.5" />Error Report</Button>)}</div><ul className="text-xs list-disc list-inside pl-1 mt-1 max-h-24 overflow-y-auto">{processingState.errors.slice(0,5).map((err, idx) => (<li key={idx} className="truncate" title={String(err.error)}>{(err as ProductListingUploadError).rowIndexInExcel > 0 ? `Row ${(err as ProductListingUploadError).rowIndexInExcel}: ` : ''}{String(err.error).substring(0,100)}</li>))}{processingState.errors.length > 5 && <p className="text-xs text-muted-foreground mt-1">...and {processingState.errors.length - 5} more errors.</p>}</ul></AlertDescription></Alert>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleDialogClose} disabled={isFormDisabled}>
            {isFormDisabled ? "Please wait" : "Cancel"}
          </Button>
          <Button
            onClick={handleMainUpload}
            disabled={
                isFormDisabled ||
                !selectedFile ||
                (currentUploadType === 'stocksReport' && !stocksReportSubType)
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[100px]"
          >
            {isFormDisabled ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isFormDisabled ? "Processing..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
