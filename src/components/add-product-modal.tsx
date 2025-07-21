
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Product, MarketSetting, ManagerSetting, ProductListingData } from '@/lib/types';

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from './ui/scroll-area';

const productCoreSchema = z.object({
  name: z.string().min(1, "Product Name is required").nullable(),
  barcode: z.string().min(1, "Barcode/Primary Identifier is required"),
  productCode: z.string().min(1, "Product Code (SKU) is required"),
  portfolioId: z.string().optional().nullable(),
  properties: z.string().optional().nullable().refine(val => {
    if (!val) return true;
    try { JSON.parse(val); return true; } catch { return false; }
  }, { message: "Properties must be valid JSON or empty" }),
  imageUrl: z.string().url("Must be a valid URL for core image").optional().or(z.literal('')).nullable(),
  isActive: z.boolean().default(true),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
});

const initialListingSchema = z.object({
    marketId: z.string({ required_error: "Market is required" }).min(1, "Market is required"),
    managerId: z.string({ required_error: "Manager is required."}).min(1, "Manager is required"), // Moved from core to listing, made required
    asinCode: z.string({ required_error: "ASIN for this market is required"}).min(1, "ASIN for this market is required"),
    listingImageUrl: z.string().url("Must be a valid URL for listing image").optional().or(z.literal('')).nullable(),
});

const combinedSchema = productCoreSchema.merge(initialListingSchema);

type AddProductFormData = z.infer<typeof combinedSchema>;

interface AddProductModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddProduct: (
    productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'competitorListings' | 'primaryListingManagerName' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId'>,
    initialListing: { marketId: string; managerId: string; data: Partial<Omit<ProductListingData, 'price'>> }
  ) => Promise<boolean>;
  markets: MarketSetting[];
  managers: ManagerSetting[];
}

