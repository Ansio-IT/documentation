// Handles all filter controls for the marketing data table
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, XIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/lib/types';

interface FiltersProps {
  selectedDatePreset: string;
  setSelectedDatePreset: (v: string) => void;
  dateRange?: DateRange;
  setDateRange: (v: DateRange | undefined) => void;
  clearCustomDateRange: () => void;
  availableOwners: string[];
  selectedOwner?: string;
  setSelectedOwner: (v: string | undefined) => void;
  availablePortfolios: string[];
  selectedPortfolio?: string;
  setSelectedPortfolio: (v: string | undefined) => void;
  globalFilter: string;
  setGlobalFilter: (v: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  selectedDatePreset,
  setSelectedDatePreset,
  dateRange,
  setDateRange,
  clearCustomDateRange,
  availableOwners,
  selectedOwner,
  setSelectedOwner,
  availablePortfolios,
  selectedPortfolio,
  setSelectedPortfolio,
  globalFilter,
  setGlobalFilter,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
    {/* Date Preset */}
    <div className="flex flex-col">
      <Label htmlFor="date-preset-filter" className="text-xs font-medium text-muted-foreground mb-1">Date</Label>
      <Select value={selectedDatePreset} onValueChange={setSelectedDatePreset}>
        <SelectTrigger id="date-preset-filter">
          <SelectValue placeholder="Select date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="last7days">Last 7 Days</SelectItem>
          <SelectItem value="last30days">Last 30 Days</SelectItem>
          <SelectItem value="last90days">Last 90 Days</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
          <SelectItem value="alltime">All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
    {/* Custom Date Range */}
    {selectedDatePreset === 'custom' && (
      <>
        <div className="flex flex-col">
          <Label htmlFor="start-date-picker" className="text-xs font-medium text-muted-foreground mb-1">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="start-date-picker"
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateRange?.from} onSelect={(day) => setDateRange({ ...dateRange, from: day })} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="end-date-picker" className="text-xs font-medium text-muted-foreground mb-1">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="end-date-picker"
                variant={"outline"}
                className={cn("w-full justify-start text-left font-normal", !dateRange?.to && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateRange?.to} onSelect={(day) => setDateRange({ ...dateRange, to: day })} disabled={{ before: dateRange?.from }} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </>
    )}
    {(selectedDatePreset === 'custom' && (dateRange?.from || dateRange?.to)) && (
      <div className="flex items-end">
        <Button variant="ghost" onClick={clearCustomDateRange} size="icon" className="shrink-0 h-10 w-10" title="Clear custom dates">
          <XIcon className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Clear date filter</span>
        </Button>
      </div>
    )}
    {/* Owner Filter */}
    <div className="flex flex-col">
      <Label htmlFor="owner-filter" className="text-xs font-medium text-muted-foreground mb-1">Owner (Person)</Label>
      <Select value={selectedOwner || ''} onValueChange={(value) => setSelectedOwner(value === 'all' ? undefined : value)}>
        <SelectTrigger id="owner-filter">
          <SelectValue placeholder="All Owners" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Owners</SelectItem>
          {availableOwners.map(owner => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {/* Portfolio Filter */}
    <div className="flex flex-col">
      <Label htmlFor="portfolio-filter" className="text-xs font-medium text-muted-foreground mb-1">Portfolio</Label>
      <Select value={selectedPortfolio || ''} onValueChange={(value) => setSelectedPortfolio(value === 'all' ? undefined : value)}>
        <SelectTrigger id="portfolio-filter">
          <SelectValue placeholder="All Portfolios" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Portfolios</SelectItem>
          {availablePortfolios.map(portfolio => <SelectItem key={portfolio} value={portfolio}>{portfolio}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {/* Global Search */}
    <div className="relative flex flex-col xl:col-start-1">
      <Label htmlFor="adv-global-filter" className="text-xs font-medium text-muted-foreground mb-1">Global Search</Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="adv-global-filter"
          placeholder="Search table..."
          value={globalFilter ?? ''}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="pl-8 w-full"
        />
      </div>
    </div>
  </div>
);

export default Filters;
