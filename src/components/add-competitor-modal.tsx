"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Product, ProductListing } from '@/lib/types'; 

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

const addCompetitorAsinsSchema = z.object({
  asins: z.string().min(1, "At least one ASIN is required."),
});

type AddCompetitorAsinsFormData = z.infer<typeof addCompetitorAsinsSchema>;

interface AddCompetitorModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product | null;
  onSaveCompetitors: (
    mainProductId: string,
    competitors: Array<{ asin: string; marketId: string; managerId: string }>,
    asinsToRemove?: string[]
  ) => Promise<boolean>;
}

function getExistingCompetitorAsins(product: Product | null): string {
  if (!product || !product.marketId) return '';
  return (product.product_listings || [])
    .filter(l => l.isCompetitor && l.marketId === product.marketId && l.asin)
    .map(l => l.asin!.toUpperCase())
    .join(', ');
}

export function AddCompetitorModal({
  isOpen,
  onOpenChange,
  product,
  onSaveCompetitors,
}: AddCompetitorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors, isValid } } = useForm<AddCompetitorAsinsFormData>({
    resolver: zodResolver(addCompetitorAsinsSchema),
    defaultValues: { asins: '' },
    mode: 'onChange',
  });

  useEffect(() => {
    if (isOpen) {
      reset({ asins: getExistingCompetitorAsins(product) });
    }
  }, [isOpen, product, reset]);

  const onSubmit = async (data: AddCompetitorAsinsFormData) => {
    if (!product) return;
    if (!product.marketId || !product.managerId) {
      toast({
        title: "Missing Product Information",
        description: "Cannot add competitors. Main product's primary market or manager is not defined.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
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
    // Compute existing competitor ASINs for this product/market
    const existingAsins = (product.product_listings || [])
      .filter(l => l.isCompetitor && l.marketId === product.marketId && l.asin)
      .map(l => l.asin!.toUpperCase());
    // Find ASINs to add and remove
    const asinsToAdd = asinArray.filter(asin => !existingAsins.includes(asin));
    const asinsToRemove = existingAsins.filter(asin => !asinArray.includes(asin));
    const competitorsToAdd = asinsToAdd.map(asin => ({
      asin: asin,
      marketId: product.marketId!,
      managerId: product.managerId!,
    }));
    // Call onSaveCompetitors with both add and remove lists
    const success = await onSaveCompetitors(product.id, competitorsToAdd, asinsToRemove);
    setIsSubmitting(false);
    if (success) {
      toast({
        title: "Competitors Updated",
        description: `${asinArray.length} competitor ASIN(s) are now linked to product '${product.name || product.productCode}' in market '${product.market || product.marketId}'.`,
      });
      onOpenChange(false);
    }
  };

  if (!product) return null;
  const formId = `add-competitor-form-${product.id}`;

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!isSubmitting) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-xl max-h-[600px] bg-card shadow-xl rounded-lg flex flex-col">
        <DialogHeader>
          <DialogTitle>Add/Update Competitor ASINs for <span className="text-primary">{product.name || product.productCode}</span></DialogTitle>
          <DialogDescription>
            Enter comma-separated ASINs. They will be linked to this product in its primary market ({product.market || 'N/A'}) and assigned to its primary manager ({product.primaryListingManagerName || 'N/A'}).
            Existing competitor ASINs for this market are pre-filled.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <form onSubmit={handleSubmit(onSubmit)} id={formId}>
            <div className="p-4 grid gap-4">
              <div>
                <Label htmlFor={`competitor-asins-${product.id}`}>Competitor ASINs (comma-separated)</Label>
                <Controller
                  name="asins"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      id={`competitor-asins-${product.id}`}
                      {...field}
                      rows={8}
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
          </form>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || !isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? "Saving..." : "Save Competitor Links"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