export function AddProductModal({ isOpen, onOpenChange, onAddProduct, markets, managers }: AddProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<AddProductFormData>({
    resolver: zodResolver(combinedSchema),
    defaultValues: {
      name: '',
      barcode: '',
      productCode: '',
      portfolioId: '',
      properties: '',
      imageUrl: '',
      isActive: true,
      description: '',
      marketId: undefined,
      managerId: undefined,
      asinCode: '',
      listingImageUrl: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        barcode: '',
        productCode: '',
        portfolioId: '',
        properties: '',
        imageUrl: '',
        isActive: true,
        description: '',
        marketId: undefined,
        managerId: undefined,
        asinCode: '',
        listingImageUrl: '',
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: AddProductFormData) => {
    setIsSubmitting(true);
    let parsedProperties: Record<string, any> | null = null;
    if (data.properties && data.properties.trim() !== "") {
        try {
            parsedProperties = JSON.parse(data.properties);
        } catch (e) {
            console.error("Invalid JSON for properties", e);
            setIsSubmitting(false);
            // TODO: Show toast for invalid JSON
            return;
        }
    }

    const coreProductData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'competitorListings' | 'primaryListingManagerName' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'managerId'> = {
      name: data.name,
      barcode: data.barcode,
      productCode: data.productCode,
      portfolioId: data.portfolioId === '' ? null : data.portfolioId,
      description: data.description || null,
      properties: parsedProperties,
      imageUrl: data.imageUrl || null,
      isActive: data.isActive,
    };

    const initialListingPayload: { marketId: string; managerId: string; data: Partial<Omit<ProductListingData, 'price'>> } = {
      marketId: data.marketId,
      managerId: data.managerId,
      data: {
        asinCode: data.asinCode,
        imageUrl: data.listingImageUrl || undefined,
        title: data.name || undefined,
      }
    };
    
    Object.keys(initialListingPayload.data).forEach(key => {
        const typedKey = key as keyof typeof initialListingPayload.data;
        if (initialListingPayload.data[typedKey] === undefined) {
            delete initialListingPayload.data[typedKey];
        }
    });

    const success = await onAddProduct(coreProductData, initialListingPayload);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };
  
  const formId = "add-product-form";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-card shadow-xl rounded-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Fill in core product details and initial market listing information. Price will be populated by sync.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0"> {/* ScrollArea is now the flex-grow element */}
          <form onSubmit={handleSubmit(onSubmit)} id={formId} className="h-full"> {/* Added h-full to make the form take full height */}
            <div className="p-4 grid gap-4"> {/* Content wrapper with padding */}
              <h3 className="text-lg font-semibold mb-1 border-b pb-2 sticky top-0 bg-card z-10">Core Product Details</h3> {/* Added sticky for header visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} value={field.value ?? ''} placeholder="e.g., Smart Home Hub X1" />} />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="productCode">Product Code (SKU)</Label>
                  <Controller name="productCode" control={control} render={({ field }) => <Input id="productCode" {...field} placeholder="e.g., PROD001" />} />
                  {errors.productCode && <p className="text-sm text-destructive mt-1">{errors.productCode.message}</p>}
                </div>
              </div>
              <div>
                  <Label htmlFor="barcode">Barcode (Primary Identifier)</Label>
                  <Controller name="barcode" control={control} render={({ field }) => <Input id="barcode" {...field} placeholder="e.g., 1234567890123" />} />
                  {errors.barcode && <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>}
              </div>
               <div>
                <Label htmlFor="portfolioId">Portfolio ID (Optional)</Label>
                <Controller name="portfolioId" control={control} render={({ field }) => <Input id="portfolioId" {...field} value={field.value ?? ''} placeholder="e.g., Portfolio UUID" />} />
                {errors.portfolioId && <p className="text-sm text-destructive mt-1">{errors.portfolioId.message}</p>}
              </div>
              <div>
                <Label htmlFor="imageUrl">Core Product Image URL (Optional)</Label>
                <Controller name="imageUrl" control={control} render={({ field }) => <Input id="imageUrl" {...field} value={field.value ?? ''} placeholder="https://example.com/core-image.png" />} />
                {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
              </div>
              <div>
                <Label htmlFor="properties">Properties (JSON format, Optional)</Label>
                <Controller name="properties" control={control} render={({ field }) => <Textarea id="properties" {...field} value={field.value ?? ''} placeholder='e.g., {"color": "blue", "size": "large"}' rows={3} />} />
                {errors.properties && <p className="text-sm text-destructive mt-1">{errors.properties.message}</p>}
              </div>
              <div>
                <Label htmlFor="description">Core Description (Optional)</Label>
                <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} value={field.value ?? ''} placeholder="Brief description of the product" rows={3} />} />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Controller name="isActive" control={control} render={({ field }) => ( <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} /> )} />
                <Label htmlFor="isActive" className="cursor-pointer">Product is Active</Label>
              </div>

              <h3 className="text-lg font-semibold mb-1 mt-6 border-b pb-2 sticky top-[calc(1.5rem+28px)] bg-card z-10">Initial Market Listing</h3> {/* Adjusted sticky position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor="marketId_initial">Market</Label>
                      <Controller name="marketId" control={control} render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                          <SelectTrigger id="marketId_initial"><SelectValue placeholder="Select market" /></SelectTrigger>
                          <SelectContent>
                              {(markets || []).filter(Boolean).map(market => (
                              <SelectItem key={market.id} value={market.id}>{market.marketName}</SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                      )} />
                      {errors.marketId && <p className="text-sm text-destructive mt-1">{errors.marketId.message}</p>}
                  </div>
                  <div>
                      <Label htmlFor="managerId_listing">Manager (for this Listing)</Label>
                      <Controller
                        name="managerId"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger id="managerId_listing"><SelectValue placeholder="Select manager" /></SelectTrigger>
                            <SelectContent>
                              {(managers || []).filter(Boolean).map(manager => (
                                <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.managerId && <p className="text-sm text-destructive mt-1">{errors.managerId.message}</p>}
                  </div>
              </div>
              <div>
                  <Label htmlFor="asinCode_initial">ASIN for this Market</Label>
                  <Controller name="asinCode" control={control} render={({ field }) => <Input id="asinCode_initial" {...field} placeholder="e.g., B08N5HR77W" />} />
                  {errors.asinCode && <p className="text-sm text-destructive mt-1">{errors.asinCode.message}</p>}
              </div>
              <div>
                  <Label htmlFor="listingImageUrl_initial">Listing Image URL (Optional)</Label>
                  <Controller name="listingImageUrl" control={control} render={({ field }) => <Input id="listingImageUrl_initial" {...field} value={field.value ?? ''} placeholder="https://example.com/listing-image.png" />} />
                  {errors.listingImageUrl && <p className="text-sm text-destructive mt-1">{errors.listingImageUrl.message}</p>}
              </div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t"> {/* Footer is now sibling to ScrollArea */}
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? "Adding..." : "Add Product & Listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
