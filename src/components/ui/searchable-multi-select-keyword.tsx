
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X as RemoveIcon, Check, Search } from 'lucide-react';
import type { Keyword } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SearchableMultiSelectKeywordProps {
  value: string[]; // Array of selected keyword IDs
  onChange: (newValue: string[]) => void;
  availableKeywords: Keyword[]; // All possible keywords { id, keyword }
  placeholder?: string;
}

export function SearchableMultiSelectKeyword({
  value: selectedKeywordIds,
  onChange,
  availableKeywords,
  placeholder = "Search and select keywords...",
}: SearchableMultiSelectKeywordProps) {
  const [inputValue, setInputValue] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const selectedKeywords = availableKeywords.filter(kw => selectedKeywordIds.includes(kw.id));
  
  const filteredKeywords = availableKeywords.filter(kw => 
    kw.keyword.toLowerCase().includes(inputValue.toLowerCase()) && !selectedKeywordIds.includes(kw.id)
  );

  const handleSelect = (keywordId: string) => {
    if (!selectedKeywordIds.includes(keywordId)) {
      onChange([...selectedKeywordIds, keywordId]);
    } else {
      handleRemove(keywordId); // Allow unselecting from the list
    }
    setInputValue('');
  };

  const handleRemove = (keywordIdToRemove: string) => {
    onChange(selectedKeywordIds.filter(id => id !== keywordIdToRemove));
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isPopoverOpen}
          className="w-full justify-start h-auto min-h-10 py-2 px-3"
        >
          <div className="flex flex-wrap gap-1 items-center flex-grow">
            {selectedKeywords.length > 0 ? (
              selectedKeywords.map(kw => (
                <Badge
                  key={kw.id}
                  variant="secondary"
                  className="py-0.5 px-2 flex items-center gap-1"
                >
                  {kw.keyword}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${kw.keyword}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(kw.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(kw.id);
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search keywords..."
            value={inputValue}
            onValueChange={setInputValue}
            className="text-sm"
          />
          <CommandList>
            <CommandEmpty>No matching keywords found.</CommandEmpty>
            <CommandGroup>
              {filteredKeywords.map(kw => (
                <CommandItem
                  key={kw.id}
                  value={kw.keyword}
                  onSelect={() => handleSelect(kw.id)}
                  className="cursor-pointer text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedKeywordIds.includes(kw.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {kw.keyword}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
