
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { SalesTargetInput, SalesTarget, ProductDepletionCoreData, DepletionData } from '@/lib/types';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { CalendarIcon, PlusCircle, Trash2, Edit, Save } from 'lucide-react';
import { format, parseISO, isValid, addDays, startOfDay } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fetchDepletionDataForProductAction, saveDepletionDataForProductAction } from '@/app/actions';
import { SearchableMultiSelectSku } from '@/components/ui/searchable-multi-select-sku';

const depletionCoreFormSchema = z.object({
  associatedProducts: z.preprocess(
    (val) => (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) ? [] : val,
    z.union([
        z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)),
        z.array(z.string()).transform(arr => arr.map(s => String(s).trim()).filter(Boolean))
    ]).default([])
  ),
  localWarehouseLeadTime: z.coerce.number().int().nonnegative().default(14),
  reorderLeadTime: z.coerce.number().int().nonnegative().default(100),
});

const salesForecastInputSchema = z.object({
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
  salesForecast: z.coerce.number().int().positive({ message: "Daily sales forecast must be a positive number." }),
}).refine(data => data.endDate >= data.startDate, {
  message: "End date cannot be before start date.",
  path: ["endDate"],
});

type DepletionConfigFormData = z.infer<typeof depletionCoreFormSchema>;
type SalesForecastFormInput = z.infer<typeof salesForecastInputSchema>;

interface DepletionReportConfigModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  productId: string;
  productName?: string | null;
}

