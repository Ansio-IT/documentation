
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, MarketSetting, ManagerSetting, ProductListingData } from '@/lib/types';
import { ProductList } from '@/components/product-list';
import { AddProductModal } from '@/components/add-product-modal';
import { EditProductModal } from '@/components/edit-product-modal';
import { DeleteProductDialog } from '@/components/delete-product-dialog';
import { AddCompetitorModal } from '@/components/add-competitor-modal';
import { UploadExcelModal } from '@/components/upload-excel-modal';
import { syncProductsWithBrightData, fetchLastSyncTimeAction } from '@/app/actions/external-api.actions';
import {
  addProductAction,
  updateProductAction,
  deleteProductAction,
  getProductsAction,
} from '@/app/actions/product.actions';
import { addCompetitorListingsAction } from '@/app/actions/competitor.actions';
import { fetchActiveMarketSettings } from '@/app/actions/market-settings.actions';
import { fetchActiveManagerSettings } from '@/app/actions/manager-settings.actions';
import { useToast } from "@/hooks/use-toast";
import type { SortingState } from '@tanstack/react-table';
import { createClient } from '@/lib/supabase/client'; // Ensure client-side Supabase is used
import { getDeliveryInfo, calculateDiscountPercent } from '@/lib/productUtils';


const ALL_MARKETS_SELECT_VALUE = "##ALL_MARKETS##";
const ALL_MANAGERS_SELECT_VALUE = "##ALL_MANAGERS##";

