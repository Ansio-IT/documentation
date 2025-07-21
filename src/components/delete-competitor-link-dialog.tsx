
"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteCompetitorLinkDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  competitorAsin: string | undefined;
  onConfirmDelete: () => void;
}

export function DeleteCompetitorLinkDialog({ 
  isOpen, 
  onOpenChange, 
  competitorAsin, 
  onConfirmDelete 
}: DeleteCompetitorLinkDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will remove the competitor link for ASIN "{competitorAsin || 'this competitor'}" from this product. 
            The competitor's data in the main competitors database will not be affected.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Delete Link
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
