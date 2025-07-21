
"use client";

import Image from "next/image";
import type { Product } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, DollarSign, ShoppingBag, Package } from "lucide-react"; 
import { AIDescriptionGenerator } from "./ai-description-generator";
import React from "react";

// Placeholder icons if specific ones are not found in lucide-react
const Headphones: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
);
const Shirt: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20.38 3.46 16 2a4 4 0 0 0-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>
);
const Coffee: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 8V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M10 8h4"/><path d="M10 12h4"/><path d="M10 16h4"/><path d="M18 10v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/></svg>
);
const Cpu: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>
);
const Dumbbell: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 5.343a2.828 2.828 0 1 1 0 4L14.4 13.657a2.829 2.829 0 0 1-4.001 0L5.343 9.343a2.828 2.828 0 1 1 4-4L13.657 9.6a2.829 2.829 0 0 1 0 4.001Z"/><path d="m21.5 21.5-2.5-2.5"/><path d="m5 5-2.5-2.5"/></svg>
);

const CategoryIcon: React.FC<{ category?: string }> = ({ category }) => {
  switch (category?.toLowerCase()) {
    case "electronics":
      return <Headphones className="h-4 w-4 text-muted-foreground" />;
    case "apparel":
    case "clothing":
      return <Shirt className="h-4 w-4 text-muted-foreground" />;
    case "lifestyle":
      return <Coffee className="h-4 w-4 text-muted-foreground" />;
    case "appliances":
      return <Cpu className="h-4 w-4 text-muted-foreground" />; 
    case "fitness":
      return <Dumbbell className="h-4 w-4 text-muted-foreground" />;
    case "furniture": 
      return <ShoppingBag className="h-4 w-4 text-muted-foreground" />; 
    default:
      return <Package className="h-4 w-4 text-muted-foreground" />;
  }
};


export function ProductCard({ product }: {product: Product}) { 
  const [isGeneratorOpen, setIsGeneratorOpen] = React.useState(false);
  const dataAiHint = product.dataAiHint || product.category?.split(" ")[0]?.toLowerCase() || product.name?.split(" ")[0]?.toLowerCase() || "product"; // Adjusted fallback


  return (
    <>
      <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl overflow-hidden bg-card">
        <CardHeader className="p-0">
          <div className="aspect-[3/2] relative w-full">
            <Image
              src={product.imageUrl || "https://placehold.co/600x400.png"}
              alt={product.name || "Product Image"} // Used product.name
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              data-ai-hint={dataAiHint}
            />
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <CardTitle 
            className="text-lg font-semibold mb-1 leading-tight truncate"
            title={product.name || "N/A"} // Used product.name
          >
            {product.name || "N/A"} 
          </CardTitle>
          {product.category && (
            <div className="flex items-center space-x-2 mb-2">
              <CategoryIcon category={product.category} />
              <Badge variant="secondary" className="text-xs">{product.category}</Badge>
            </div>
          )}
          <CardDescription 
            className="text-sm text-muted-foreground mb-3 truncate"
            title={product.description || "No description available."}
          >
            {product.description || "No description available."}
          </CardDescription>
          <div className="flex items-center text-primary font-semibold text-lg">
            <DollarSign className="h-5 w-5 mr-1" />
            £{(product.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 border-t mt-auto">
          <Button 
            variant="default" 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setIsGeneratorOpen(true)}
            // Pass product.name to AI generator if it expects 'title' from old type
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Enhance Description
          </Button>
        </CardFooter>
      </Card>
      {product && ( 
        <AIDescriptionGenerator
          isOpen={isGeneratorOpen}
          onOpenChange={setIsGeneratorOpen}
          // Pass product.name if AI generator expects 'title' or adjust AI generator input
          product={{...product, title: product.name || '' }} // Adapt for AI generator if needed
        />
      )}
    </>
  );
}
