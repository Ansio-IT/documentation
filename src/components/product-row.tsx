
"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product, MarketSetting, ManagerSetting } from '@/lib/types'; 
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Package, Users, AlertCircle } from 'lucide-react'; 
import { 
  getEffectiveMarketSetting, 
  getDisplayCurrencySymbol, 
  getDisplayMarketName, 
  getMarketBadgeTailwindColor 
} from '@/lib/marketUtils';

interface ProductRowProps {
  product: Product; 
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onAddCompetitor: (product: Product) => void; 
  activeMarketSettings: MarketSetting[]; 
  activeManagerSettings: ManagerSetting[]; // Added to resolve manager name
}

export function ProductRow({ product, onEdit, onDelete, onAddCompetitor, activeMarketSettings, activeManagerSettings }: ProductRowProps) {
  const handleEditClick = () => {
    onEdit(product);
  };

  const handleDeleteClick = () => {
    onDelete(product.id);
  };

  const handleAddCompetitorClick = () => {
    onAddCompetitor(product);
  };
  
  const dataAiHint = product.dataAiHint || product.name?.split(" ")[0]?.toLowerCase() || "product";
  
  const marketSetting = getEffectiveMarketSetting(product.market, product.url, activeMarketSettings);
  const currencySymbol = product.currency || getDisplayCurrencySymbol(marketSetting);
  const displayMarketName = product.market || getDisplayMarketName(marketSetting); 
  const badgeColorClass = getMarketBadgeTailwindColor(displayMarketName);

  const manager = activeManagerSettings.find(m => m.id === product.managerId);
  const displayManagerName = manager?.name || "N/A";

  return (
    <>
      <TableRow className="hover:bg-muted/50 group">{/*
      */}<TableCell className="p-2 align-top w-[250px]">
          <div className="flex items-center space-x-3">
            <Link href={`/product/${product.id}`} className="shrink-0">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name || 'Product Image'}
                  width={48}
                  height={48}
                  className="rounded-md object-cover aspect-square border group-hover:opacity-80 transition-opacity"
                  data-ai-hint={dataAiHint}
                />
              ) : (
                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center border shrink-0 group-hover:opacity-80 transition-opacity">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </Link>
            <div className="flex-grow overflow-hidden">
              <Link href={`/product/${product.id}`} className="hover:underline">
                <span className="font-medium text-sm truncate block" title={product.name || "N/A"}>
                  {product.name || "N/A"}
                </span>
              </Link>
              {product.attentionNeeded && ( 
                <Badge variant="destructive" className="mt-1 text-xs py-0.5 px-1.5 flex items-center w-fit">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Attention
                </Badge>
              )}
            </div>
          </div>
        </TableCell>{/*
      */}<TableCell className="hidden sm:table-cell p-2 align-top text-xs text-muted-foreground w-[130px]">
          <p className="truncate" title={product.asinCode || "N/A"}>{product.asinCode || "N/A"}</p> 
        </TableCell>{/*
      */}<TableCell className="hidden sm:table-cell p-2 align-top text-xs text-muted-foreground w-[120px]">
          <p className="truncate" title={product.productCode || "N/A"}>{product.productCode || "N/A"}</p>
        </TableCell>{/*
      */}<TableCell className="hidden md:table-cell p-2 align-top max-w-[250px] w-[250px]">
          <p className="truncate text-sm text-muted-foreground" title={product.description || "-"}>
            {product.description || "-"}
          </p>
        </TableCell>{/*
      */}<TableCell className="text-right p-2 align-top w-[90px]">
          <div className="flex items-center justify-end text-sm">
            <span className="mr-0.5">{currencySymbol}</span> 
            {(product.price ?? 0).toFixed(2)} 
          </div>
        </TableCell>{/*
      */}<TableCell className="hidden lg:table-cell p-2 align-top text-center w-[100px]">
          <Badge variant="default" className={`text-xs ${badgeColorClass}`}>
            {displayMarketName}
          </Badge>
        </TableCell>{/*
      */}<TableCell className="hidden lg:table-cell p-2 align-top text-sm w-[120px]">
        <p className="truncate" title={displayManagerName}>{displayManagerName}</p> 
      </TableCell>{/*
      */}<TableCell className="text-right p-2 align-top w-[130px]">
          <div className="flex items-center justify-end space-x-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAddCompetitorClick} title="Add Competitors">
              <Users className="h-4 w-4" /> {/* Changed icon */}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEditClick} title="Edit Product">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={handleDeleteClick} title="Delete Product">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>{/*
    */}</TableRow>
    </>
  );
}