export default function DashboardPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []); // Client-side Supabase client

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  const [isDeleteDialogActive, setIsDeleteDialogActive] = useState(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState<Product | null>(null);

  const [isAddCompetitorModalOpen, setIsAddCompetitorModalOpen] = useState(false);
  const [selectedProductForCompetitors, setSelectedProductForCompetitors] = useState<Product | null>(null);

  const [isUploadExcelModalOpen, setIsUploadExcelModalOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarketId, setFilterMarketId] = useState<string>("");
  const [filterManagerId, setFilterManagerId] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterAttention, setFilterAttention] = useState<'all' | 'yes' | 'no'>('all');

  const [availableMarkets, setAvailableMarkets] = useState<MarketSetting[]>([]);
  const [availableManagers, setAvailableManagers] = useState<ManagerSetting[]>([]);

  const [sorting, setSorting] = React.useState<SortingState>([]);


  const loadProducts = useCallback(async (showNoProductsToast = false) => {
    setIsLoading(true);
    try {
      const productsData = await getProductsAction(); 
      setAllProducts(productsData);
      if (showNoProductsToast && productsData.length === 0 && isInitialLoad) {
         toast({
            title: "No Products Found",
            description: "The product database is empty. Try adding products.",
          });
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error Fetching Products",
        description: "Could not load products from the database.",
        variant: "destructive",
      });
      setAllProducts([]);
    } finally {
      setIsLoading(false);
      if(isInitialLoad) setIsInitialLoad(false);
    }
  }, [toast, isInitialLoad]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [markets, managers, productsData, syncTime] = await Promise.all([
          fetchActiveMarketSettings(), 
          fetchActiveManagerSettings(), 
          getProductsAction(),
          fetchLastSyncTimeAction()
        ]);
        setAvailableMarkets(markets);
        setAvailableManagers(managers);
        setAllProducts(productsData);
        setLastSyncTime(syncTime);

        if (productsData.length === 0 && isInitialLoad) {
           toast({
            title: "No Products Found",
            description: "The product database is empty. Try adding products.",
          });
        }

      } catch (error) {
        console.error("Failed to load initial data:", error);
        toast({
          title: "Error Loading Data",
          description: "Could not load initial dashboard data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        if(isInitialLoad) setIsInitialLoad(false);
      }
    };
    if (isInitialLoad) {
        loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoad]); 

  const handleSync = useCallback(async () => {
    setIsLoading(true);
    toast({ title: "Syncing with Bright Data...", description: "Triggering data refresh. This may take a moment." });
    const result = await syncProductsWithBrightData();
    if (result.success) {
        toast({
          title: "Sync Triggered with Bright Data",
          description: `${result.message || "Data refresh initiated."} Updates will arrive via webhook. The page will refresh shortly to reflect potential changes.`,
          duration: 7000
        });
        setTimeout(() => {
            loadProducts(false); 
            router.refresh(); 
        }, 5000); 
    } else {
        toast({
          title: "Sync Failed",
          description: result.message || "Could not trigger data refresh with Bright Data.",
          variant: "destructive"
        });
    }
    setIsLoading(false);
    return result;
  }, [toast, router, loadProducts]);

  const handleAddProduct = async (
    productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'competitorListings' | 'primaryListingManagerName' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'managerId' | 'marketId' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >,
    initialListing: { marketId: string; managerId: string; data: Partial<Omit<ProductListingData, 'price'>> }
  ) => {
    const result = await addProductAction(productCoreData, initialListing); 
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsAddModalOpen(false);
      loadProducts(true); 
    } else {
      toast({ title: "Error", description: result.message || "Failed to add product.", variant: "destructive" });
    }
    return result.success;
  };

  const handleOpenEditModal = (product: Product) => {
    setSelectedProductForEdit(product);
    setIsEditModalOpen(true);
  };

 const handleUpdateProduct = async (
    productId: string,
    productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' | 'marketId' | 'managerId' | 'associatedProducts' | 'localWarehouseLeadTime' | 'reorderLeadTime' >>,
    primaryListingUpdates?: { managerId?: string; data?: Partial<ProductListingData> },
    marketIdForListing?: string
  ) => {
    const result = await updateProductAction(productId, productCoreData, primaryListingUpdates, marketIdForListing); 
    if (result.success) {
      toast({ title: "Success", description: "Product updated successfully." });
      setIsEditModalOpen(false);
      loadProducts(); 
    } else {
      toast({ title: "Error updating product", description: result.message, variant: "destructive" });
    }
    return result.success;
  };

  const handleOpenDeleteDialog = (productId: string) => {
    const productToDelete = allProducts.find(p => p.id === productId);
    if (productToDelete) {
      setSelectedProductForDelete(productToDelete);
      setIsDeleteDialogActive(true);
    } else {
      toast({ title: "Error", description: "Product not found for deletion.", variant: "destructive"});
    }
  };

  const handleDeleteProductConfirmed = async () => {
    if (!selectedProductForDelete) return;
    const result = await deleteProductAction(selectedProductForDelete.id); 
    if (result.success) {
      toast({ title: "Success", description: result.message });
      loadProducts(true); 
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleteDialogActive(false);
    setSelectedProductForDelete(null);
  };

  const handleOpenAddCompetitorModal = (product: Product) => {
    setSelectedProductForCompetitors(product);
    setIsAddCompetitorModalOpen(true);
  };

  const handleSaveCompetitors = async (
    mainProductId: string,
    competitorAsinsData: Array<{ asin: string; marketId: string; managerId: string; }>,
    asinsToRemove?: string[]
  ) => {
    const result = await addCompetitorListingsAction(mainProductId, competitorAsinsData, asinsToRemove); 
    if (result.success) {
      toast({ title: "Success", description: "Competitor ASINs linked successfully." });
      setIsAddCompetitorModalOpen(false);
      loadProducts(); 
    } else {
      toast({ title: "Error saving competitor links", description: result.message, variant: "destructive" });
    }
    return result.success;
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterMarketId("");
    setFilterManagerId("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setFilterAttention("all");
  };

  const handleSearchTermChange = (term: string) => {
    setSearchTerm(term);
  };

  const handleMarketFilterChange = (marketIdValue: string) => {
    setFilterMarketId(marketIdValue === ALL_MARKETS_SELECT_VALUE ? "" : marketIdValue);
  };

  const handleManagerFilterChange = (managerIdValue: string) => {
    setFilterManagerId(managerIdValue === ALL_MANAGERS_SELECT_VALUE ? "" : managerIdValue);
  };

  const handleMinPriceChange = (price: string) => {
    setFilterMinPrice(price);
  };

  const handleMaxPriceChange = (price: string) => {
    setFilterMaxPrice(price);
  };

  const handleAttentionChange = (value: 'all' | 'yes' | 'no') => {
    setFilterAttention(value);
  };

  const filteredProducts = useMemo(() => {
    let products = [...allProducts]; 

    if (searchTerm) {
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.productCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.asinCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterMarketId) {
      products = products.filter(p => p.marketId === filterMarketId);
    }

    if (filterManagerId) {
      products = products.filter(p => p.managerId === filterManagerId);
    }

    const minPriceNum = parseFloat(filterMinPrice);
    const maxPriceNum = parseFloat(filterMaxPrice);
    if (!isNaN(minPriceNum)) {
      products = products.filter(p => (p.price ?? -Infinity) >= minPriceNum);
    }
    if (!isNaN(maxPriceNum)) {
      products = products.filter(p => (p.price ?? Infinity) <= maxPriceNum);
    }

    if (filterAttention === 'yes') {
      products = products.filter(p => p.attentionNeeded === true);
    } else if (filterAttention === 'no') {
      products = products.filter(p => p.attentionNeeded === false || p.attentionNeeded === undefined);
    }

    if (sorting.length > 0) {
      const sortConfig = sorting[0];
      const { id: columnId, desc } = sortConfig;

      products.sort((a, b) => {
        let valA: any;
        let valB: any;
        
        const compareNullish = (val1: any, val2: any) => {
            const isA_null = val1 === null || val1 === undefined || val1 === '';
            const isB_null = val2 === null || val2 === undefined || val2 === '';
            if (isA_null && isB_null) return 0;
            if (isA_null) return desc ? -1 : 1;
            if (isB_null) return desc ? 1 : -1;
            return null;
        };

        if (columnId === 'discountPercentage') {
            valA = calculateDiscountPercent(a.listPrice, a.price).value;
            valB = calculateDiscountPercent(b.listPrice, b.price).value;
        } else if (columnId === 'rootBSR') {
            valA = a.categoryRanks?.root_bs_rank ?? null;
            valB = b.categoryRanks?.root_bs_rank ?? null;
        } else if (columnId === 'deliveryDate') {
            valA = getDeliveryInfo(a.deliveryInfo ? [a.deliveryInfo] : []).parsedDate;
            valB = getDeliveryInfo(b.deliveryInfo ? [b.deliveryInfo] : []).parsedDate;
        } else {
            valA = (a as any)[columnId];
            valB = (b as any)[columnId];
        }
        
        const nullishResult = compareNullish(valA, valB);
        if (nullishResult !== null) {
            return nullishResult;
        }

        if (valA instanceof Date && valB instanceof Date) {
            return desc ? valB.getTime() - valA.getTime() : valA.getTime() - valB.getTime();
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
            return desc ? valB - valA : valA - valB;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
            return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        if (typeof valA === 'boolean' && typeof valB === 'boolean') {
            const boolComparison = valA === valB ? 0 : (valA ? -1 : 1);
            return desc ? boolComparison * -1 : boolComparison;
        }

        return 0;
      });
    }
    return products;
  }, [allProducts, searchTerm, filterMarketId, filterManagerId, filterMinPrice, filterMaxPrice, filterAttention, sorting]);


  return (
    <div className="flex flex-col h-screen">
      <main className="flex-1 flex flex-col overflow-hidden">
        <ProductList
          products={filteredProducts}
          isLoading={isLoading && isInitialLoad}
          onEditProduct={handleOpenEditModal}
          onDeleteProduct={handleOpenDeleteDialog}
          onAddCompetitor={handleOpenAddCompetitorModal}
          activeMarketSettings={availableMarkets}
          activeManagerSettings={availableManagers}
          sorting={sorting}
          setSorting={setSorting}
          onSyncProducts={handleSync}
          onOpenUploadModal={() => setIsUploadExcelModalOpen(true)}
          searchTerm={searchTerm}
          onSearchTermChange={handleSearchTermChange}
          filterMarketId={filterMarketId}
          onFilterMarketIdChange={handleMarketFilterChange}
          filterManagerId={filterManagerId}
          onFilterManagerIdChange={handleManagerFilterChange}
          filterMinPrice={filterMinPrice}
          onFilterMinPriceChange={handleMinPriceChange}
          filterMaxPrice={filterMaxPrice}
          onFilterMaxPriceChange={handleMaxPriceChange}
          filterAttention={filterAttention}
          onFilterAttentionChange={handleAttentionChange}
          onResetFilters={handleResetFilters}
          lastSyncTime={lastSyncTime}
        />
      </main>
      <AddProductModal
        isOpen={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onAddProduct={handleAddProduct}
        markets={availableMarkets}
        managers={availableManagers}
      />
      <EditProductModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        product={selectedProductForEdit}
        onUpdateProduct={handleUpdateProduct}
        markets={availableMarkets}
        managers={availableManagers}
      />
      <DeleteProductDialog
        isOpen={isDeleteDialogActive}
        onOpenChange={setIsDeleteDialogActive}
        productName={selectedProductForDelete?.name}
        onConfirmDelete={handleDeleteProductConfirmed}
      />
      <AddCompetitorModal
        isOpen={isAddCompetitorModalOpen}
        onOpenChange={setIsAddCompetitorModalOpen}
        product={selectedProductForCompetitors}
        onSaveCompetitors={handleSaveCompetitors}
      />
      <UploadExcelModal
        isOpen={isUploadExcelModalOpen}
        onOpenChange={setIsUploadExcelModalOpen}
        onUploadComplete={() => {
          loadProducts();
        }}
      />
      <footer className="text-center p-4 border-t text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Retail Sales Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}