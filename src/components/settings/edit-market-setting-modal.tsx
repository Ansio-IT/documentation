
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MarketSetting } from '@/lib/types';
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from '@/components/ui/scroll-area';

const marketSettingSchema = z.object({
  marketName: z.string().min(1, "Market Name is required"),
  currencySymbol: z.string().min(1, "Currency Symbol is required"),
  domainIdentifier: z.string().min(1, "Domain Identifier is required (e.g., https://www.amazon.com or www.amazon.com)"),
  isActive: z.boolean(),
});

type MarketSettingFormData = z.infer<typeof marketSettingSchema>;

interface EditMarketSettingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  marketSetting: MarketSetting | null;
  onUpdateMarketSetting: (settingId: string, data: Partial<MarketSettingFormData>) => Promise<boolean>;
}

export function EditMarketSettingModal({
  isOpen,
  onOpenChange,
  marketSetting,
  onUpdateMarketSetting,
}: EditMarketSettingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<MarketSettingFormData>({
    resolver: zodResolver(marketSettingSchema),
  });

  useEffect(() => {
    if (marketSetting && isOpen) {
      setValue('marketName', marketSetting.marketName);
      setValue('currencySymbol', marketSetting.currencySymbol);
      setValue('domainIdentifier', marketSetting.domainIdentifier);
      setValue('isActive', marketSetting.isActive);
    } else if (!isOpen) {
      reset({
        marketName: '',
        currencySymbol: '',
        domainIdentifier: '',
        isActive: true,
      }); 
    }
  }, [marketSetting, isOpen, setValue, reset]);

  const onSubmit = async (data: MarketSettingFormData) => {
    if (!marketSetting) return;
    setIsSubmitting(true);
    const success = await onUpdateMarketSetting(marketSetting.id, data);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!marketSetting) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit Market Setting</DialogTitle>
          <DialogDescription>
            Update the details for market: {marketSetting.marketName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[calc(100vh-250px)] p-1 pr-6">
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editMarketName">Market Name (e.g., US, EU)</Label>
                <Controller
                  name="marketName"
                  control={control}
                  render={({ field }) => <Input id="editMarketName" {...field} placeholder="UK" />}
                />
                {errors.marketName && <p className="text-sm text-destructive mt-1">{errors.marketName.message}</p>}
              </div>
              <div>
                <Label htmlFor="editCurrencySymbol">Currency Symbol</Label>
                <Controller
                  name="currencySymbol"
                  control={control}
                  render={({ field }) => <Input id="editCurrencySymbol" {...field} placeholder="£" />}
                />
                {errors.currencySymbol && <p className="text-sm text-destructive mt-1">{errors.currencySymbol.message}</p>}
              </div>
              <div>
                <Label htmlFor="editDomainIdentifier">Domain Identifier</Label>
                <Controller
                  name="domainIdentifier"
                  control={control}
                  render={({ field }) => <Input id="editDomainIdentifier" {...field} placeholder="https://www.amazon.co.uk or www.amazon.co.uk" />}
                />
                {errors.domainIdentifier && <p className="text-sm text-destructive mt-1">{errors.domainIdentifier.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">E.g., https://www.amazon.com or www.amazon.co.uk. Used for webhook matching and link construction.</p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="editIsActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="editIsActive" className="cursor-pointer">Is Active</Label>
                {errors.isActive && <p className="text-sm text-destructive mt-1">{errors.isActive.message}</p>}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
