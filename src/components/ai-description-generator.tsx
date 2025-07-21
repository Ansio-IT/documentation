
"use client";

import React, { useState, useEffect } from 'react';
import type { Product } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateEnhancedDescription, updateProductDescriptionInFirebase } from "@/app/actions"; // Corrected import
import { Sparkles } from 'lucide-react';

interface AIDescriptionGeneratorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: Product;
}

export function AIDescriptionGenerator({ isOpen, onOpenChange, product }: AIDescriptionGeneratorProps) {
  const [targetAudience, setTargetAudience] = useState(product.targetAudience || '');
  const [keywords, setKeywords] = useState(product.keywords || '');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens, using product data
      setTargetAudience(product.targetAudience || '');
      setKeywords(product.keywords || '');
      setGeneratedDescription('');
    }
  }, [isOpen, product]);

  const handleGenerate = async () => {
    if (!targetAudience.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a target audience.",
        variant: "destructive",
      });
      return;
    }
    // Keywords are optional for generation, but recommended
     if (!keywords.trim()) {
      toast({
        title: "Keywords Recommended",
        description: "Providing keywords helps generate a more targeted description.",
        variant: "default", // Not destructive, just a hint
      });
    }
    setIsGenerating(true);
    const result = await generateEnhancedDescription(
      product.title, // Use product.title instead of product.name
      product.description,
      targetAudience,
      keywords
    );
    setIsGenerating(false);

    if (result.success && result.description) {
      setGeneratedDescription(result.description);
      toast({
        title: "AI Description Generated",
        description: "Review the new description below.",
      });
    } else {
      toast({
        title: "AI Generation Failed",
        description: result.message || "Could not generate description.",
        variant: "destructive",
      });
    }
  };

  const handleApplyDescription = async () => {
    if (!generatedDescription) return;
    setIsApplying(true);
    // Pass targetAudience and keywords so they are saved along with the new description
    const result = await updateProductDescriptionInFirebase(product.id, generatedDescription, targetAudience, keywords);
    setIsApplying(false);

    if (result.success) {
      toast({
        title: "Description Updated",
        description: "Product description has been successfully updated.",
      });
      onOpenChange(false); // Close dialog on success
    } else {
      toast({
        title: "Update Failed",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-card shadow-xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            Enhance Product Description
          </DialogTitle>
          <DialogDescription>
            Generate compelling marketing copy for '{product.title}' using AI. {/* Use product.title */}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="targetAudience" className="text-right col-span-1">
              Target Audience
            </Label>
            <Input
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Tech enthusiasts, busy parents"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="keywords" className="text-right col-span-1">
              Keywords
            </Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="col-span-3"
              placeholder="e.g., innovative, user-friendly, durable"
            />
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating || !targetAudience.trim() } className="w-full mt-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {isGenerating ? "Generating..." : "Generate with AI"}
          </Button>

          {generatedDescription && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="generatedDescription">Generated Description:</Label>
              <Textarea
                id="generatedDescription"
                value={generatedDescription}
                readOnly
                rows={5}
                className="bg-muted/50"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying || isGenerating}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyDescription} 
            disabled={!generatedDescription || isApplying || isGenerating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isApplying ? "Applying..." : "Apply Description"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
