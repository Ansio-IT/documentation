
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, PlusCircle, Search, FilterX } from "lucide-react";
import type { MarketSetting, ManagerSetting } from "@/lib/types";

const ALL_MARKETS_SELECT_VALUE = "##ALL_MARKETS##";
const ALL_MANAGERS_SELECT_VALUE = "##ALL_MANAGERS##";

interface DashboardHeaderControlsProps {
  onSyncProducts: () => Promise<{ success: boolean; message: string; count?: number }>;
  onAddProduct: () => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  filterMarketId: string;
  onFilterMarketIdChange: (marketId: string) => void;
  availableMarkets: MarketSetting[];
  filterManagerId: string;
  onFilterManagerIdChange: (managerId: string) => void;
  availableManagers: ManagerSetting[];
  filterMinPrice: string;
  onFilterMinPriceChange: (price: string) => void;
  filterMaxPrice: string;
  onFilterMaxPriceChange: (price: string) => void;
  filterAttention: 'all' | 'yes' | 'no';
  onFilterAttentionChange: (value: 'all' | 'yes' | 'no') => void;
  onResetFilters: () => void;
}

export function DashboardHeaderControls({
  onSyncProducts,
  onAddProduct,
  searchTerm,
  onSearchTermChange,
  filterMarketId,
  onFilterMarketIdChange,
  availableMarkets,
  filterManagerId,
  onFilterManagerIdChange,
  availableManagers,
  filterMinPrice,
  onFilterMinPriceChange,
  filterMaxPrice,
  onFilterMaxPriceChange,
  filterAttention,
  onFilterAttentionChange,
  onResetFilters
}: DashboardHeaderControlsProps) {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await onSyncProducts();
    setIsSyncing(false);
  };

  return (
    <div className="bg-card border-b border-border shadow-sm py-3 sticky top-[69px] z-30"> {/* Adjusted sticky top position if GlobalHeader is ~68px high */}
      <div className="px-4"> {/* Removed container mx-auto */}
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center space-x-2">
            <Button onClick={handleSyncClick} disabled={isSyncing} variant="outline" size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Syncing..." : "Sync Products"}
            </Button>
            <Button onClick={onAddProduct} variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-end">
          <div className="relative lg:col-span-2 xl:col-span-2">
            <Label htmlFor="search-products" className="text-xs font-medium text-muted-foreground">Search</Label>
            <Search className="absolute left-2.5 top-8 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-products"
              type="search"
              placeholder="Title, Product Code, ASIN..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-8 w-full mt-1"
            />
          </div>

          <div>
            <Label htmlFor="filter-market" className="text-xs font-medium text-muted-foreground">Market</Label>
            <Select value={filterMarketId || ALL_MARKETS_SELECT_VALUE} onValueChange={onFilterMarketIdChange}>
              <SelectTrigger id="filter-market" className="w-full mt-1">
                <SelectValue placeholder="All Markets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MARKETS_SELECT_VALUE}>All Markets</SelectItem>
                {availableMarkets.map(market => (
                  <SelectItem key={market.id} value={market.id}>{market.marketName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-manager" className="text-xs font-medium text-muted-foreground">Manager</Label>
            <Select value={filterManagerId || ALL_MANAGERS_SELECT_VALUE} onValueChange={onFilterManagerIdChange}>
              <SelectTrigger id="filter-manager" className="w-full mt-1">
                <SelectValue placeholder="All Managers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MANAGERS_SELECT_VALUE}>All Managers</SelectItem>
                {availableManagers.map(manager => (
                  <SelectItem key={manager.id} value={manager.name}>{manager.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="filter-min-price" className="text-xs font-medium text-muted-foreground">Min Price</Label>
              <Input
                id="filter-min-price"
                type="number"
                placeholder="Min"
                value={filterMinPrice}
                onChange={(e) => onFilterMinPriceChange(e.target.value)}
                className="w-full mt-1"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="filter-max-price" className="text-xs font-medium text-muted-foreground">Max Price</Label>
              <Input
                id="filter-max-price"
                type="number"
                placeholder="Max"
                value={filterMaxPrice}
                onChange={(e) => onFilterMaxPriceChange(e.target.value)}
                className="w-full mt-1"
                min="0"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end space-y-1">
             <Label htmlFor="filter-attention" className="text-xs font-medium text-muted-foreground">Attention Needed</Label>
            <div className="flex items-center space-x-2 h-10">
                <Select value={filterAttention} onValueChange={(value) => onFilterAttentionChange(value as 'all' | 'yes' | 'no')}>
                    <SelectTrigger id="filter-attention" className="w-full">
                        <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={onResetFilters} variant="outline" size="icon" className="shrink-0" title="Reset Filters">
                    <FilterX className="h-4 w-4" />
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
