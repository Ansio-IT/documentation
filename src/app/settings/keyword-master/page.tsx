
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Keyword, PortfolioSetting, Priority } from '@/lib/types';
import { 
  fetchAllKeywordsAction, 
  addKeywordAction, 
  deleteKeywordAction, 
  fetchAllPortfoliosAction, 
  fetchSubPortfoliosAction, 
  fetchActivePrioritiesAction,
  updateKeywordAction,
  fetchPortfolioWithParentAction,
} from '@/app/actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Edit, KeyRound } from 'lucide-react';
import { DeleteKeywordDialog } from '@/components/settings/delete-keyword-dialog';
import { EditKeywordModal } from '@/components/settings/edit-keyword-modal';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const keywordSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword cannot be empty"),
  portfolio_id: z.string().optional().nullable(),
  subportfolio_id: z.string().optional().nullable(),
  priority_id: z.string().optional().nullable(),
});

type KeywordFormData = z.infer<typeof keywordSchema>;

const NONE_VALUE = 'none';

export default function KeywordMasterPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [portfolios, setPortfolios] = useState<PortfolioSetting[]>([]);
  const [subPortfolios, setSubPortfolios] = useState<PortfolioSetting[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedKeywordForDelete, setSelectedKeywordForDelete] = useState<Keyword | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedKeywordForEdit, setSelectedKeywordForEdit] = useState<Keyword | null>(null);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<KeywordFormData>({
    resolver: zodResolver(keywordSchema),
    defaultValues: {
      keyword: '',
      portfolio_id: '',
      subportfolio_id: '',
      priority_id: '',
    },
  });

  const selectedPortfolioId = watch('portfolio_id');

  const loadKeywords = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedKeywords, fetchedPortfolios, fetchedPriorities] = await Promise.all([
        fetchAllKeywordsAction(),
        fetchAllPortfoliosAction(),
        fetchActivePrioritiesAction(),
      ]);
      setKeywords(fetchedKeywords);
      setPortfolios(fetchedPortfolios);
      setPriorities(fetchedPriorities);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  useEffect(() => {
    if (selectedPortfolioId && selectedPortfolioId !== NONE_VALUE) {
      fetchSubPortfoliosAction(selectedPortfolioId).then(setSubPortfolios);
    } else {
      setSubPortfolios([]);
    }
  }, [selectedPortfolioId]);

  const onSubmit = async (data: KeywordFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Omit<Keyword, 'id' | 'createdAt' | 'updatedOn'> = {
        keyword: data.keyword,
        portfolio_id: data.subportfolio_id === NONE_VALUE || !data.subportfolio_id ? null : data.subportfolio_id,
        priority_id: data.priority_id === NONE_VALUE || !data.priority_id ? null : data.priority_id,
      };

      const result = await addKeywordAction(payload);
      
      if (result.success) {
        toast({ title: "Success", description: "Keyword added successfully!" });
        reset({ keyword: '', portfolio_id: '', subportfolio_id: '', priority_id: '' }); 
        loadKeywords();
      } else {
        toast({ title: "Error", description: result.message || "An unknown error occurred.", variant: "destructive" });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({ title: "Submission Error", description: `Failed to add keyword: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteDialog = (keyword: Keyword) => {
    setSelectedKeywordForDelete(keyword);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedKeywordForDelete) return;
    const result = await deleteKeywordAction(selectedKeywordForDelete.id);
    if (result.success) {
        toast({ title: "Success", description: "Keyword deleted successfully." });
        loadKeywords();
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsDeleteDialogOpen(false);
    setSelectedKeywordForDelete(null);
  };
  
  const handleOpenEditModal = (keyword: Keyword) => {
    setSelectedKeywordForEdit(keyword);
    setIsEditModalOpen(true);
  };

  const handleUpdateKeyword = async (keywordId: string, data: Partial<Omit<Keyword, 'id' | 'createdAt' | 'updatedOn'>>) => {
    const result = await updateKeywordAction(keywordId, data);
    if (result.success) {
      toast({ title: "Success", description: "Keyword updated successfully." });
      loadKeywords(); // Refresh data
      return true;
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
      return false;
    }
  };


  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Keyword Master</h1>
      <p className="text-muted-foreground">Add, view, and manage keywords and their associated portfolios and priorities.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add New Keyword</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="flex-grow">
                    <Label htmlFor="keyword">Keyword</Label>
                    <Controller name="keyword" control={control} render={({ field }) => <Input id="keyword" {...field} placeholder="e.g., dehumidifier" />} />
                    {errors.keyword && <p className="text-sm text-destructive mt-1">{errors.keyword.message}</p>}
                </div>
                <div>
                    <Label htmlFor="portfolio_id">Portfolio</Label>
                    <Controller name="portfolio_id" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger id="portfolio_id"><SelectValue placeholder="Select Portfolio" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
                <div>
                    <Label htmlFor="subportfolio_id">Subportfolio</Label>
                    <Controller name="subportfolio_id" control={control} render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedPortfolioId || selectedPortfolioId === NONE_VALUE || subPortfolios.length === 0}>
                            <SelectTrigger id="subportfolio_id"><SelectValue placeholder="Select Subportfolio" /></SelectTrigger>
                            <SelectContent>
                                 <SelectItem value={NONE_VALUE}>None</SelectItem>
                                {subPortfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
                <div>
                    <Label htmlFor="priority_id">Priority</Label>
                    <Controller name="priority_id" control={control} render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger id="priority_id"><SelectValue placeholder="Select Priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                {priorities.map(p => <SelectItem key={p.priority_id} value={p.priority_id}>{p.priority_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )} />
                </div>
                <div className="md:col-span-1 lg:col-span-1 flex items-end">
                    <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {isSubmitting ? "Adding..." : "Add Keyword"}
                    </Button>
                </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Existing Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading keywords...</p>
          ) : keywords.length === 0 ? (
             <p className="text-muted-foreground">No keywords found. Add one above.</p>
          ) : (
            <Table>
              <TableCaption>A list of your configured keywords.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Keyword</TableHead>
                  <TableHead className="text-left">Portfolio</TableHead>
                  <TableHead className="text-left">Subportfolio</TableHead>
                  <TableHead className="text-left">Priority</TableHead>
                  <TableHead className="text-left">Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((keyword, index) => (
                  <TableRow key={keyword.id} className={cn(index % 2 === 0 ? "bg-muted/50" : "")}>
                    <TableCell className="font-medium text-left">{keyword.keyword}</TableCell>
                    <TableCell className="text-left">{keyword.portfolioName || '-'}</TableCell>
                    <TableCell className="text-left">{keyword.subPortfolioName || '-'}</TableCell>
                    <TableCell className="text-left">
                      {priorities.find(p => p.priority_id === keyword.priority_id)?.priority_name || '-'}
                    </TableCell>
                    <TableCell className="text-left">{formatDate(keyword.createdAt)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(keyword)} className="h-8 w-8 text-primary hover:text-primary/90" title="Edit Keyword">
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(keyword)} className="h-8 w-8 text-destructive hover:text-destructive/90" title="Delete Keyword">
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <DeleteKeywordDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        keywordName={selectedKeywordForDelete?.keyword}
        onConfirmDelete={handleConfirmDelete}
      />
      {selectedKeywordForEdit && (
        <EditKeywordModal
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          keyword={selectedKeywordForEdit}
          portfolios={portfolios}
          priorities={priorities}
          onUpdateKeyword={handleUpdateKeyword}
        />
      )}
    </div>
  );
}
