
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { MarketSetting } from '@/lib/types';
import { fetchAllMarketSettings, addMarketSettingAction, updateMarketSettingAction } from '@/app/actions/market-settings.actions';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit } from 'lucide-react';
import { EditMarketSettingModal } from '@/components/settings/edit-market-setting-modal';

const marketSettingSchema = z.object({
  marketName: z.string().min(1, "Market Name is required"),
  currencySymbol: z.string().min(1, "Currency Symbol is required"),
  domainIdentifier: z.string().min(1, "Domain Identifier is required (e.g., https://www.amazon.com or www.amazon.com)"),
  isActive: z.boolean(),
});

type MarketSettingFormData = z.infer<typeof marketSettingSchema>;

export default function MarketMasterPage() {
  const [marketSettings, setMarketSettings] = useState<MarketSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMarketForEdit, setSelectedMarketForEdit] = useState<MarketSetting | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<MarketSettingFormData>({
    resolver: zodResolver(marketSettingSchema),
    defaultValues: {
      marketName: '',
      currencySymbol: '',
      domainIdentifier: '',
      isActive: true,
    },
  });

  const loadMarketSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await fetchAllMarketSettings();
      setMarketSettings(settings);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load market settings.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadMarketSettings();
  }, [loadMarketSettings]);

  const onSubmit = async (data: MarketSettingFormData) => {
    setIsSubmitting(true);
    const result = await addMarketSettingAction(data);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      reset();
      loadMarketSettings();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleOpenEditModal = (market: MarketSetting) => {
    setSelectedMarketForEdit(market);
    setIsEditModalOpen(true);
  };

  const handleUpdateMarketSetting = async (settingId: string, data: Partial<MarketSettingFormData>) => { 
    const result = await updateMarketSettingAction(settingId, data);
    if (result.success) {
      toast({ title: "Success", description: "Market setting updated successfully." });
      loadMarketSettings(); 
      return true;
    } else {
      toast({ title: "Error updating market", description: result.message, variant: "destructive" });
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Market Master</h1>
      <p className="text-muted-foreground">Manage market names, currency symbols, domain identifiers, and their active status. The Domain Identifier should be a full URL (e.g., https://www.amazon.com) or a hostname (e.g., www.amazon.com) used for webhook matching and link construction.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add New Market</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              <div>
                <Label htmlFor="marketName">Market Name (e.g., US, EU)</Label>
                <Controller
                  name="marketName"
                  control={control}
                  render={({ field }) => <Input id="marketName" {...field} placeholder="UK" />}
                />
                {errors.marketName && <p className="text-sm text-destructive mt-1">{errors.marketName.message}</p>}
              </div>
              <div>
                <Label htmlFor="currencySymbol">Currency Symbol</Label>
                <Controller
                  name="currencySymbol"
                  control={control}
                  render={({ field }) => <Input id="currencySymbol" {...field} placeholder="£" />}
                />
                {errors.currencySymbol && <p className="text-sm text-destructive mt-1">{errors.currencySymbol.message}</p>}
              </div>
              <div className="md:col-span-2 lg:col-span-1">
                <Label htmlFor="domainIdentifier">Domain Identifier</Label>
                <Controller
                  name="domainIdentifier"
                  control={control}
                  render={({ field }) => <Input id="domainIdentifier" {...field} placeholder="https://www.amazon.co.uk or www.amazon.co.uk" />}
                />
                {errors.domainIdentifier && <p className="text-sm text-destructive mt-1">{errors.domainIdentifier.message}</p>}
                 <p className="text-xs text-muted-foreground mt-1">Full URL or hostname. Used for webhook matching and link construction.</p>
              </div>
              <div className="flex flex-col space-y-1.5 pt-2">
                <Label htmlFor="isActive" className="mb-1">Is Active</Label>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                  )}
                />
                {errors.isActive && <p className="text-sm text-destructive mt-1">{errors.isActive.message}</p>}
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" />
              {isSubmitting ? "Adding..." : "Add Market"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Existing Markets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading market settings...</p>
          ) : marketSettings.length === 0 ? (
            <p className="text-muted-foreground">No market settings found. Add one above.</p>
          ) : (
            <Table>
              <TableCaption>A list of your configured markets.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Market Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Domain Identifier</TableHead>
                  <TableHead>Is Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketSettings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell className="font-medium">{setting.marketName}</TableCell>
                    <TableCell>{setting.currencySymbol}</TableCell>
                    <TableCell>{setting.domainIdentifier}</TableCell>
                    <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${setting.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {setting.isActive ? 'Yes' : 'No'}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(setting)} className="h-8 w-8" title="Edit Market">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <EditMarketSettingModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        marketSetting={selectedMarketForEdit}
        onUpdateMarketSetting={handleUpdateMarketSetting}
      />
    </div>
  );
}
