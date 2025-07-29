
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Product, MarketSetting, ProductListingData, StockEntry, SortingState as ClientSortingState, DepletionData, TopKeyword, KeywordMetricsMap, KeywordMetric, FetchTopKeywordsParams, FetchKeywordMetricsParams, AssociatedStockItem } from '@/lib/types';
import { fetchProductByIdAction } from '@/app/actions/product.actions';
// import { fetchStockDataByProductCodeAction } from '@/app/actions/stock.actions';
import { fetchDepletionDataForProductAction } from '@/app/actions/depletion.actions';
import { deleteCompetitorListingAction } from '@/app/actions/competitor.actions';
import { fetchActiveMarketSettings } from '@/app/actions/market-settings.actions';
import { fetchTopKeywordsAction, fetchKeywordMetricsForAsinsAction } from '@/app/actions/keyword.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DeleteCompetitorLinkDialog } from '@/components/delete-competitor-link-dialog';
import { DepletionReportConfigModal } from '@/components/depletion-report-config-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ChevronRight, Home, Settings2, AlertCircle, Clock, Loader2, Package, Trash2, Star, Tag, Building, Truck, CalendarCheck2, DollarSign, MapPin, Users as ManagerIcon, BarChart3, Archive, TrendingUp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, addDays, parse, isSameDay, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getDisplayCurrencySymbol, getMarketBadgeTailwindColor } from '@/lib/marketUtils';
import { CompetitorList, DisplayCompetitor } from '@/components/competitor-list';
import type { SortingState } from '@tanstack/react-table';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import ProductSummaryCard from '@/components/ProductSummaryCard';
import ProductStockInfoCard from '@/components/ProductStockInfoCard';
import {
  getIsoCurrencyCode,
  calculateDiscountPercent,
  constructAmazonUrl,
  getDeliveryInfo,
  getRankForCategoryDisplay,
  getSortableRankForCategory
} from '@/lib/productUtils';
import { fetchProductStockDetailsAction } from '@/app/actions/stock.actions';


