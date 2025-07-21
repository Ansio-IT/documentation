
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ManagerSetting } from '@/lib/types'; // Renamed from OwnerSetting
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; 
import { ScrollArea } from '@/components/ui/scroll-area';


const managerSettingSchema = z.object({ // Renamed from ownerSettingSchema
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(), 
  isActive: z.boolean(),
});

type ManagerSettingFormData = z.infer<typeof managerSettingSchema>; // Renamed

interface EditManagerSettingModalProps { // Renamed
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  managerSetting: ManagerSetting | null; // Renamed from ownerSetting
  onUpdateManagerSetting: (settingId: string, data: Partial<ManagerSettingFormData>) => Promise<boolean>; // Renamed
}

export function EditManagerSettingModal({ // Renamed
  isOpen,
  onOpenChange,
  managerSetting, // Renamed
  onUpdateManagerSetting, // Renamed
}: EditManagerSettingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<ManagerSettingFormData>({
    resolver: zodResolver(managerSettingSchema),
  });

  useEffect(() => {
    if (managerSetting && isOpen) { // Renamed
      setValue('name', managerSetting.name);
      setValue('role', managerSetting.role || ''); 
      setValue('isActive', managerSetting.isActive);
    } else if (!isOpen) {
      reset({ 
        name: '',
        role: '',
        isActive: true,
      }); 
    }
  }, [managerSetting, isOpen, setValue, reset]); // Renamed

  const onSubmit = async (data: ManagerSettingFormData) => {
    if (!managerSetting) return; // Renamed
    setIsSubmitting(true);
    const success = await onUpdateManagerSetting(managerSetting.id, data); // Renamed
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!managerSetting) return null; // Renamed

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit Manager Setting</DialogTitle> {/* Renamed */}
          <DialogDescription>
            Update the details for manager: {managerSetting.name}. {/* Renamed */}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ScrollArea className="max-h-[calc(100vh-200px)] p-1 pr-6">
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editName">Name</Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input id="editName" {...field} placeholder="Jane Smith" />}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="editRole">Role (Optional)</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => <Input id="editRole" {...field} placeholder="Admin / Contributor" />}
                />
                {errors.role && <p className="text-sm text-destructive mt-1">{errors.role.message}</p>}
              </div>
              <div className="flex items-center space-x-2 pt-2">
                 <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="editIsActiveManager" // Renamed id
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="editIsActiveManager" className="cursor-pointer">Is Active</Label> {/* Renamed htmlFor */}
                {errors.isActive && <p className="text-sm text-destructive mt-1">{errors.isActive.message}</p>}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
