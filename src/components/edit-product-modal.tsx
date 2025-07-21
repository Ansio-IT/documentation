
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

const productCoreEditSchema = z.object({
  name: z.string().min(1, "Product Name is required").nullable().optional(),
  barcode: z.string().min(1, "Barcode/Primary Identifier is required").optional(),
  productCode: z.string().min(1, "Product Code (SKU) is required").optional(),
  portfolioId: z.string().optional().nullable(),
  properties: z.string().optional().nullable().refine(val => {
    if (!val || val.trim() === "") return true; // Allow empty string
    try { JSON.parse(val); return true; } catch { return false; }
  }, { message: "Properties must be valid JSON or empty" }),
  imageUrl: z.string().url("Must be a valid URL for core image").optional().or(z.literal('')).nullable(),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  isActive: z.boolean().optional(),
});

const primaryListingEditSchema = z.object({
  managerId: z.string({ required_error: "Manager for this listing is required."}).min(1, "Manager for this listing is required."),
  marketId: z.string().optional(),
  asinCode: z.string().min(1, "ASIN for this market is required").optional().nullable(),
  price: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? undefined : parseFloat(String(val)),
    z.number({ invalid_type_error: "Price must be a number" }).positive("Price must be positive").optional()
  ).nullable(),
  listingImageUrl: z.string().url("Must be a valid URL for listing image").optional().or(z.literal('')).nullable(),
});

const combinedEditSchema = productCoreEditSchema.merge(primaryListingEditSchema);
type EditProductFormData = z.infer<typeof combinedEditSchema>;

interface EditProductModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product | null;
  onUpdateProduct: (
    productId: string,
    productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings'>>,
    primaryListingUpdates?: { managerId?: string; data?: Partial<ProductListingData> },
    marketIdForListing?: string
  ) => Promise<boolean>;
  markets: MarketSetting[];
  managers: ManagerSetting[];
}

