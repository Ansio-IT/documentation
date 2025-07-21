
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Product, MarketSetting, ProductListingData, DepletionData } from '@/lib/types';
import {
  fetchProductByIdAction,
  fetchActiveMarketSettings,
  deleteCompetitorListingAction,
  fetchDepletionDataForProductAction, 
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetitorList, type DisplayCompetitor } from '@/components/competitor-list';
import { DeleteCompetitorLinkDialog } from '@/components/delete-competitor-link-dialog';
import { DepletionReportConfigModal } from '@/components/depletion-report-config-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, Home, Settings2, AlertCircle, Clock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [combinedDisplayItems, setCombinedDisplayItems] = useState<DisplayCompetitor[]>([]);
  const [activeMarketSettings, setActiveMarketSettings] = useState<MarketSetting[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [depletionData, setDepletionData] = useState<DepletionData | null>(null);
  const [isLoadingDepletionData, setIsLoadingDepletionData] = useState(true);

  const [isDeleteCompetitorDialogOpen, setIsDeleteCompetitorDialogOpen] = useState(false);
  const [selectedCompetitorForDelete, setSelectedCompetitorForDelete] = useState<{ listingId: string; asin?: string } | null>(null);
  const [isDepletionModalOpen, setIsDepletionModalOpen] = useState(false);

  const loadProductAndCompetitors = useCallback(async () => {
    if (!productId) return;
    setIsLoadingProduct(true);
    setError(null);
    try {
      const [fetchedProductData, fetchedMarketSettings] = await Promise.all([
        fetchProductByIdAction(productId),
        fetchActiveMarketSettings(),
      ]);
      setActiveMarketSettings(fetchedMarketSettings || []);

      if (fetchedProductData) {
        setProduct(fetchedProductData);

        const mainProductDisplayItem: DisplayCompetitor = {
          id: fetchedProductData.id,
          competitorListingId: `main-${fetchedProductData.id}`,
          isMainProduct: true,

          asinCode: fetchedProductData.asinCode,
          title: fetchedProductData.name || 'N/A',
          description: fetchedProductData.description,
          price: fetchedProductData.price,
          currency: fetchedProductData.currency,
          brand: fetchedProductData.brand,
          sellerName: fetchedProductData.sellerName,
          category: fetchedProductData.category,
          categories: fetchedProductData.categories,
          imageUrl: fetchedProductData.imageUrl,
          images: fetchedProductData.listingImages,
          url: fetchedProductData.url,
          
          marketName: fetchedProductData.market,
          currencySymbol: fetchedProductData.currency,
          marketDomainIdentifier: fetchedProductData.marketDomainIdentifier,
          managerName: fetchedProductData.primaryListingManagerName,
          
          rootBsCategory: fetchedProductData.rootBsCategory,
          rootBsRank: fetchedProductData.rootBsRank,
          bsCategory: fetchedProductData.bsCategory,
          bsRank: fetchedProductData.bsRank,
          subcategoryRanks: fetchedProductData.subcategoryRanks,
          
          initial_price: fetchedProductData.initial_price,
          deal_type: fetchedProductData.deal_type,
          ships_from: fetchedProductData.ships_from,
          buybox_seller: fetchedProductData.buybox_seller,
          delivery: fetchedProductData.delivery,
          
          attentionNeeded: fetchedProductData.attentionNeeded,
          dataAiHint: fetchedProductData.dataAiHint,
          targetAudience: fetchedProductData.targetAudience,
          keywords: fetchedProductData.keywords,
          lastUpdated: fetchedProductData.lastUpdated,
        };
        
        Object.keys(mainProductDisplayItem).forEach(key => {
            const typedKey = key as keyof DisplayCompetitor;
            if (mainProductDisplayItem[typedKey] === undefined) {
                delete mainProductDisplayItem[typedKey];
            }
        });

        const competitorProductListings = fetchedProductData.competitorListings || [];
        let displayItemsFromCompetitors: DisplayCompetitor[] = [];
        const mainProductPrimaryMarketName = mainProductDisplayItem.marketName;

        if (competitorProductListings.length > 0) {
          const allCompetitorDisplayItems = competitorProductListings.map((compListing) => {
            const competitorListingData = compListing.data || {};
            return {
              ...competitorListingData,
              id: compListing.id,
              competitorListingId: compListing.id,
              isMainProduct: false,
              marketName: competitorListingData.marketName,
              managerName: competitorListingData.managerName,
            };
          });

          if (mainProductPrimaryMarketName) {
            displayItemsFromCompetitors = allCompetitorDisplayItems.filter(
              (comp) => comp.marketName === mainProductPrimaryMarketName
            );
            if (displayItemsFromCompetitors.length < allCompetitorDisplayItems.length && allCompetitorDisplayItems.length > 0) {
                toast({
                    title: "Competitors Filtered",
                    description: `Showing competitors only from the primary market: ${mainProductPrimaryMarketName}. Other linked competitors exist in different markets.`,
                    duration: 7000,
                });
            }
          } else {
            displayItemsFromCompetitors = allCompetitorDisplayItems;
            if (allCompetitorDisplayItems.length > 0) {
                console.warn("Main product's primary market name could not be determined. Showing all linked competitors.");
            }
          }
        }
        setCombinedDisplayItems([mainProductDisplayItem, ...displayItemsFromCompetitors].filter(item => item.id || item.competitorListingId));
      } else {
        setError('Product not found.');
        toast({ title: "Error", description: "Product not found.", variant: "destructive" });
        setCombinedDisplayItems([]);
      }
    } catch (e) {
      console.error("Failed to fetch product or competitors:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Error Fetching Data", description: errorMessage, variant: "destructive" });
      setCombinedDisplayItems([]);
    } finally {
      setIsLoadingProduct(false);
    }
  }, [productId, toast]);

  const loadDepletionReportData = useCallback(async () => {
    if (!productId) return;
    setIsLoadingDepletionData(true);
    try {
        const data = await fetchDepletionDataForProductAction(productId);
        setDepletionData(data);
    } catch (e) {
        console.error("Failed to fetch depletion data:", e);
        // Optionally show a toast for depletion data fetch error if needed
        // toast({ title: "Error", description: "Could not load depletion report configuration.", variant: "destructive" });
        setDepletionData(null);
    } finally {
        setIsLoadingDepletionData(false);
    }
  }, [productId]);


  useEffect(() => {
    loadProductAndCompetitors();
    loadDepletionReportData();
  }, [loadProductAndCompetitors, loadDepletionReportData]);


  const handleOpenDeleteCompetitorLink = (listingId: string, competitorAsin?: string) => {
    setSelectedCompetitorForDelete({ listingId: listingId, asin: competitorAsin });
    setIsDeleteCompetitorDialogOpen(true);
  };

  const handleConfirmDeleteCompetitorLink = async () => {
    if (!selectedCompetitorForDelete || !product) return;

    const result = await deleteCompetitorListingAction(selectedCompetitorForDelete.listingId);
    if (result.success) {
      toast({ title: "Success", description: `Competitor listing for ASIN ${selectedCompetitorForDelete.asin || 'selected competitor'} deleted.` });
      loadProductAndCompetitors(); // Reload to update competitor list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleteCompetitorDialogOpen(false);
    setSelectedCompetitorForDelete(null);
  };
  
  const handleDepletionConfigSave = () => {
    loadDepletionReportData(); // Re-fetch depletion data after modal save
    loadProductAndCompetitors(); // Re-fetch product data as product.modifiedOn might change
  };


  const ProductSummaryCard = () => {
    if (!product || !product.id) return null;
    const displayName = product.name || product.productCode || 'N/A';
    const displayPrice = product.price;
    const displayManagerName = product.primaryListingManagerName || 'N/A';
    const displayAsin = product.asinCode || 'N/A';
    const displaySku = product.productCode || 'N/A';


    return (
      <div className="bg-card p-3 rounded-lg shadow-md flex flex-wrap items-center gap-x-4 lg:gap-x-6 gap-y-2 text-sm border">
        <div className="flex items-center gap-1.5" title={displayName}>
          <span className="font-medium text-muted-foreground">Product Name:</span>
          <span className="text-foreground truncate max-w-[150px] sm:max-w-[200px]">{displayName}</span>
        </div>
        <div className="flex items-center gap-1.5" title={displayAsin}>
          <span className="font-medium text-muted-foreground">ASIN:</span>
          {product.url && product.asinCode ? (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {product.asinCode}
            </a>
          ) : (
            <span className="text-foreground">{product.asinCode || 'N/A'}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5" title={displaySku}>
          <span className="font-medium text-muted-foreground">SKU:</span>
          <span className="text-foreground">{displaySku}</span>
        </div>
        <div className="flex items-center gap-1.5" title={`Price: ${(displayPrice ?? 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}`}>
          <span className="font-medium text-muted-foreground">Price:</span>
          <span className="text-foreground font-semibold">{(displayPrice ?? 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}</span>
        </div>
        <div className="flex items-center gap-1.5" title={displayManagerName}>
          <span className="font-medium text-muted-foreground">Manager:</span>
          <span className="text-foreground truncate max-w-[100px] sm:max-w-[150px]">{displayManagerName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive" className="text-xs whitespace-nowrap bg-red-100 text-red-700 border-red-300 hover:bg-red-200">Qty to Order: -</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive" className="text-xs whitespace-nowrap bg-red-100 text-red-700 border-red-300 hover:bg-red-200">Order by: -</Badge>
        </div>
        {product.lastUpdated && (
          <div className="flex items-center gap-1.5" title={`Last Updated: ${format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a")}`}>
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground">{format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a")}</span>
          </div>
        )}
      </div>
    );
  };


  if (isLoadingProduct || isLoadingDepletionData) {
    return (
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-72 w-full mb-8 flex-1" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 text-center flex-1 flex flex-col items-center justify-center">
        <p className="text-destructive text-xl mb-4">Error: {error}</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 md:p-6 text-center flex-1 flex flex-col items-center justify-center">
        <p className="text-muted-foreground text-xl">Product not found.</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }
  
  const isDepletionConfigured = depletionData && 
    ( (depletionData.salesTargets && depletionData.salesTargets.length > 0) ||
      (depletionData.localWarehouseLeadTime !== undefined && depletionData.localWarehouseLeadTime !== 14) || 
      (depletionData.reorderLeadTime !== undefined && depletionData.reorderLeadTime !== 100) || 
      (depletionData.associatedProducts && depletionData.associatedProducts.length > 0)
    );

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      <div className="p-4 md:p-6">
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <Button onClick={() => router.push('/')} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="text-sm text-muted-foreground flex items-center overflow-hidden">
            <Link href="/" className="hover:underline flex items-center">
              <Home className="h-4 w-4 mr-1.5 shrink-0" /> Retail Sales Portal
            </Link>
            <ChevronRight className="h-4 w-4 mx-1 shrink-0" />
            <span className="font-medium text-foreground truncate" title={product.name || 'Product Detail'}>
              {product.name && product.name.length > 35 ? `${product.name.substring(0,35)}...` : product.name || 'Product Detail'}
            </span>
          </div>
        </div>
        <ProductSummaryCard />
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 pb-4 md:pb-6">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-foreground">Product Comparison Details</h2>
            {product?.lastUpdated && (
                <p className="text-xs font-semibold text-muted-foreground">
                Last Updated: {format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a")}
                </p>
            )}
        </div>

        {combinedDisplayItems.length > 0 ? (
          <div className="min-h-0">
            <CompetitorList
              competitors={combinedDisplayItems}
              activeMarketSettings={activeMarketSettings}
              onDeleteCompetitorLink={handleOpenDeleteCompetitorLink}
            />
          </div>
        ) : (
          <div className="text-center py-10 bg-card rounded-lg border shadow-sm flex items-center justify-center">
            <p className="text-muted-foreground">No product data available for comparison.</p>
          </div>
        )}

        <Card className="mt-2">
          <CardHeader className="flex flex-row items-start justify-between pb-2"> 
            <CardTitle className="text-xl font-semibold">Depletion Report</CardTitle>
            <div className="flex flex-col items-end text-right">
              {isLoadingDepletionData ? (
                 <Skeleton className="h-4 w-36 mb-1.5" />
              ) : isDepletionConfigured && product?.modifiedOn ? (
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                  Last Updated: {format(new Date(product.modifiedOn), "MMM dd, yyyy, hh:mm a")}
                </p>
              ) : (
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                  Last Updated: Not configured
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsDepletionModalOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Configure Depletion Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Depletion report data will be displayed here once configured.
            </p>
          </CardContent>
        </Card>
      </div>
      <DeleteCompetitorLinkDialog
        isOpen={isDeleteCompetitorDialogOpen}
        onOpenChange={setIsDeleteCompetitorDialogOpen}
        competitorAsin={selectedCompetitorForDelete?.asin}
        onConfirmDelete={handleConfirmDeleteCompetitorLink}
      />
      {product && (
        <DepletionReportConfigModal
          isOpen={isDepletionModalOpen}
          onOpenChange={(open) => {
            setIsDepletionModalOpen(open);
            if (!open) handleDepletionConfigSave(); 
          }}
          productId={product.id}
          productName={product.name}
        />
      )}
    </div>
  );
}

