
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Product, MarketSetting, ManagerSetting, ProductListingData, Keyword } from '@/lib/types';
import { fetchAllKeywordsAction } from '@/app/actions/keyword.actions';

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
import { SearchableMultiSelectKeyword } from '@/components/ui/searchable-multi-select-keyword';

// Schema for fields considered "core" to the product, potentially not all editable in this modal
const productCoreEditSchema = z.object({
  name: z.string().min(1, "Product Name is required").nullable().optional(),
  barcode: z.string().min(1, "Barcode/Primary Identifier is required").optional(),
  productCode: z.string().min(1, "Product Code (SKU) is required").optional(),
  portfolioId: z.string().optional().nullable(),
  properties: z.string().optional().nullable().refine(val => {
    if (!val || val.trim() === "") return true; 
    try { JSON.parse(val); return true; } catch { return false; }
  }, { message: "Properties must be valid JSON or empty" }),
  imageUrl: z.string().url("Must be a valid URL for core image").optional().or(z.literal('')).nullable(),
  description: z.string().max(1000, "Description cannot exceed 1000 characters").optional().nullable(),
  isActive: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
});

// Schema for fields specific to the primary listing being edited
const primaryListingEditSchema = z.object({
  marketId: z.string({ required_error: "Market for this listing is required."}).min(1, "Market for this listing is required."),
  managerId: z.string({ required_error: "Manager for this listing is required."}).min(1, "Manager for this listing is required."),
  asinCode: z.string().min(1, "ASIN for this market is required").optional().nullable(),
});

const combinedEditSchema = productCoreEditSchema.merge(primaryListingEditSchema);
type EditProductFormData = z.infer<typeof combinedEditSchema>;

interface EditProductModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product | null;
  onUpdateProduct: (
    productId: string,
    productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >>,
    primaryListingUpdates?: { managerId?: string; data?: Partial<ProductListingData> },
    marketIdForListing?: string
  ) => Promise<boolean>;
  markets: MarketSetting[];
  managers: ManagerSetting[];
}

