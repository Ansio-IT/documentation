"use client";

import * as React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Menu, LayoutDashboard, Settings, Store, Users, FileSpreadsheet, ClipboardList, BarChart3, KeyRound } from "lucide-react";

export function AppSidebar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  if (!hasMounted) {
    // Render nothing or a basic placeholder on the server and initial client render
    // This avoids the hydration mismatch for the Sheet component.
    // A simple button placeholder that doesn't rely on complex client-side state might also work,
    // but null is safest for ensuring server/client match initially.
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:flex">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px] bg-card p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-lg font-semibold text-primary">Product Dashboard</SheetTitle>
          <SheetDescription className="text-xs">Navigation Menu</SheetDescription>
        </SheetHeader>
        <nav className="flex-grow p-4 space-y-1">
          <Button asChild variant="ghost" className="w-full justify-start text-sm">
            <Link href="/" onClick={handleLinkClick}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>

          <Button asChild variant="ghost" className="w-full justify-start text-sm">
            <Link href="/depletion" onClick={handleLinkClick}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Depletion Report
            </Link>
          </Button>

          <Button asChild variant="ghost" className="w-full justify-start text-sm">
            <Link href="/brand-analytics" onClick={handleLinkClick}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Brand Analytics &amp; SOV% Report
            </Link>
          </Button>

          <Button asChild variant="ghost" className="w-full justify-start text-sm">
            <Link href="/settings/advertisement-details" onClick={handleLinkClick}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Advertisement Details
            </Link>
          </Button>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="settings" className="border-b-0">
              <AccordionTrigger className="py-2 px-3 hover:bg-muted/50 rounded-md text-sm font-medium hover:no-underline">
                <div className="flex items-center">
                   <Settings className="mr-2 h-4 w-4" />
                   Settings
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-4 pt-1 pb-0">
                 <Button asChild variant="ghost" className="w-full justify-start text-sm font-normal h-9">
                   <Link href="/settings/keyword-master" onClick={handleLinkClick}>
                    <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    Keyword Master
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full justify-start text-sm font-normal h-9">
                   <Link href="/settings/market-master" onClick={handleLinkClick}>
                    <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                    Market Master
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full justify-start text-sm font-normal h-9">
                   <Link href="/settings/manager-master" onClick={handleLinkClick}>
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    Manager Master
                  </Link>
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </nav>
        <SheetFooter className="p-4 border-t">
          <SheetClose asChild>
            <Button variant="outline" className="w-full text-sm">Close Menu</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
