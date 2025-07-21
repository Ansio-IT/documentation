
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Product, MarketSetting, ManagerSetting } from '@/lib/types'; 

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from './ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';


const addCompetitorAsinsSchema = z.object({
  asins: z.string().min(1, "At least one ASIN is required."),
  marketId: z.string({ required_error: "Market for competitor listings is required."}).min(1, "Market for competitor listings is required."),
  managerId: z.string({ required_error: "Manager for competitor listings is required."}).min(1, "Manager for competitor listings is required."),
});

type AddCompetitorAsinsFormData = z.infer<typeof addCompetitorAsinsSchema>;

interface AddCompetitorModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product | null;
  onSaveCompetitors: (mainProductId: string, competitors: Array<{ asinCode: string; marketId: string; managerId: string; }>) => Promise<boolean>;
  activeMarkets: MarketSetting[];
  activeManagers: ManagerSetting[]; // Added for manager selection
}

export function AddCompetitorModal({ 
    isOpen, 
    onOpenChange, 
    product, 
    onSaveCompetitors,
    activeMarkets,
    activeManagers // Added
}: AddCompetitorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors, isValid } } = useForm<AddCompetitorAsinsFormData>({
    resolver: zodResolver(addCompetitorAsinsSchema),
    defaultValues: {
      asins: '',
      marketId: undefined,
      managerId: undefined,
    },
    mode: 'onChange' 
  });

  useEffect(() => {
    if (isOpen) {
      reset({ asins: '', marketId: undefined, managerId: undefined }); 
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: AddCompetitorAsinsFormData) => {
    if (!product) return;

    const asinArray = data.asins
      .split(',')
      .map(asin => asin.trim().toUpperCase())
      .filter(Boolean);

    if (asinArray.length === 0) {
      toast({
        title: "No ASINs Entered",
        description: "Please enter at least one valid ASIN.",
        variant: "destructive",
      });
      return;
    }
    
    const invalidAsins = asinArray.filter(asin => !/^[A-Z0-9]{10}$/i.test(asin));
    if (invalidAsins.length > 0) {
        toast({
            title: "Invalid ASIN Format",
            description: `The following ASINs appear invalid: ${invalidAsins.join(', ')}. ASINs should be 10 alphanumeric characters.`,
            variant: "destructive",
        });
        return;
    }

    setIsSubmitting(true);
    const competitorsToSave = asinArray.map(asin => ({ 
        asinCode: asin, 
        marketId: data.marketId,
        managerId: data.managerId // Pass managerId
    }));
    const success = await onSaveCompetitors(product.id, competitorsToSave);
    setIsSubmitting(false);

    if (success) {
      toast({
        title: "Competitors Linked",
        description: `${competitorsToSave.length} competitor ASIN(s) have been linked for ${product.name}.`,
      });
      onOpenChange(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isSubmitting) onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px] bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle>Add Competitor ASINs for <span className="text-primary">{product.name}</span></DialogTitle>
          <DialogDescription>
            Enter comma-separated ASINs, select the market, and assign a manager for these competitor listings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[calc(100vh-280px)] p-1 pr-6">
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="competitor-marketId">Market for Competitor Listings</Label>
                <Controller
                  name="marketId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger id="competitor-marketId">
                        <SelectValue placeholder="Select market" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeMarkets.map(market => (
                          <SelectItem key={market.id} value={market.id}>{market.marketName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.marketId && <p className="text-sm text-destructive mt-1">{errors.marketId.message}</p>}
              </div>
              <div>
                <Label htmlFor="competitor-managerId">Manager for Competitor Listings</Label>
                <Controller
                  name="managerId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger id="competitor-managerId">
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeManagers.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.managerId && <p className="text-sm text-destructive mt-1">{errors.managerId.message}</p>}
              </div>
              <div>
                <Label htmlFor="competitor-asins">Competitor ASINs (comma-separated)</Label>
                <Controller
                  name="asins"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      id="competitor-asins"
                      {...field}
                      rows={5}
                      placeholder="e.g., B07XJ8C8F5, B082XY23K9, B01N1SE4EP"
                      className="mt-1"
                    />
                  )}
                />
                {errors.asins && (
                  <p className="text-sm text-destructive mt-1">{errors.asins.message}</p>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-6">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? "Saving..." : "Save Competitor Links"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
