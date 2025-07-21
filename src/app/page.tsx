
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, MarketSetting, ManagerSetting, ProductListingData } from '@/lib/types';
import { DashboardHeaderControls } from '@/components/layout/header';
import { ProductList } from '@/components/product-list';
import { AddProductModal } from '@/components/add-product-modal';
import { EditProductModal } from '@/components/edit-product-modal';
import { DeleteProductDialog } from '@/components/delete-product-dialog';
import { AddCompetitorModal } from '@/components/add-competitor-modal';
import {
  syncProductsWithBrightData,
  addProductAction,
  updateProductAction,
  deleteProductAction,
  addCompetitorListingsAction,
  fetchActiveMarketSettings,
  fetchActiveManagerSettings,
  getProducts,
} from '@/app/actions';
import { useToast } from "@/hooks/use-toast";

const ITEMS_PER_PAGE = 10; // This is for TanStack Table's client-side pagination, can be adjusted.
const ALL_MARKETS_SELECT_VALUE = "##ALL_MARKETS##";
const ALL_MANAGERS_SELECT_VALUE = "##ALL_MANAGERS##";

export default function DashboardPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const router = useRouter();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  const [isDeleteDialogActive, setIsDeleteDialogActive] = useState(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState<Product | null>(null);

  const [isAddCompetitorModalOpen, setIsAddCompetitorModalOpen] = useState(false);
  const [selectedProductForCompetitors, setSelectedProductForCompetitors] = useState<Product | null>(null);

  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarketId, setFilterMarketId] = useState<string>("");
  const [filterManagerId, setFilterManagerId] = useState<string>("");
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [filterAttention, setFilterAttention] = useState<'all' | 'yes' | 'no'>('all');

  const [availableMarkets, setAvailableMarkets] = useState<MarketSetting[]>([]);
  const [availableManagers, setAvailableManagers] = useState<ManagerSetting[]>([]);

  const loadProducts = useCallback(async (showNoProductsToast = false) => {
    setIsLoading(true);
    try {
      const productsData = await getProducts();
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
    const loadFilterOptionsAndProducts = async () => {
      setIsLoading(true);
      try {
        const [markets, managers, productsData] = await Promise.all([
          fetchActiveMarketSettings(),
          fetchActiveManagerSettings(),
          getProducts()
        ]);
        setAvailableMarkets(markets);
        setAvailableManagers(managers);
        setAllProducts(productsData);

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
        loadFilterOptionsAndProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoad]);

  const handleSync = useCallback(async () => {
    setIsLoading(true);
    toast({ title: "Syncing with Bright Data...", description: "Triggering data refresh. This may take a moment." });
    const result = await syncProductsWithBrightData(); // Corrected function name
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
    productCoreData: Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'competitorListings' | 'primaryListingManagerName' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' >,
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
    productCoreData: Partial<Omit<Product, 'id' | 'createdOn' | 'modifiedOn' | 'competitorListings' | 'primaryListingManagerName' | 'market' | 'price' | 'currency' | 'url' | 'asinCode' | 'rootBsCategory' | 'rootBsRank' | 'bsCategory' | 'bsRank' | 'subcategoryRanks' | 'attentionNeeded' | 'dataAiHint' | 'lastUpdated' | 'product_listings' >>,
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

  const handleSaveCompetitors = async (mainProductId: string, competitorAsinsData: Array<{ asinCode: string; marketId: string; managerId: string; }>) => {
    const result = await addCompetitorListingsAction(mainProductId, competitorAsinsData);
    if (result.success) {
      toast({ title: "Success", description: "Competitor ASINs linked successfully." });
      setIsAddCompetitorModalOpen(false);
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
      const targetMarket = availableMarkets.find(m => m.id === filterMarketId);
      if (targetMarket) {
          products = products.filter(p => p.market === targetMarket.marketName);
      }
    }

    if (filterManagerId) {
      // Ensure p.managerId exists and is compared correctly
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
    return products.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
  }, [allProducts, searchTerm, filterMarketId, filterManagerId, filterMinPrice, filterMaxPrice, filterAttention, availableMarkets, availableManagers]);


  return (
    <div className="flex flex-col">
      <DashboardHeaderControls
        onSyncProducts={handleSync}
        onAddProduct={() => setIsAddModalOpen(true)}
        searchTerm={searchTerm}
        onSearchTermChange={handleSearchTermChange}
        filterMarketId={filterMarketId}
        onFilterMarketIdChange={handleMarketFilterChange}
        availableMarkets={availableMarkets}
        filterManagerId={filterManagerId}
        onFilterManagerIdChange={handleManagerFilterChange}
        availableManagers={availableManagers}
        filterMinPrice={filterMinPrice}
        onFilterMinPriceChange={handleMinPriceChange}
        filterMaxPrice={filterMaxPrice}
        onFilterMaxPriceChange={handleMaxPriceChange}
        filterAttention={filterAttention}
        onFilterAttentionChange={handleAttentionChange}
        onResetFilters={handleResetFilters}
      />
      <div className="flex-grow px-4 py-2 md:py-3"> {/* Removed container mx-auto, adjusted padding */}
        <ProductList
          products={filteredProducts} // Pass the filtered products
          isLoading={isLoading && isInitialLoad}
          onEditProduct={handleOpenEditModal}
          onDeleteProduct={handleOpenDeleteDialog}
          onAddCompetitor={handleOpenAddCompetitorModal}
          // Pagination props are handled by TanStack Table within ProductList
          activeMarketSettings={availableMarkets}
          activeManagerSettings={availableManagers}
        />
      </div>
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
        activeMarkets={availableMarkets}
        activeManagers={availableManagers}
      />
      <footer className="text-center p-4 border-t text-sm text-muted-foreground mt-auto">
        <p>&copy; {new Date().getFullYear()} Retail Sales Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