export function EditProductModal({ isOpen, onOpenChange, product, onUpdateProduct, markets, managers }: EditProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isValid } // Ensured errors is destructured
  } = useForm<EditProductFormData>({
    resolver: zodResolver(combinedEditSchema),
    mode: 'onChange', // To enable isDirty and isValid
    defaultValues: {
        name: '',
        barcode: '',
        productCode: '',
        portfolioId: '',
        properties: '',
        imageUrl: '',
        description: '',
        isActive: true,
        managerId: undefined,
        marketId: undefined,
        asinCode: '',
        price: undefined,
        listingImageUrl: ''
      }
  });

  useEffect(() => {
    if (isOpen && product) {
      reset();
      setValue('name', product.name || '');
      setValue('barcode', product.barcode || '');
      setValue('productCode', product.productCode || '');
      setValue('portfolioId', product.portfolioId || '');
      setValue('properties', product.properties ? JSON.stringify(product.properties, null, 2) : '');
      setValue('imageUrl', product.imageUrl || '');
      setValue('description', product.description || '');
      setValue('isActive', product.isActive !== undefined ? product.isActive : true);

      const primaryMarketListing = product.product_listings?.find(l => !l.is_competitor);
      setValue('marketId', primaryMarketListing?.market_id || undefined); // Should be marketId from listing
      setValue('managerId', primaryMarketListing?.manager_id || undefined);
      setValue('asinCode', primaryMarketListing?.data?.asinCode || '');
      setValue('price', primaryMarketListing?.data?.price ?? undefined);
      setValue('listingImageUrl', primaryMarketListing?.data?.imageUrl || '');
    }
  }, [isOpen, product, reset, setValue, markets, managers]);

  const onSubmit = async (data: EditProductFormData) => {
    if (!product) return;
    setIsSubmitting(true);

    let parsedProperties: Record<string, any> | null = null;
    if (data.properties && data.properties.trim() !== "") {
        try { parsedProperties = JSON.parse(data.properties); } catch (e) { setIsSubmitting(false); console.error("Invalid JSON for properties", e); return; }
    }

    const coreProductUpdates: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' >> = {};

    if (data.name !== product.name) coreProductUpdates.name = data.name;
    if (data.barcode !== product.barcode) coreProductUpdates.barcode = data.barcode;
    if (data.productCode !== product.productCode) coreProductUpdates.productCode = data.productCode;
    const newPortfolioId = data.portfolioId === '' ? null : data.portfolioId;
    if (newPortfolioId !== product.portfolioId) coreProductUpdates.portfolioId = newPortfolioId;
    const currentPropertiesString = product.properties ? JSON.stringify(product.properties, null, 2) : '';
    if (data.properties !== currentPropertiesString) coreProductUpdates.properties = parsedProperties;
    if (data.imageUrl !== product.imageUrl) coreProductUpdates.imageUrl = data.imageUrl || null;
    if (data.description !== product.description) coreProductUpdates.description = data.description || null;
    if (data.isActive !== product.isActive) coreProductUpdates.isActive = data.isActive;

    const primaryListingUpdatesPayload: { managerId?: string; data?: Partial<ProductListingData> } = {};
    let hasListingSpecificUpdates = false;

    const originalPrimaryListing = product.product_listings?.find(l => !l.is_competitor);
    const marketIdForListingUpdate = originalPrimaryListing?.market_id;

    if (data.managerId && data.managerId !== originalPrimaryListing?.manager_id) {
        primaryListingUpdatesPayload.managerId = data.managerId;
        hasListingSpecificUpdates = true;
    }

    const listingSpecificDataUpdates: Partial<ProductListingData> = {};
    if (data.asinCode !== undefined && data.asinCode !== (originalPrimaryListing?.data?.asinCode || '')) listingSpecificDataUpdates.asinCode = data.asinCode;
    if (data.price !== undefined && data.price !== (originalPrimaryListing?.data?.price ?? undefined)) listingSpecificDataUpdates.price = data.price;
    if (data.listingImageUrl !== undefined && data.listingImageUrl !== (originalPrimaryListing?.data?.imageUrl || '')) listingSpecificDataUpdates.imageUrl = data.listingImageUrl || undefined;

    if (Object.keys(listingSpecificDataUpdates).length > 0) {
        primaryListingUpdatesPayload.data = listingSpecificDataUpdates;
        hasListingSpecificUpdates = true;
    }

    const success = await onUpdateProduct(
        product.id,
        coreProductUpdates,
        hasListingSpecificUpdates ? primaryListingUpdatesPayload : undefined,
        marketIdForListingUpdate
    );
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const formId = "edit-product-form";

  if (!product) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-card shadow-xl rounded-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Product: {product.name || product.barcode}</DialogTitle>
          <DialogDescription>
            Update core product details and its primary market listing information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <form onSubmit={handleSubmit(onSubmit)} id={formId}>
            <div className="p-4 grid gap-4">
              <h3 className="text-lg font-semibold mb-1 border-b pb-2">Core Product Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="editName">Product Name</Label>
                    <Controller name="name" control={control} render={({ field }) => <Input id="editName" {...field} value={field.value ?? ''} />} />
                    {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div>
                    <Label htmlFor="editProductCode">Product Code (SKU)</Label>
                    <Controller name="productCode" control={control} render={({ field }) => <Input id="editProductCode" {...field} value={field.value ?? ''} />} />
                    {errors.productCode && <p className="text-sm text-destructive mt-1">{errors.productCode.message}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="editBarcode">Barcode (Primary Identifier)</Label>
                <Controller name="barcode" control={control} render={({ field }) => <Input id="editBarcode" {...field} value={field.value ?? ''} />} />
                {errors.barcode && <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>}
              </div>
              <div>
                <Label htmlFor="editPortfolioId">Portfolio ID (Optional)</Label>
                <Controller name="portfolioId" control={control} render={({ field }) => <Input id="editPortfolioId" {...field} value={field.value ?? ''} placeholder="e.g., Portfolio UUID" />} />
                {errors.portfolioId && <p className="text-sm text-destructive mt-1">{errors.portfolioId.message}</p>}
              </div>
              <div>
                <Label htmlFor="editImageUrl">Core Product Image URL</Label>
                <Controller name="imageUrl" control={control} render={({ field }) => <Input id="editImageUrl" {...field} value={field.value ?? ''} placeholder="https://example.com/core-image.png" />} />
                {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
              </div>
              <div>
                <Label htmlFor="editProperties">Properties (JSON format, Optional)</Label>
                <Controller name="properties" control={control} render={({ field }) => <Textarea id="editProperties" {...field} value={field.value ?? ''} placeholder='e.g., {"color": "blue", "size": "large"}' rows={3} />} />
                {errors.properties && <p className="text-sm text-destructive mt-1">{errors.properties.message}</p>}
              </div>
              <div>
                <Label htmlFor="editDescription">Core Description</Label>
                <Controller name="description" control={control} render={({ field }) => <Textarea id="editDescription" {...field} value={field.value ?? ''} rows={3} />} />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Controller name="isActive" control={control} render={({ field }) => ( <Switch id="editIsActive" checked={field.value} onCheckedChange={field.onChange} /> )} />
                <Label htmlFor="editIsActive" className="cursor-pointer">Product is Active</Label>
                {errors.isActive && <p className="text-sm text-destructive mt-1">{errors.isActive.message}</p>}
              </div>

              <h3 className="text-lg font-semibold mb-1 mt-6 border-b pb-2">Primary Market Listing Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="editManagerId_listing">Manager for this Listing</Label>
                    <Controller name="managerId" control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger id="editManagerId_listing"><SelectValue placeholder="Select manager" /></SelectTrigger>
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
                <div>
                    <Label htmlFor="editMarketId_listing">Market (Primary Listing)</Label>
                     <Controller
                        name="marketId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''} disabled>
                                <SelectTrigger id="editMarketId_listing">
                                    <SelectValue placeholder="Select market" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(markets || []).filter(Boolean).map(market => (
                                        <SelectItem key={market.id} value={market.id}>
                                            {market.marketName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Market for the primary listing cannot be changed here.</p>
                     {errors.marketId && <p className="text-sm text-destructive mt-1">{errors.marketId.message}</p>}
                </div>
              </div>
              <div>
                    <Label htmlFor="editAsinCode_listing">ASIN for this Market</Label>
                    <Controller name="asinCode" control={control} render={({ field }) => <Input id="editAsinCode_listing" {...field} value={field.value ?? ''} />} />
                    {errors.asinCode && <p className="text-sm text-destructive mt-1">{errors.asinCode.message}</p>}
              </div>
              <div>
                    <Label htmlFor="editPrice_listing">Price for this Market</Label>
                    <Controller name="price" control={control} render={({ field }) => <Input id="editPrice_listing" type="number" step="0.01" {...field} value={field.value ?? ''} />} />
                    {errors.price && <p className="text-sm text-destructive mt-1">{errors.price.message}</p>}
              </div>
              <div>
                    <Label htmlFor="editListingImageUrl_listing">Image URL for this Listing</Label>
                    <Controller name="listingImageUrl" control={control} render={({ field }) => <Input id="editListingImageUrl_listing" {...field} value={field.value ?? ''} />} />
                    {errors.listingImageUrl && <p className="text-sm text-destructive mt-1">{errors.listingImageUrl.message}</p>}
              </div>
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || !isDirty || !isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
