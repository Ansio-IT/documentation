
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { OwnerSetting } from '@/lib/types';
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
import { Switch } from "@/components/ui/switch"; // Import Switch
import { ScrollArea } from '@/components/ui/scroll-area';

// Updated schema to match 'managers' table structure and OwnerSetting type
const ownerSettingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(), // Role is nullable
  isActive: z.boolean(),
});

type OwnerSettingFormData = z.infer<typeof ownerSettingSchema>;

interface EditOwnerSettingModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  ownerSetting: OwnerSetting | null;
  onUpdateOwnerSetting: (settingId: string, data: Partial<OwnerSettingFormData>) => Promise<boolean>; // Data type matches form
}

export function EditOwnerSettingModal({
  isOpen,
  onOpenChange,
  ownerSetting,
  onUpdateOwnerSetting,
}: EditOwnerSettingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<OwnerSettingFormData>({
    resolver: zodResolver(ownerSettingSchema),
  });

  useEffect(() => {
    if (ownerSetting && isOpen) {
      setValue('name', ownerSetting.name);
      setValue('role', ownerSetting.role || ''); // Handle optional role
      setValue('isActive', ownerSetting.isActive);
    } else if (!isOpen) {
      reset({ // Reset to match OwnerSettingFormData defaults
        name: '',
        role: '',
        isActive: true,
      }); 
    }
  }, [ownerSetting, isOpen, setValue, reset]);

  const onSubmit = async (data: OwnerSettingFormData) => {
    if (!ownerSetting) return;
    setIsSubmitting(true);
    const success = await onUpdateOwnerSetting(ownerSetting.id, data);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!ownerSetting) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit Manager Setting</DialogTitle>
          <DialogDescription>
            Update the details for manager: {ownerSetting.name}.
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
                      id="editIsActiveOwner"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="editIsActiveOwner" className="cursor-pointer">Is Active</Label>
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
