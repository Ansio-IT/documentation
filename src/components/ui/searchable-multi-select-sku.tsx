
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X as RemoveIcon, Loader2, Search } from 'lucide-react';
import { searchAssociatedProductsAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { productsService } from '@/server/services/products';
import { fetchProductByIdAction } from '@/app/actions/product.actions';


interface SearchResult {
  id: string;
  productCode: string;
  name: string | null;
}

interface SearchableMultiSelectSkuProps {
  value: string[]; // Array of selected product IDs
  onChange: (newValue: string[]) => void;
  placeholder?: string;
  currentProductId?: string;
}

export function SearchableMultiSelectSku({
  value: selectedProductIds,
  onChange,
  placeholder = "Search and select products...",
  currentProductId,
}: SearchableMultiSelectSkuProps) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Map<string, SearchResult>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSelectedDetails = async () => {
        const newDetails = new Map(selectedProductDetails);
        let changed = false;
        for (const id of selectedProductIds) {
            if (!newDetails.has(id)) {
                const product = await fetchProductByIdAction(id);
                if (product) {
                    newDetails.set(id, { id: product.id, productCode: product.productCode, name: product.name || null });
                    changed = true;
                }
            }
        }
        if (changed) {
            setSelectedProductDetails(newDetails);
        }
    };
    if (selectedProductIds.length > 0) {
        fetchSelectedDetails();
    }
  }, [selectedProductIds]);

  const debouncedSearch = useCallback(
    debounce(async (searchTerm: string) => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const results = await searchAssociatedProductsAction(searchTerm, currentProductId);
        setSearchResults(results.filter(r => !selectedProductIds.includes(r.id)));
      } catch (error) {
        console.error("Failed to search products:", error);
        setSearchResults([]);
      }
      setIsLoading(false);
    }, 300),
    [selectedProductIds, currentProductId]
  );

  useEffect(() => {
    debouncedSearch(inputValue);
  }, [inputValue, debouncedSearch]);

  const handleSelect = (product: SearchResult) => {
    if (!selectedProductIds.includes(product.id)) {
      onChange([...selectedProductIds, product.id]);
      const newDetails = new Map(selectedProductDetails);
      newDetails.set(product.id, product);
      setSelectedProductDetails(newDetails);
    }
    setInputValue('');
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleRemove = (productIdToRemove: string) => {
    onChange(selectedProductIds.filter(id => id !== productIdToRemove));
    const newDetails = new Map(selectedProductDetails);
    newDetails.delete(productIdToRemove);
    setSelectedProductDetails(newDetails);
  };
  
  const handleInputFocus = () => {
    setIsPopoverOpen(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
       if (!inputRef.current?.contains(document.activeElement) && !document.querySelector('[data-radix-popper-content-wrapper]')?.contains(document.activeElement) ) {
         setIsPopoverOpen(false);
       }
    }, 150);
  };
  
  const displayBadges = selectedProductIds.map(id => selectedProductDetails.get(id)).filter(Boolean) as SearchResult[];

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild ref={triggerRef}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isPopoverOpen}
          className="w-full justify-start h-auto min-h-10 py-2 px-3"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        >
          <div className="flex flex-wrap gap-1 items-center flex-grow">
            {displayBadges.length > 0 ? (
              displayBadges.map(p => (
                <Badge
                  key={p.id}
                  variant="secondary"
                  className="py-0.5 px-2 flex items-center gap-1"
                >
                  {p.productCode}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${p.productCode}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(p.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(p.id);
                      }
                    }}
                    className="rounded-full hover:bg-muted-foreground/20 p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <RemoveIcon className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
           <Search className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0" 
        side="bottom" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder="Search by SKU or name..."
            value={inputValue}
            onValueChange={setInputValue}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="text-sm"
          />
          <CommandList>
            {isLoading && (
              <div className="p-2 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </div>
            )}
            {!isLoading && inputValue.trim().length > 1 && searchResults.length === 0 && (
              <CommandEmpty>No matching products found.</CommandEmpty>
            )}
            {!isLoading && searchResults.length > 0 && (
              <CommandGroup heading="Suggestions">
                {searchResults.map(product => (
                  <CommandItem
                    key={product.id}
                    value={`${product.productCode} - ${product.name}`}
                    onSelect={() => handleSelect(product)}
                    className="cursor-pointer text-sm"
                  >
                    <div className="flex flex-col">
                        <span className="font-medium">{product.productCode}</span>
                        {product.name && <span className="text-xs text-muted-foreground">{product.name}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