export function DepletionReportConfigModal({
  isOpen,
  onOpenChange,
  productId,
  productName,
}: DepletionReportConfigModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [salesTargets, setSalesTargets] = useState<SalesTargetInput[]>([]);
  const [editingSalesTarget, setEditingSalesTarget] = useState<SalesTargetInput | null>(null);
  const [editingSalesTargetIndex, setEditingSalesTargetIndex] = useState<number | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<DepletionConfigFormData>({
    resolver: zodResolver(depletionCoreFormSchema),
    defaultValues: {
      associatedProducts: [],
      localWarehouseLeadTime: 14,
      reorderLeadTime: 100,
    },
  });

  const { 
    control: salesTargetControl, 
    handleSubmit: handleSalesTargetSubmit, 
    reset: resetSalesTargetForm, 
    setValue: setSalesTargetValue,
    watch: watchSalesTarget,
    formState: { errors: salesTargetErrors, isValid: isSalesTargetFormValid }
  } = useForm<SalesForecastFormInput>({
    resolver: zodResolver(salesForecastInputSchema),
    mode: 'onChange',
    defaultValues: {
      startDate: startOfDay(new Date()),
      endDate: undefined, 
      salesForecast: 0,
    }
  });

  const watchedStartDate = watchSalesTarget("startDate");

  const loadDepletionData = useCallback(async () => {
    if (!productId || !isOpen) return;
    setIsLoading(true);
    let fetchedSalesTargets: SalesTargetInput[] = [];
    try {
      const depletionData = await fetchDepletionDataForProductAction(productId);
      if (depletionData) {
        reset({ 
          associatedProducts: depletionData.associatedProducts || [],
          localWarehouseLeadTime: depletionData.localWarehouseLeadTime ?? 14,
          reorderLeadTime: depletionData.reorderLeadTime ?? 100,
        });
        fetchedSalesTargets = (depletionData.salesTargets || []).map(st => ({
          ...st,
          startDate: st.startDate ? format(parseISO(st.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          endDate: st.endDate ? format(parseISO(st.endDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          salesForecast: st.salesForecast,
          clientId: st.id || Math.random().toString(36).substr(2, 9)
        })) as SalesTargetInput[];
        
      } else {
        reset({
          associatedProducts: [],
          localWarehouseLeadTime: 14,
          reorderLeadTime: 100,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load depletion settings and sales targets.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setSalesTargets(fetchedSalesTargets); 
      const lastTarget = fetchedSalesTargets.length > 0 ? fetchedSalesTargets[fetchedSalesTargets.length - 1] : null; 
      let defaultStartDate = lastTarget?.endDate ? addDays(parseISO(lastTarget.endDate), 1) : new Date();
      defaultStartDate = startOfDay(defaultStartDate);
      resetSalesTargetForm({ startDate: defaultStartDate, endDate: undefined, salesForecast: 0 });
    }
  }, [productId, isOpen, reset, toast, resetSalesTargetForm]);


  useEffect(() => {
    if (watchedStartDate && !editingSalesTarget) {
        const currentEndDate = watchSalesTarget("endDate");
        if (currentEndDate && currentEndDate < watchedStartDate) { 
            setSalesTargetValue("endDate", watchedStartDate);
        }
    }
  }, [watchedStartDate, setSalesTargetValue, watchSalesTarget, editingSalesTarget]);
  
  useEffect(() => {
    if (isOpen) {
      loadDepletionData();
    } else {
        reset({ associatedProducts: [], localWarehouseLeadTime: 14, reorderLeadTime: 100 });
        setSalesTargets([]);
        resetSalesTargetForm({ startDate: startOfDay(new Date()), endDate: undefined, salesForecast: 0 });
        setEditingSalesTarget(null);
        setEditingSalesTargetIndex(null);
        setIsSubmitting(false); 
    }
  }, [isOpen, reset, resetSalesTargetForm, loadDepletionData]);

  const onCoreSubmit = async (data: DepletionConfigFormData) => {
    setIsSubmitting(true);
    const coreDepletionDataToSave: ProductDepletionCoreData = {
        associatedProducts: data.associatedProducts, 
        localWarehouseLeadTime: data.localWarehouseLeadTime,
        reorderLeadTime: data.reorderLeadTime
    };
    const salesTargetsToSave = salesTargets.map(st => ({
        startDate: format(parseISO(st.startDate), 'yyyy-MM-dd'), 
        endDate: format(parseISO(st.endDate), 'yyyy-MM-dd'),     
        salesForecast: st.salesForecast
    } as SalesTargetInput)); 

    const result = await saveDepletionDataForProductAction(productId, coreDepletionDataToSave, salesTargetsToSave);
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const addOrUpdateSalesTarget = (data: SalesForecastFormInput) => {
    const newOrUpdatedTargetEntry: SalesTargetInput = {
      startDate: format(data.startDate, 'yyyy-MM-dd'),
      endDate: format(data.endDate, 'yyyy-MM-dd'),
      salesForecast: data.salesForecast,
      clientId: editingSalesTarget?.clientId || Math.random().toString(36).substr(2, 9)
    };

    let updatedSalesTargetsArray: SalesTargetInput[];
    if (editingSalesTarget && editingSalesTargetIndex !== null) {
      updatedSalesTargetsArray = [...salesTargets];
      updatedSalesTargetsArray[editingSalesTargetIndex] = newOrUpdatedTargetEntry;
      setEditingSalesTarget(null); 
      setEditingSalesTargetIndex(null);
    } else {
      updatedSalesTargetsArray = [...salesTargets, newOrUpdatedTargetEntry];
    }
    setSalesTargets(updatedSalesTargetsArray);

    const endDateOfProcessedItem = data.endDate; 
    let nextStartDateForForm = addDays(endDateOfProcessedItem, 1);
    nextStartDateForForm = startOfDay(nextStartDateForForm); 
        
    resetSalesTargetForm({ startDate: nextStartDateForForm, endDate: undefined, salesForecast: 0 });
  };

  const handleEditSalesTarget = (target: SalesTargetInput, index: number) => {
    setEditingSalesTarget(target);
    setEditingSalesTargetIndex(index);
    setSalesTargetValue("startDate", startOfDay(parseISO(target.startDate)));
    setSalesTargetValue("endDate", startOfDay(parseISO(target.endDate)));
    setSalesTargetValue("salesForecast", target.salesForecast);
  };

  const handleDeleteSalesTarget = (clientIdToDelete?: string) => {
    if (!clientIdToDelete) return;
    const newSalesTargets = salesTargets.filter(st => st.clientId !== clientIdToDelete);
    setSalesTargets(newSalesTargets);

    if (editingSalesTarget?.clientId === clientIdToDelete) {
        setEditingSalesTarget(null);
        setEditingSalesTargetIndex(null);
        const lastTarget = newSalesTargets.length > 0 ? newSalesTargets[newSalesTargets.length-1] : null; 
        let defaultStartDate = lastTarget?.endDate ? addDays(parseISO(lastTarget.endDate), 1) : new Date();
        defaultStartDate = startOfDay(defaultStartDate);
        resetSalesTargetForm({ startDate: defaultStartDate, endDate: undefined, salesForecast: 0 });
    }
  };
  
  const latestEndDateFormatted = useMemo(() => {
    if (!salesTargets || salesTargets.length === 0) {
      return null;
    }
    const sortedTargets = [...salesTargets].sort((a, b) => parseISO(b.endDate).getTime() - parseISO(a.endDate).getTime());
    const latestTarget = sortedTargets[0];
    
    if (!latestTarget || !latestTarget.endDate) return null;

    const date = parseISO(latestTarget.endDate);
    if (!isValid(date)) return null; 
    return format(date, "MMM dd, yyyy");
  }, [salesTargets]);

  const formId = "depletion-config-form";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle>Configure Depletion Report for {productName || `Product ID: ${productId}`}</DialogTitle>
          <DialogDescription>Set inventory logistics and daily sales forecasts for this product.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-6">Loading settings...</div>
        ) : (
        <ScrollArea className="flex-1 min-h-0 pr-6">
          <form onSubmit={handleSubmit(onCoreSubmit)} id={formId} className="space-y-6 py-4">
            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Inventory & Logistics</h3>
              <div>
                <Label htmlFor="associatedProducts">Associated Products (SKUs)</Label>
                <Controller
                  name="associatedProducts"
                  control={control}
                  render={({ field }) => (
                    <SearchableMultiSelectSku
                      value={field.value || []}
                      onChange={field.onChange}
                      placeholder="Search and select associated SKUs"
                      currentProductId={productId}
                    />
                  )}
                />
                {errors.associatedProducts && <p className="text-sm text-destructive mt-1">{errors.associatedProducts.message}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="localWarehouseLeadTime">Local Warehouse Lead Time (days)</Label>
                  <Controller
                    name="localWarehouseLeadTime"
                    control={control}
                    render={({ field }) => <Input id="localWarehouseLeadTime" type="number" min="0" {...field} />}
                  />
                  {errors.localWarehouseLeadTime && <p className="text-sm text-destructive mt-1">{errors.localWarehouseLeadTime.message}</p>}
                </div>
                <div>
                  <Label htmlFor="reorderLeadTime">Re-Ordering Lead Time (days)</Label>
                  <Controller
                    name="reorderLeadTime"
                    control={control}
                    render={({ field }) => <Input id="reorderLeadTime" type="number" min="0" {...field} />}
                  />
                  {errors.reorderLeadTime && <p className="text-sm text-destructive mt-1">{errors.reorderLeadTime.message}</p>}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Daily Sales Forecast Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <Label htmlFor="salesTargetStartDate">Start Date</Label>
                  <Controller
                    name="startDate"
                    control={salesTargetControl}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            disabled={!editingSalesTarget} 
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} initialFocus />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {salesTargetErrors.startDate && <p className="text-sm text-destructive mt-1">{salesTargetErrors.startDate.message}</p>}
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="salesTargetEndDate">End Date</Label>
                  <Controller
                    name="endDate"
                    control={salesTargetControl}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={field.value} onSelect={(date) => field.onChange(date ? startOfDay(date) : undefined)} disabled={{ before: watchedStartDate }} initialFocus />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {salesTargetErrors.endDate && <p className="text-sm text-destructive mt-1">{salesTargetErrors.endDate.message}</p>}
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="salesForecastValue">Daily Sales Forecast</Label> 
                  <Controller
                    name="salesForecast"
                    control={salesTargetControl}
                    render={({ field }) => <Input id="salesForecastValue" type="number" min="0" {...field} />}
                  />
                  {salesTargetErrors.salesForecast && <p className="text-sm text-destructive mt-1">{salesTargetErrors.salesForecast.message}</p>}
                </div>
                <Button type="button" onClick={handleSalesTargetSubmit(addOrUpdateSalesTarget)} disabled={!isSalesTargetFormValid} className="md:col-span-1 bg-accent text-accent-foreground hover:bg-accent/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {editingSalesTarget ? "Update Forecast" : "Add Forecast"}
                </Button>
              </div>

              {salesTargets.length > 0 && (
                <div className="mt-4 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Daily Sales Forecast</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesTargets.map((target, index) => (
                        <TableRow key={target.clientId}>
                          <TableCell>{format(parseISO(target.startDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell>{format(parseISO(target.endDate), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="text-right">{target.salesForecast.toLocaleString()}</TableCell> 
                          <TableCell className="text-center space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditSalesTarget(target, index)} className="h-7 w-7">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteSalesTarget(target.clientId)} className="h-7 w-7 text-destructive hover:text-destructive/80">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                     <TableCaption className="text-center py-2">
                      {latestEndDateFormatted ? (
                        <span className="font-bold" style={{ color: '#D92D20' }}> 
                          You’ve added daily sales forecast data up to {latestEndDateFormatted}.
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No daily sales forecasts added yet.
                        </span>
                      )}
                    </TableCaption>
                  </Table>
                </div>
              )}
            </section>
          </form>
        </ScrollArea>
        )}
        <DialogFooter className="pt-4 border-t mt-auto">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting || isLoading}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || isLoading || (isLoading === false && salesTargets.length === 0)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
