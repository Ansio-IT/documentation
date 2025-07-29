
"use client";

import Image from 'next/image';
import type { Product, MarketSetting } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { DollarSign, Tag, Users as ManagerIcon, MapPin, Package, ShoppingBag, AlertCircle, ExternalLink, BarChart3, TrendingUp, Clock } from 'lucide-react';
import {
  getDisplayCurrencySymbol,
  getDisplayMarketName,
  getMarketBadgeTailwindColor
} from '@/lib/marketUtils'; 
import { format } from 'date-fns';

const CategoryIcon: React.FC<{ category?: string; className?: string }> = ({ category, className = "h-5 w-5 text-muted-foreground" }) => {
  switch (category?.toLowerCase()) {
    case "electronics": return <Package className={className} />;
    case "apparel": case "clothing": return <ShoppingBag className={className} />;
    default: return <Package className={className} />;
  }
};

interface ProductDetailCardProps {
  product: Product; 
  activeMarketSettings: MarketSetting[]; 
  managerName?: string | null; 
}

export function ProductDetailCard({ product, activeMarketSettings, managerName }: ProductDetailCardProps) {
  const currencySymbol = '£'; // Always use £
  const displayMarketName = product.market || 'N/A'; 
  const marketBadgeColorClass = getMarketBadgeTailwindColor(displayMarketName);

  const dataAiHintImage = product.dataAiHint || product.name?.split(" ")[0]?.toLowerCase() || "product detail";
  
  const ProductTitleDisplay = () => (
    <CardTitle
      className="text-xl lg:text-2xl font-bold text-primary leading-normal"
      title={product.name || ''}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '600px', 
      }}
    >
      {product.name || 'Untitled Product'}
    </CardTitle>
  );

  return (
    <Card className="overflow-hidden shadow-xl rounded-xl bg-card">
      <div className="md:flex">
        <div className="w-full md:max-w-[250px] md:shrink-0 flex items-center justify-center p-4 bg-muted/30 md:bg-transparent">
          <div className="relative w-full max-w-[220px] aspect-[3/4]">
            <Image
              src={product.imageUrl || `https://placehold.co/220x293.png?text=${encodeURIComponent(product.name?.substring(0, 15) || 'Product')}`}
              alt={product.name || 'Product Image'}
              fill
              className="object-contain"
              sizes="(max-width: 767px) 60vw, 220px"
              priority
              data-ai-hint={dataAiHintImage}
            />
          </div>
        </div>
        <div className="p-6 md:p-8 flex-grow flex flex-col max-w-[650px]">
          <CardHeader className="p-0 mb-2">
            <div className="flex items-start justify-between gap-2">
              {product.url ? (
                <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  <ProductTitleDisplay />
                </a>
              ) : (
                <ProductTitleDisplay />
              )}
              {product.asinCode && ( 
                <Badge variant="outline" className="text-xs shrink-0 ml-auto flex items-center gap-1.5 py-1 px-2 border-primary/50 text-primary whitespace-nowrap">
                  Market Listing
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-row flex-wrap gap-x-6 gap-y-1 items-center text-xs text-muted-foreground">
              <span className="flex items-center truncate" title={product.asinCode || "N/A"}>
                <Tag className="h-3.5 w-3.5 mr-1.5 shrink-0" />ASIN:
                {product.url && product.asinCode ? (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 dark:text-blue-400 hover:underline truncate"
                  >
                    {product.asinCode || 'N/A'}
                  </a>
                ) : (
                  <span className="ml-1">{product.asinCode || 'N/A'}</span>
                )}
              </span>
              <span className="flex items-center truncate" title={product.productCode}><Package className="h-3.5 w-3.5 mr-1.5 shrink-0" />Code: {product.productCode}</span>
              {product.lastUpdated && (
                <span className="flex items-center truncate" title={new Date(product.lastUpdated).toLocaleString()}>
                  <Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  Last Updated: {format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a")}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-grow flex flex-col mt-2">
            {product.description && (
              <div className="mb-3">
                <p
                  className="text-sm text-foreground/80 leading-normal truncate"
                  title={product.description}
                >
                  {product.description}
                </p>
              </div>
            )}

            <div className="product-meta-row flex flex-row flex-wrap gap-x-6 gap-y-3 items-center mt-1 text-sm">
              <div>
                <span className="font-medium text-xs text-muted-foreground flex items-center mb-0.5"><DollarSign className="h-3.5 w-3.5 mr-1" />Price</span>
                <p className="text-lg font-semibold text-accent">
                  {product.price !== null && product.price !== undefined
                    ? `${currencySymbol}${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <span className="font-medium text-xs text-muted-foreground flex items-center mb-0.5"><MapPin className="h-3.5 w-3.5 mr-1" />Market</span>
                <Badge variant="default" className={`text-xs py-0.5 px-2 ${marketBadgeColorClass}`}>
                  {displayMarketName}
                </Badge>
              </div>
              <div>
                <span className="font-medium text-xs text-muted-foreground flex items-center mb-0.5"><ManagerIcon className="h-3.5 w-3.5 mr-1" />Manager</span>
                <p className="text-foreground/90 truncate" title={managerName || 'N/A'}>{managerName || 'N/A'}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
              {(product.rootBsCategory || product.bsCategory || (product.subcategoryRanks && product.subcategoryRanks.length > 0)) && (
                 <h4 className="text-sm font-medium text-foreground mb-1.5 flex items-center"><BarChart3 className="h-4 w-4 mr-2 text-primary" />Best Seller Ranks</h4>
              )}
              {product.rootBsCategory && product.rootBsRank != null && (
                <p className="flex items-center truncate" title={`(#${product.rootBsRank}) ${product.rootBsCategory}`}>
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-green-600 shrink-0" />
                  Root: <span className="font-medium text-foreground/90 ml-1 mr-0.5">(#{product.rootBsRank.toLocaleString()})</span> {product.rootBsCategory}
                </p>
              )}
              {product.bsCategory && product.bsRank != null && (
                <p className="flex items-center truncate" title={`(#${product.bsRank}) ${product.bsCategory}`}>
                 <TrendingUp className="h-3.5 w-3.5 mr-1.5 text-blue-600 shrink-0" />
                  Main: <span className="font-medium text-foreground/90 ml-1 mr-0.5">(#{product.bsRank.toLocaleString()})</span> {product.bsCategory}
                </p>
              )}
              {product.subcategoryRanks && product.subcategoryRanks.length > 0 && (
                <div className="mt-1">
                  <p className="flex items-center font-medium text-foreground/90">
                    Subcategories:
                  </p>
                  <ul className="list-disc list-inside pl-2 space-y-0.5">
                    {product.subcategoryRanks.slice(0, 3).map((rank, index) => ( 
                      <li key={index} className="text-xs truncate" title={`(#${rank.subcategoryRank}) ${rank.subcategoryName}`}>
                        (#{rank.subcategoryRank.toLocaleString()}) {rank.subcategoryName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4">
              {product.attentionNeeded && ( 
                <Badge variant="destructive" className="text-xs py-0.5 px-2 flex items-center w-fit">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Requires Attention
                </Badge>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
