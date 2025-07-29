import React from 'react';
import { Product } from '../lib/types';
import { getIsoCurrencyCode } from '../lib/productUtils';
import { Clock } from 'lucide-react';
import { format, isValid } from 'date-fns';

const ProductSummaryCard = ({ product }: { product: Product }) => {
    if (!product || !product.id) return null;
    const displayName = product.name || product.productCode || 'N/A';
    const displayPrice = product.price;
    const displayManagerName = product.primaryListingManagerName || 'N/A';
    const displayAsin = product.asinCode || 'N/A';
    const displaySku = product.productCode || 'N/A';
    const isoCode = getIsoCurrencyCode(product.currency);

    const priceTitle = displayPrice !== null && displayPrice !== undefined ? `Price: ${displayPrice.toLocaleString('en-GB', { style: 'currency', currency: isoCode })}` : 'Price: N/A';
    const priceDisplay = displayPrice !== null && displayPrice !== undefined ? displayPrice.toLocaleString('en-GB', { style: 'currency', currency: isoCode }) : 'N/A';


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
         <div className="flex items-center gap-1.5" title={priceTitle}>
          <span className="font-medium text-muted-foreground">Price:</span>
          <span className="text-foreground font-semibold">{priceDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5" title={displayManagerName}>
          <span className="font-medium text-muted-foreground">Manager:</span>
          <span className="text-foreground truncate max-w-[100px] sm:max-w-[150px]">{displayManagerName}</span>
        </div>
        {product.lastUpdated && (
          <div className="flex items-center gap-1.5" title={`Latest Update: ${isValid(new Date(product.lastUpdated)) ? format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a") : 'Invalid Date'}`}>
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-muted-foreground">Latest Update:</span>
            <span className="text-foreground">{isValid(new Date(product.lastUpdated)) ? format(new Date(product.lastUpdated), "MMM dd, yyyy, hh:mm a") : 'Invalid Date'}</span>
          </div>
        )}
      </div>
    );
  };

export default ProductSummaryCard;
