
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ManagerSetting } from '@/lib/types';
import { fetchAllManagerSettings, addManagerSettingAction, updateManagerSettingAction } from '@/app/actions';
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
import { EditManagerSettingModal } from '@/components/settings/edit-manager-setting-modal';


const managerSettingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(), 
  isActive: z.boolean(),
});

type ManagerSettingFormData = z.infer<typeof managerSettingSchema>;

export default function ManagerMasterPage() {
  const [managerSettings, setManagerSettings] = useState<ManagerSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedManagerForEdit, setSelectedManagerForEdit] = useState<ManagerSetting | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ManagerSettingFormData>({
    resolver: zodResolver(managerSettingSchema),
    defaultValues: {
      name: '',
      role: '',
      isActive: true,
    },
  });

  const loadManagerSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await fetchAllManagerSettings();
      setManagerSettings(settings);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load manager settings.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadManagerSettings();
  }, [loadManagerSettings]);

  const onSubmit = async (data: ManagerSettingFormData) => {
    setIsSubmitting(true);
    const result = await addManagerSettingAction(data); 
    if (result.success) {
      toast({ title: "Success", description: result.message });
      reset(); 
      loadManagerSettings(); 
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleOpenEditModal = (manager: ManagerSetting) => {
    setSelectedManagerForEdit(manager);
    setIsEditModalOpen(true);
  };

  const handleUpdateManagerSetting = async (settingId: string, data: Partial<ManagerSettingFormData>) => {
    const result = await updateManagerSettingAction(settingId, data);
    if (result.success) {
      toast({ title: "Success", description: "Manager setting updated successfully." });
      loadManagerSettings();
      return true;
    } else {
      toast({ title: "Error updating manager", description: result.message, variant: "destructive" });
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Manager Master</h1>
      <p className="text-muted-foreground">Manage product managers, their roles, and active status.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add New Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div>
                <Label htmlFor="name">Name</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input id="name" {...field} placeholder="Jane Smith" />}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="role">Role (Optional)</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => <Input id="role" {...field} placeholder="Admin / Contributor" />}
                />
                {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
              </div>
              <div className="flex flex-col space-y-1.5 pt-2">
                <Label htmlFor="isActiveManager" className="mb-1">Is Active</Label>
                 <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="isActiveManager"
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
              {isSubmitting ? "Adding..." : "Add Manager"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Existing Managers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading manager settings...</p>
          ) : managerSettings.length === 0 ? (
             <p className="text-muted-foreground">No manager settings found. Add one above.</p>
          ) : (
            <Table>
              <TableCaption>A list of your configured managers.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Is Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerSettings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell className="font-medium">{setting.name}</TableCell>
                    <TableCell>{setting.role || 'N/A'}</TableCell>
                     <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${setting.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {setting.isActive ? 'Yes' : 'No'}
                        </span>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(setting)} className="h-8 w-8" title="Edit Manager">
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
      <EditManagerSettingModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        managerSetting={selectedManagerForEdit} // Renamed prop
        onUpdateManagerSetting={handleUpdateManagerSetting} // Renamed prop
      />
    </div>
  );
}
