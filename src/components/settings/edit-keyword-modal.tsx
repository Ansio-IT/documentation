
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Keyword, PortfolioSetting, Priority } from '@/lib/types';
import { fetchAllPortfoliosAction, fetchSubPortfoliosAction, fetchPortfolioWithParentAction } from '@/app/actions';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const editKeywordSchema = z.object({
  portfolio_id: z.string().optional().nullable(),
  subportfolio_id: z.string().optional().nullable(),
  priority_id: z.string().optional().nullable(),
});

type EditKeywordFormData = z.infer<typeof editKeywordSchema>;

const NONE_VALUE = 'none';

interface EditKeywordModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  keyword: Keyword | null;
  portfolios: PortfolioSetting[];
  priorities: Priority[];
  onUpdateKeyword: (keywordId: string, data: Partial<EditKeywordFormData>) => Promise<boolean>;
}

export function EditKeywordModal({
  isOpen,
  onOpenChange,
  keyword,
  portfolios,
  priorities,
  onUpdateKeyword,
}: EditKeywordModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subPortfolios, setSubPortfolios] = useState<PortfolioSetting[]>([]);
  const { toast } = useToast();

  const { control, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm<EditKeywordFormData>({
    resolver: zodResolver(editKeywordSchema),
    defaultValues: {
      portfolio_id: '',
      subportfolio_id: '',
      priority_id: '',
    }
  });

  const selectedPortfolioId = watch('portfolio_id');

  const populateSubportfolios = useCallback(async (portfolioId: string) => {
    if (portfolioId && portfolioId !== NONE_VALUE) {
      const fetchedSubportfolios = await fetchSubPortfoliosAction(portfolioId);
      setSubPortfolios(fetchedSubportfolios);
    } else {
      setSubPortfolios([]);
    }
  }, []);

  useEffect(() => {
    const initializeForm = async () => {
      if (keyword && isOpen) {
        let parentPortfolioId: string | null = null;
        let subPortfolioId: string | null = null;

        if (keyword.portfolio_id) {
          // This ID could be a top-level or a sub-level portfolio
          const portfolioInfo = await fetchPortfolioWithParentAction(keyword.portfolio_id);
          if (portfolioInfo?.parent) {
            // It's a subportfolio
            parentPortfolioId = portfolioInfo.parent.id;
            subPortfolioId = portfolioInfo.portfolio.id;
            await populateSubportfolios(parentPortfolioId);
          } else if(portfolioInfo) {
            // It's a top-level portfolio
            parentPortfolioId = portfolioInfo.portfolio.id;
            subPortfolioId = NONE_VALUE; // No subportfolio selected
            await populateSubportfolios(parentPortfolioId);
          }
        }
        
        reset({
          portfolio_id: parentPortfolioId || NONE_VALUE,
          subportfolio_id: subPortfolioId || NONE_VALUE,
          priority_id: keyword.priority_id || NONE_VALUE,
        });
      }
    };
    initializeForm();
  }, [keyword, isOpen, reset, populateSubportfolios]);


  useEffect(() => {
    if (selectedPortfolioId) {
      populateSubportfolios(selectedPortfolioId);
    }
  }, [selectedPortfolioId, populateSubportfolios]);


  const onSubmit = async (data: EditKeywordFormData) => {
    if (!keyword) return;

    // The field to save is the subportfolio_id. If it's 'none', we save the parent portfolio_id.
    const finalPortfolioId = data.subportfolio_id && data.subportfolio_id !== NONE_VALUE 
                                ? data.subportfolio_id 
                                : (data.portfolio_id && data.portfolio_id !== NONE_VALUE ? data.portfolio_id : null);

    setIsSubmitting(true);
    
    const payload = {
        portfolio_id: finalPortfolioId,
        priority_id: data.priority_id === NONE_VALUE ? null : data.priority_id,
        // We only send portfolio_id and priority_id, not subportfolio_id
    };
    
    // Construct a different payload for the onUpdateKeyword function if needed
    const updatePayload: Partial<EditKeywordFormData> = {
        portfolio_id: payload.portfolio_id,
        priority_id: payload.priority_id,
    };
    
    const success = await onUpdateKeyword(keyword.id, updatePayload);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!keyword) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Keyword: <span className="text-primary">{keyword.keyword}</span></DialogTitle>
          <DialogDescription>
            Update the portfolio and priority for this keyword.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit_portfolio_id">Portfolio</Label>
            <Controller
              name="portfolio_id"
              control={control}
              render={({ field }) => (
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue('subportfolio_id', NONE_VALUE, { shouldDirty: true });
                  }} 
                  value={field.value || ''}
                >
                  <SelectTrigger id="edit_portfolio_id">
                    <SelectValue placeholder="Select Portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="edit_subportfolio_id">Subportfolio</Label>
            <Controller
              name="subportfolio_id"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ''}
                  disabled={!selectedPortfolioId || selectedPortfolioId === NONE_VALUE || subPortfolios.length === 0}
                >
                  <SelectTrigger id="edit_subportfolio_id">
                    <SelectValue placeholder="Select Subportfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {subPortfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="edit_priority_id">Priority</Label>
            <Controller
              name="priority_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <SelectTrigger id="edit_priority_id">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {priorities.map(p => <SelectItem key={p.priority_id} value={p.priority_id}>{p.priority_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