export function EditProductModal({ isOpen, onOpenChange, product, onUpdateProduct, markets, managers }: EditProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableKeywords, setAvailableKeywords] = useState<Keyword[]>([]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid } 
  } = useForm<EditProductFormData>({
    resolver: zodResolver(combinedEditSchema),
    mode: 'onChange', 
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
        keywords: [],
      }
  });

  useEffect(() => {
    if (isOpen) {
        const loadKeywords = async () => {
            const keywords = await fetchAllKeywordsAction();
            setAvailableKeywords(keywords);
        };
        loadKeywords();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && product) {
      const primaryMarketListing = product.product_listings?.find(l => !l.isCompetitor && l.marketId === product.marketId) || product.product_listings?.find(l => !l.isCompetitor);

      reset({
        name: product.name || '',
        barcode: product.barcode || '',
        productCode: product.productCode || '',
        portfolioId: product.portfolioId || '',
        properties: product.properties ? JSON.stringify(product.properties, null, 2) : '',
        imageUrl: product.imageUrl || '', 
        description: product.description || '',
        isActive: product.isActive !== undefined ? product.isActive : true,
        
        marketId: product.marketId || primaryMarketListing?.marketId || undefined, 
        managerId: product.managerId || primaryMarketListing?.managerId || undefined,
        asinCode: product.asinCode || primaryMarketListing?.asin || '',
        keywords: product.keywords || [],
      });
    }
  }, [isOpen, product, reset]);

  const onSubmit = async (data: EditProductFormData) => {
    if (!product) return;
    setIsSubmitting(true);

    const productCoreDataToUpdate: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >> = {};
    
    // Check which core fields have changed
    if (data.name !== product.name) productCoreDataToUpdate.name = data.name;
    if (data.description !== product.description) productCoreDataToUpdate.description = data.description;
    if (data.imageUrl !== product.imageUrl) productCoreDataToUpdate.imageUrl = data.imageUrl;
    
    // Check if keywords have changed
    const originalKeywords = (product.keywords || []).sort();
    const newKeywords = (data.keywords || []).sort();
    if (JSON.stringify(originalKeywords) !== JSON.stringify(newKeywords)) {
      productCoreDataToUpdate.keywords = data.keywords;
    }
    
    const primaryListingUpdatesPayload: { managerId?: string; data?: Partial<ProductListingData> } = {};
    let hasListingSpecificUpdates = false;
    
    const originalPrimaryListing = product.product_listings?.find(l => !l.isCompetitor && l.marketId === product.marketId) || product.product_listings?.find(l => !l.isCompetitor);

    if (data.managerId && data.managerId !== (originalPrimaryListing?.managerId || product.managerId)) {
        primaryListingUpdatesPayload.managerId = data.managerId;
        hasListingSpecificUpdates = true;
    }
    
    const listingSpecificDataUpdates: Partial<ProductListingData> = {};
    if (data.asinCode !== (originalPrimaryListing?.asin || product.asinCode)) {
      listingSpecificDataUpdates.asin = data.asinCode || null;
      hasListingSpecificUpdates = true;
    }
    if (data.name && data.name !== (originalPrimaryListing?.productName || product.name)) {
      listingSpecificDataUpdates.title = data.name;
      hasListingSpecificUpdates = true;
    }

    if (Object.keys(listingSpecificDataUpdates).length > 0) {
        primaryListingUpdatesPayload.data = listingSpecificDataUpdates;
        hasListingSpecificUpdates = true;
    }

    const marketIdForListingToUpdate = data.marketId;
    if (!marketIdForListingToUpdate) {
        console.error("Market ID is missing for listing update.");
        setIsSubmitting(false);
        return;
    }
    
    const success = await onUpdateProduct(
        product.id,
        productCoreDataToUpdate,
        hasListingSpecificUpdates ? primaryListingUpdatesPayload : undefined,
        marketIdForListingToUpdate
    );

    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  const formId = "update-product-form"; 

  if (!product) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card shadow-xl rounded-lg flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Update Product: {product.name || product.productCode}</DialogTitle>
          <DialogDescription>
            Update primary market listing information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0 w-full max-w-[800px] mx-auto my-2 border rounded-md">
          <form onSubmit={handleSubmit(onSubmit)} id={formId}>
            <div className="p-6 grid gap-4">
              <h3 className="text-lg font-semibold mb-1 mt-0 border-b pb-2">Primary Market Listing Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="updateMarketId_listing">Market (Primary Listing)</Label>
                     <Controller
                        name="marketId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <SelectTrigger id="updateMarketId_listing">
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
                     {errors.marketId && <p className="text-sm text-destructive mt-1">{errors.marketId.message}</p>}
                </div>
                <div>
                    <Label htmlFor="updateManagerId_listing">Manager for this Listing</Label>
                    <Controller name="managerId" control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                        <SelectTrigger id="updateManagerId_listing"><SelectValue placeholder="Select manager" /></SelectTrigger>
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
                <Label htmlFor="updateAsinCode_listing">ASIN for this Market</Label>
                <Controller name="asinCode" control={control} render={({ field }) => <Input id="updateAsinCode_listing" {...field} value={field.value ?? ''} placeholder="e.g., B08N5HR77W" />} />
                {errors.asinCode && <p className="text-sm text-destructive mt-1">{errors.asinCode.message}</p>}
              </div>

               <div className="mt-4">
                <Label htmlFor="keywords">Keywords for this Product</Label>
                 <Controller
                    name="keywords"
                    control={control}
                    render={({ field }) => (
                        <SearchableMultiSelectKeyword
                            value={field.value || []}
                            onChange={field.onChange}
                            availableKeywords={availableKeywords}
                            placeholder="Select product keywords..."
                        />
                    )}
                />
                {errors.keywords && <p className="text-sm text-destructive mt-1">{errors.keywords.message}</p>}
              </div>
              
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting || !isDirty || !isValid} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? "Updating..." : "Update Listing Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