export default function ProductDetailPage() {
  const paramsFromHook = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const isMobile = useIsMobile();

  const [product, setProduct] = useState<Product | null>(null);
  const [rawCombinedDisplayItems, setRawCombinedDisplayItems] = useState<DisplayCompetitor[]>([]);
  const [activeMarketSettings, setActiveMarketSettings] = useState<MarketSetting[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [depletionData, setDepletionData] = useState<DepletionData | null>(null);
  const [isLoadingDepletionData, setIsLoadingDepletionData] = useState(true);

  const [stockInfo, setStockInfo] = useState<StockEntry | null>(null);
  const [isLoadingStockInfo, setIsLoadingStockInfo] = useState(true);
  const [stockSorting, setStockSorting] = useState<SortingState>([]);


  const [showAssociatedProductsStock, setShowAssociatedProductsStock] = useState(false);
  const [associatedProductsStockData, setAssociatedProductsStockData] = useState<AssociatedStockItem[]>([]);
  const [isLoadingAssociatedStock, setIsLoadingAssociatedStock] = useState(false);


  const [isDeleteCompetitorDialogOpen, setIsDeleteCompetitorDialogOpen] = useState(false);
  const [selectedCompetitorForDelete, setSelectedCompetitorForDelete] = useState<{ listingId: string; asin?: string } | null>(null);
  const [isDepletionModalOpen, setIsDepletionModalOpen] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [topKeywords, setTopKeywords] = useState<TopKeyword[]>([]);
  const [keywordMetrics, setKeywordMetrics] = useState<KeywordMetricsMap>({});
  const [isLoadingKeywordsOrMetrics, setIsLoadingKeywordsOrMetrics] = useState(false);
  const [selectedMetricsDate, setSelectedMetricsDate] = useState<Date>(new Date());
  const [selectedPlacement, setSelectedPlacement] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const memoizedProductId = useMemo(() => {
    const pidSource = paramsFromHook.productId;
    if (typeof pidSource === 'string' && pidSource.trim() !== '') {
        return pidSource.trim();
    }
    if (Array.isArray(pidSource) && typeof pidSource[0] === 'string' && pidSource[0].trim() !== '') {
        return pidSource[0].trim();
    }
    return undefined;
  }, [paramsFromHook.productId]);


  const loadStockInformation = useCallback(async (productId?: string | null) => {
    if (!productId) {
      setIsLoadingStockInfo(false);
      setStockInfo(null);
      return;
    }
    setIsLoadingStockInfo(true);
    try {
      const data = await fetchProductStockDetailsAction(productId);
      setStockInfo(data);
    } catch (e) {
      console.error(`Failed to fetch stock info for product ${productId}:`, e);
      toast({ title: "Error", description: "Could not load stock information.", variant: "destructive" });
      setStockInfo(null);
    } finally {
      setIsLoadingStockInfo(false);
    }
  }, [toast]);

  useEffect(() => {
    const fetchAssociatedStock = async () => {
      if (showAssociatedProductsStock && product?.associatedProducts && product.associatedProducts.length > 0) {
        setIsLoadingAssociatedStock(true);
        const stockPromises = product.associatedProducts.map(async (assocProductId) => {
          try {
            const [assocProduct, stockData] = await Promise.all([
                fetchProductByIdAction(assocProductId),
                fetchProductStockDetailsAction(assocProductId)
            ]);
            return {
              productId: assocProductId,
              productCode: assocProduct?.productCode ?? 'N/A',
              stockEntry: stockData,
              productName: assocProduct?.name || assocProduct?.productCode || 'N/A',
              brand: assocProduct?.brand || "N/A",
              asinCode: assocProduct?.asinCode || "N/A",
            };
          } catch (e) {
            console.error(`Failed to fetch stock or details for associated product ${assocProductId}:`, e);
            return {
              productId: assocProductId,
              productCode: 'Error',
              stockEntry: null,
              productName: `Product ID: ${assocProductId}`,
              brand: "N/A",
              asinCode: "N/A",
            };
          }
        });
        const results = await Promise.all(stockPromises);
        setAssociatedProductsStockData(results);
        setIsLoadingAssociatedStock(false);
      } else {
        setAssociatedProductsStockData([]);
      }
    };

    fetchAssociatedStock();
  }, [showAssociatedProductsStock, product?.associatedProducts, toast]);

  const loadProductAndCompetitors = useCallback(async () => {
    if (!memoizedProductId) {
        console.warn("[ProductDetailPage] loadProductAndCompetitors: memoizedProductId is not yet available or invalid. Current value:", memoizedProductId);
        setIsLoadingProduct(true); 
        return;
    }
    setIsLoadingProduct(true);
    setError(null);
    try {
      const [fetchedProductData, fetchedMarketSettings] = await Promise.all([
        fetchProductByIdAction(memoizedProductId),
        fetchActiveMarketSettings(),
      ]);
      setActiveMarketSettings(fetchedMarketSettings || []);
      if (fetchedProductData) {
        setProduct(fetchedProductData);
        if (fetchedProductData.id) {
          loadStockInformation(fetchedProductData.id);
        } else {
          setIsLoadingStockInfo(false);
          setStockInfo(null);
        }

        const mainProductDisplayItem: DisplayCompetitor = {
          id: fetchedProductData.id,
          competitorListingId: `main-${fetchedProductData.id}`,
          isMainProduct: true,
          productCode: fetchedProductData.productCode,
          asinCode: fetchedProductData.asinCode,
          product_name: fetchedProductData.name || 'N/A',
          brand: fetchedProductData.brand || 'N/A',
          current_price: fetchedProductData.price ?? null,
          list_price: fetchedProductData.listPrice ?? null,
          discount: fetchedProductData.discount ?? (typeof fetchedProductData.listPrice === 'number' && typeof fetchedProductData.price === 'number' && fetchedProductData.listPrice > 0 ? Math.round(((fetchedProductData.listPrice - fetchedProductData.price) / fetchedProductData.price) * 100) : null),
          deal_type: fetchedProductData.dealType || '',
          category_ranks: fetchedProductData.categoryRanks || null,
          dispatched_from: fetchedProductData.dispatchedFrom || '',
          sold_by: fetchedProductData.soldBy || '',
          delivery_info: fetchedProductData.deliveryInfo ? [fetchedProductData.deliveryInfo] : [],
          imageUrl: fetchedProductData.imageUrl,
          url: fetchedProductData.url,
          marketName: fetchedProductData.market,
          currencySymbol: fetchedProductData.currency,
          marketDomainIdentifier: fetchedProductData.marketDomainIdentifier,
          managerName: fetchedProductData.primaryListingManagerName,
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
        const mainProductPrimaryMarketId = fetchedProductData.marketId;


        if (competitorProductListings.length > 0) {
            const allCompetitorDisplayItems: DisplayCompetitor[] = competitorProductListings.map((compListing) => {
              const dataFields = (compListing as any).data || {};
              const flatCompetitor = {
                ...dataFields,
                ...compListing,
                id: compListing.id,
                competitorListingId: compListing.id,
                isMainProduct: false,
                productCode: null,
                asinCode: compListing.asin ?? null,
                product_name: compListing.productName || dataFields.productName || dataFields.title || 'N/A',
                brand: compListing.brand || dataFields.brand || 'N/A',
                current_price: compListing.currentPrice ?? dataFields.currentPrice ?? null,
                list_price: compListing.listPrice ?? dataFields.listPrice ?? null,
                discount: compListing.discount ?? dataFields.discount ?? (typeof compListing.listPrice === 'number' && typeof compListing.currentPrice === 'number' && compListing.listPrice > 0 ? Math.round(((compListing.listPrice - compListing.currentPrice) / compListing.listPrice) * 100) : null),
                deal_type: (compListing.dealType ?? dataFields.dealType) || '',
                category_ranks: (compListing.categoryRanks ?? dataFields.categoryRanks) || null,
                dispatched_from: (compListing.dispatchedFrom ?? dataFields.dispatchedFrom) || '',
                sold_by: (compListing.soldBy ?? dataFields.soldBy) || '',
                delivery_info: compListing.deliveryInfo ? [compListing.deliveryInfo] : (dataFields.deliveryInfo ? [dataFields.deliveryInfo] : []),
                imageUrl: dataFields.imageUrl || '',
                url: dataFields.url || '',
                marketName: compListing.marketName || dataFields.marketName || '',
                currencySymbol: compListing.currencySymbol || dataFields.currencySymbol || '',
                marketDomainIdentifier: compListing.marketDomainIdentifier || dataFields.marketDomainIdentifier || '',
                managerName: compListing.managerName || dataFields.managerName || '',
                lastUpdated: dataFields.lastUpdated || '',
              };
              delete (flatCompetitor as any).data;
              return flatCompetitor as unknown as DisplayCompetitor;
            });
            
          if (mainProductPrimaryMarketId) {
            displayItemsFromCompetitors = allCompetitorDisplayItems.filter(
              (comp) => comp.marketId === mainProductPrimaryMarketId
            );
             if (displayItemsFromCompetitors.length < allCompetitorDisplayItems.length && allCompetitorDisplayItems.length > 0) {
                const mainMarketInfo = fetchedMarketSettings?.find(m => m.id === mainProductPrimaryMarketId);
                toast({
                    title: "Competitors Filtered",
                    description: `Showing competitors only from the primary market: ${mainMarketInfo?.marketName || mainProductPrimaryMarketId}. Other linked competitors exist in different markets.`,
                    duration: 7000,
                });
            }
          } else {
            displayItemsFromCompetitors = allCompetitorDisplayItems;
            if (allCompetitorDisplayItems.length > 0) {
                 console.warn("Main product's primary market ID could not be determined. Showing all linked competitors.");
            }
          }
        }
        setRawCombinedDisplayItems([mainProductDisplayItem, ...displayItemsFromCompetitors].filter(item => item.id || item.competitorListingId));
      } else {
        setError('Product not found.');
        toast({ title: "Error", description: "Product not found.", variant: "destructive" });
        setRawCombinedDisplayItems([]);
        setIsLoadingStockInfo(false);
        setStockInfo(null);
      }
    } catch (e) {
      console.error("Failed to fetch product or competitors:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Error Fetching Data", description: errorMessage, variant: "destructive" });
      setRawCombinedDisplayItems([]);
      setIsLoadingStockInfo(false);
      setStockInfo(null);
    } finally {
      setIsLoadingProduct(false);
      setInitialLoadComplete(true);
    }
  }, [memoizedProductId, toast, loadStockInformation]);

  const loadDepletionReportData = useCallback(async () => {
    if (!memoizedProductId) return;
    setIsLoadingDepletionData(true);
    try {
        const data = await fetchDepletionDataForProductAction(memoizedProductId);
        setDepletionData(data);
    } catch (e) {
        console.error("Failed to fetch depletion data:", e);
        setDepletionData(null);
    } finally {
        setIsLoadingDepletionData(false);
    }
  }, [memoizedProductId]);

  useEffect(() => {
    if (typeof memoizedProductId === 'string' && memoizedProductId.trim() !== '') {
      loadProductAndCompetitors();
      loadDepletionReportData();
    }
  }, [memoizedProductId, loadProductAndCompetitors, loadDepletionReportData]);


  const fetchAndSetKeywordData = useCallback(async (date: Date, placement: string | null) => {
    if (!product || !product.marketId) {
        toast({ title: "Market Not Set", description: "Primary market for this product is not set. Cannot fetch keyword data.", variant: "destructive" });
        setTopKeywords([]);
        setKeywordMetrics({});
        return;
    }
    setIsLoadingKeywordsOrMetrics(true);
    const dateString = format(date, 'yyyy-MM-dd');

    try {
        const fetchedTopKeywords = await fetchTopKeywordsAction({date: dateString, marketId: product.marketId});

        let fetchedKeywordMetrics: KeywordMetricsMap = {};
        if (fetchedTopKeywords && fetchedTopKeywords.length > 0) {
           fetchedKeywordMetrics = await fetchKeywordMetricsForAsinsAction({
                asins: rawCombinedDisplayItems.map(item => item.asinCode).filter(Boolean) as string[],
                keywords: fetchedTopKeywords.map(k => k.keyword),
                date: dateString,
                placement: placement,
                marketId: product.marketId
            });
        }

        setTopKeywords(fetchedTopKeywords || []);
        setKeywordMetrics(fetchedKeywordMetrics || {});

    } catch (error) {
        console.error("Error fetching keyword data:", error);
        toast({ title: "Error", description: "Failed to fetch keyword or SOV data.", variant: "destructive" });
        setTopKeywords([]);
        setKeywordMetrics({});
    } finally {
        setIsLoadingKeywordsOrMetrics(false);
    }
  }, [product, rawCombinedDisplayItems, toast]);

  useEffect(() => {
    if (product && product.marketId ) {
        fetchAndSetKeywordData(selectedMetricsDate, selectedPlacement);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.marketId, selectedMetricsDate, selectedPlacement]);


  const handleOpenDeleteCompetitorLink = (listingId: string, competitorAsin?: string) => {
    setSelectedCompetitorForDelete({ listingId: listingId, asin: competitorAsin });
    setIsDeleteCompetitorDialogOpen(true);
  };

  const handleConfirmDeleteCompetitorLink = async () => {
    if (!selectedCompetitorForDelete || !product) return;

    const result = await deleteCompetitorListingAction(selectedCompetitorForDelete.listingId);
    if (result.success) {
      toast({ title: "Success", description: `Competitor listing for ASIN ${selectedCompetitorForDelete.asin || 'selected competitor'} deleted.` });
      loadProductAndCompetitors();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleteCompetitorDialogOpen(false);
    setSelectedCompetitorForDelete(null);
  };

  const handleDepletionConfigSave = () => {
    loadDepletionReportData();
    loadProductAndCompetitors();
  };

  const dynamicBsrCategories = React.useMemo(() => {
    const categories = new Set<string>();
    const climatePledgeFilter = "Climate Pledge Friendly: Shop All";
    rawCombinedDisplayItems.forEach(c => {
      const cat = c.category_ranks;
      if (cat && typeof cat === 'object') {
        if (typeof cat.bs_category === 'string' && cat.bs_category !== climatePledgeFilter) categories.add(cat.bs_category);
        if (typeof cat.root_bs_category === 'string' && cat.root_bs_category !== climatePledgeFilter) categories.add(cat.root_bs_category);
        if (Array.isArray(cat.subcategory_rank)) {
          cat.subcategory_rank.forEach((sub: any) => {
            if (typeof sub.subcategory_name === 'string' && sub.subcategory_name !== climatePledgeFilter) categories.add(sub.subcategory_name);
          });
        }
      }
    });
    return Array.from(categories).sort();
  }, [rawCombinedDisplayItems]);

  const bsrIdToCategoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    dynamicBsrCategories.forEach(catName => {
        const sanitizedIdPart = catName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        map.set(`bsr_${sanitizedIdPart}`, catName);
    });
    return map;
  }, [dynamicBsrCategories]);


  const combinedDisplayItemsSorted = useMemo(() => {
    if (!rawCombinedDisplayItems || rawCombinedDisplayItems.length === 0) return [];
    if (sorting.length === 0) return rawCombinedDisplayItems;

    const sortConfig = sorting[0];
    const { id: columnId, desc } = sortConfig;

    return [...rawCombinedDisplayItems].sort((a, b) => {
      let valA: any;
      let valB: any;

      if (columnId.startsWith('bsr_')) {
        const categoryName = bsrIdToCategoryNameMap.get(columnId);
        if (categoryName) {
            valA = getSortableRankForCategory(a, categoryName);
            valB = getSortableRankForCategory(b, categoryName);
        } else {
            valA = null;
            valB = null;
        }
      } else if (columnId.startsWith('kw_rank_') || columnId.startsWith('kw_sov_')) {
        const keyword = columnId.replace(/^kw_(rank|sov)_/, '');
        const metricType = columnId.startsWith('kw_rank_') ? 'organic_rank' : 'sov_percentage';

        const metricKeyA = `${a.asinCode}_${keyword}`;
        const metricKeyB = `${b.asinCode}_${keyword}`;

        valA = keywordMetrics[metricKeyA]?.[metricType as keyof KeywordMetric] ?? null;
        valB = keywordMetrics[metricKeyB]?.[metricType as keyof KeywordMetric] ?? null;

        valA = (valA === null || valA === undefined || valA === '') ? (desc ? -Infinity : Infinity) : Number(valA);
        valB = (valB === null || valB === undefined || valB === '') ? (desc ? -Infinity : Infinity) : Number(valB);
      } else if (columnId === 'price' || columnId === 'initial_price' || columnId === 'rootBsRank' || columnId === 'bsRank') {
          valA = parseFloat((a as any)[columnId]) || (desc ? -Infinity : Infinity);
          valB = parseFloat((b as any)[columnId]) || (desc ? -Infinity : Infinity);
      } else if (columnId === 'discountPercentage') {
        const discountA = calculateDiscountPercent(a.list_price, a.current_price);
        const discountB = calculateDiscountPercent(b.list_price, b.current_price);
        valA = discountA.value;
        valB = discountB.value;
      } else if (columnId === 'deliveryDate') {
        valA = getDeliveryInfo(a.delivery_info).parsedDate;
        valB = getDeliveryInfo(b.delivery_info).parsedDate;

        const aIsNull = valA === null;
        const bIsNull = valB === null;

        if (aIsNull && bIsNull) return 0;
        if (aIsNull) return desc ? 1 : -1; 
        if (bIsNull) return desc ? -1 : 1;

        return desc ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
      } else {
        valA = (a as any)[columnId];
        valB = (b as any)[columnId];
      }


      const isANullish = valA === null || valA === undefined || valA === '';
      const isBNullish = valB === null || valB === undefined || valB === '';

      if (isANullish && isBNullish) return 0;
      if (isANullish) return 1;
      if (isBNullish) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return desc ? valB - valA : valA - valB;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return desc ? valB.localeCompare(valA) : valA.localeCompare(valA);
      }
      return 0;
    });
  }, [rawCombinedDisplayItems, sorting, bsrIdToCategoryNameMap, keywordMetrics]);


  if (!hasMounted) {
    return (
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-24 w-full mb-6" />
        <Skeleton className="h-72 w-full mb-8 flex-1" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if ((isLoadingProduct || isLoadingDepletionData) && !initialLoadComplete) {
    return (
      <div className="p-4 md:p-6 flex-1 flex flex-col">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-24 w-full mb-6" />
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

  if (!product && initialLoadComplete) {
    return (
      <div className="p-4 md:p-6 text-center flex-1 flex flex-col items-center justify-center">
        <p className="text-muted-foreground text-xl">Product not found.</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }
  if (!product) return null;

  const isDepletionConfigured = depletionData &&
    ( (depletionData.salesTargets && depletionData.salesTargets.length > 0) ||
      (depletionData.localWarehouseLeadTime !== undefined && depletionData.localWarehouseLeadTime !== 14) ||
      (depletionData.reorderLeadTime !== undefined && depletionData.reorderLeadTime !== 100) ||
      (depletionData.associatedProducts && depletionData.associatedProducts.length > 0)
    );

  const competitorCount = rawCombinedDisplayItems.filter(item => !item.isMainProduct).length;


  return (
    <React.Fragment>
      <div className="flex flex-col h-full bg-muted/20">
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
          <ProductSummaryCard product={product} />
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 md:px-6 pb-4 md:pb-6 overflow-y-auto">
          <ProductStockInfoCard
            product={product}
            stockInfo={stockInfo}
            isLoadingStockInfo={isLoadingStockInfo}
            showAssociatedProductsStock={showAssociatedProductsStock}
            setShowAssociatedProductsStock={setShowAssociatedProductsStock}
            associatedProductsStockData={associatedProductsStockData}
            isLoadingAssociatedStock={isLoadingAssociatedStock}
            stockSorting={stockSorting}
            setStockSorting={setStockSorting}
          />

          <Card className="mt-4">
            <CardHeader className="p-3 pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h3 className="text-lg font-semibold leading-none tracking-tight">Product Comparison Details</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-xs text-muted-foreground whitespace-nowrap">
                <p>No. of Competitors: <span className="font-medium text-foreground">{competitorCount}</span></p>
                <p>Listings updated: {product.lastUpdated && isValid(new Date(product.lastUpdated)) ? format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a") : 'N/A'}</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <ScrollArea className="w-full max-h-[600px]">
                  <div className="space-y-3 p-0.5">
                    {combinedDisplayItemsSorted.map((c, index) => {
                      const dataAiHint = c.dataAiHint || c.product_name?.split(" ")[0]?.toLowerCase() || "product";
                      const productUrl = constructAmazonUrl(c.asinCode, c.marketDomainIdentifier || c.url);
                      const discountInfo = calculateDiscountPercent(c.list_price, c.current_price);
                      const deliveryInfo = getDeliveryInfo(Array.isArray(c.delivery_info) ? c.delivery_info : (c.delivery_info ? [c.delivery_info] : []));

                      let cardClasses = "bg-card";
                      if (c.isMainProduct) {
                        cardClasses = "bg-primary/5 text-primary-foreground dark:bg-primary/10";
                      } else {
                        const competitorIndex = index - (combinedDisplayItemsSorted.find(cp => cp.isMainProduct) ? 1 : 0);
                        if (competitorIndex % 2 === 0) {
                          cardClasses = "bg-muted/40 dark:bg-muted/20";
                        }
                      }
                      const displayBrand = c.brand && c.brand.length > 15 ? `${c.brand.substring(0,15)}...` : c.brand || "Brand N/A";
                      const currencySymbol = c.currencySymbol || getDisplayCurrencySymbol(activeMarketSettings.find(s => s.marketName === c.marketName) || undefined);

                      return (
                        <React.Fragment key={c.id || c.competitorListingId}>
                          <Card className={`overflow-hidden shadow-md ${cardClasses}`}>
                            <CardHeader className="p-3 flex flex-row items-start gap-2.5 space-y-0">
                              {c.imageUrl ? (
                                <Image
                                  src={c.imageUrl}
                                  alt={c.product_name || 'Product Image'}
                                  width={56}
                                  height={56}
                                  className="rounded object-cover aspect-square border"
                                  data-ai-hint={dataAiHint}
                                />
                              ) : (
                                <div className="w-14 h-14 bg-muted rounded flex items-center justify-center border shrink-0">
                                  <Package className="h-7 w-7 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-grow overflow-hidden">
                                <CardTitle className={`text-sm font-semibold truncate ${c.isMainProduct ? (cardClasses.includes('dark:') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`} title={c.product_name || 'N/A'}>
                                  {c.product_name && c.product_name.length > 35 ? `${c.product_name.substring(0, 35)}...` : c.product_name || "N/A"}
                                </CardTitle>
                                <p className={`text-xs truncate mt-0.5 ${c.isMainProduct ? (cardClasses.includes('dark:') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`} title={c.asinCode || 'N/A'}>ASIN:
                                  {c.asinCode ? (
                                    <a
                                      href={productUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 dark:text-blue-400 hover:underline"
                                    > {c.asinCode}</a>
                                  ) : (
                                    " N/A"
                                  )}
                                </p>
                                <p className={`text-xs truncate mt-0.5 ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`} title={c.brand || 'N/A'}>Brand: {displayBrand}</p>
                              </div>
                              {!c.isMainProduct && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive/90 shrink-0"
                                  onClick={() => handleOpenDeleteCompetitorLink(c.competitorListingId, c.asinCode || 'Unknown ASIN')}
                                  title="Delete Competitor Link"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </CardHeader>
                            <CardContent className="p-3 pt-0 space-y-1 text-xs">
                              <div className="flex justify-between items-center">
                                <span className={`${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`}>Current Price:</span>
                                <span className={`font-semibold ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`}>
                                  {c.current_price !== null && c.current_price !== undefined
                                    ? `${currencySymbol}${c.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : 'N/A'
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={
                                  c.isMainProduct
                                    ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80')
                                    : 'text-muted-foreground'
                                }>List Price:</span>
                                <span className={
                                  `truncate ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`
                                }>{c.list_price !== null && c.list_price !== undefined ? `${currencySymbol}${c.list_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`}>Discount:</span>
                                <Badge variant={discountInfo.value && discountInfo.value > 0 ? 'destructive' : 'secondary'} className="px-1.5 py-0.5 text-[10px]">{discountInfo.display}</Badge>
                              </div>
                              <div className="flex justify-between items-center truncate" title={c.deal_type || 'N/A'}>
                                <span className={`${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`}>Deal:</span>
                                {c.deal_type ? <Badge variant="outline" className={`px-1.5 py-0.5 text-[10px] truncate ${c.isMainProduct ? (cardClasses.includes('dark') ? 'border-primary-foreground/50 text-primary-foreground bg-primary/10' : 'border-primary-50 text-primary bg-primary/10') : ''}`} title={c.deal_type}>{c.deal_type}</Badge> : <span className="truncate">N/A</span>}
                              </div>
                              <div className="flex justify-between items-center truncate" title={c.dispatched_from || 'N/A'}>
                                <span className={
                                  c.isMainProduct
                                    ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80')
                                    : 'text-muted-foreground'
                                }>Dispatched:</span>
                                <span className={
                                  `truncate ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`
                                }>{c.dispatched_from || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center truncate" title={c.sold_by || 'N/A'}>
                                <span className={
                                  c.isMainProduct
                                    ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80')
                                    : 'text-muted-foreground'
                                }>Sold by:</span>
                                <span className={
                                  `truncate ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`
                                }>{c.sold_by || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground/80' : 'text-primary/80') : 'text-muted-foreground'}`}>Delivery Info:</span>
                                <span className={`truncate ${c.isMainProduct ? (cardClasses.includes('dark') ? 'text-primary-foreground' : 'text-primary') : 'text-foreground'}`} title={deliveryInfo.rawString}>{deliveryInfo.rawString}</span>
                              </div>
                            </CardContent>
                          </Card>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <CompetitorList
                  competitors={combinedDisplayItemsSorted}
                  activeMarketSettings={activeMarketSettings}
                  onDeleteCompetitorLink={handleOpenDeleteCompetitorLink}
                  sorting={sorting}
                  setSorting={setSorting}
                  dynamicBsrCategories={dynamicBsrCategories}
                  getRankForCategoryDisplay={getRankForCategoryDisplay}
                  topKeywords={topKeywords}
                  keywordMetrics={keywordMetrics}
                  onFetchKeywordData={fetchAndSetKeywordData}
                  isLoadingKeywordData={isLoadingKeywordsOrMetrics}
                  selectedMetricsDate={selectedMetricsDate}
                  setSelectedMetricsDate={setSelectedMetricsDate}
                  currentReportMarketId={product.marketId || null}
                  currentReportPlacement={selectedPlacement}
                  setSelectedPlacement={setSelectedPlacement}
                  bsrIdToCategoryNameMap={bsrIdToCategoryNameMap}
                />
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-xl font-semibold leading-none tracking-tight">Depletion Report</CardTitle>
              <div className="flex flex-col items-end text-right">
                {isLoadingDepletionData ? (
                  <Skeleton className="h-4 w-36 mb-1.5" />
                ) : isDepletionConfigured && product?.modifiedOn && isValid(new Date(product.modifiedOn)) ? (
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Settings last updated: {format(new Date(product.modifiedOn), "MMM dd, yyyy, hh:mm a")}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Not configured
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsDepletionModalOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configure Depletion Report
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Depletion report data will be displayed here once configured.
              </p>
              <Link href={`/depletion?q=${product.productCode}`} className="mt-2 inline-block">
                <Button variant="link" className="p-0 h-auto text-sm">
                  View Full Depletion Report for this Product
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
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
    </React.Fragment>
  );
}
