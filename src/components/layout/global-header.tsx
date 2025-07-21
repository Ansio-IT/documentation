
"use client";

import React from 'react';
import { AppSidebar } from './sidebar';
import Link from 'next/link';

export function GlobalHeader() {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50 py-3">
      <div className="px-4"> {/* Removed container mx-auto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AppSidebar />
            <Link href="/" className="text-2xl font-bold text-primary hover:text-primary/90">
              Retail Sales Portal
            </Link>
          </div>
          {/* Add any other truly global elements here, e.g., user profile, notifications icon */}
        </div>
      </div>
    </header>
  );
}
