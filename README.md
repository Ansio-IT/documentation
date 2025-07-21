
# Product Showcase App

This is a Next.js application designed to fetch product data, store it in **Supabase**, and display it on a dashboard. It also features AI-powered product description enhancement and integration with an external data provider (Bright Data) for product updates.

## Features

-   **Product Listing**: View products fetched from Supabase. Each product on the dashboard shows key details from its primary market listing.
-   **Product Details Page**: Click on a product to see its detailed view (core product info + primary listing details) and linked competitor information (other listings marked as competitors).
-   **Supabase Integration**: Uses Supabase for data storage with tables for `products`, `product_listings`, `external_api_data`, `markets`, `managers`, and `sales_targets`.
-   **External API Sync (Bright Data)**: Functionality to trigger data refresh from Bright Data for your products and their competitors. Updates are received via a webhook.
-   **AI-Powered Descriptions**: Enhance product descriptions using a Genkit AI flow (updates `product_listings.data.description` and optionally the core `products.description`).
-   **Competitor Tracking**: Add competitor ASINs to your products. These create `product_listings` records flagged as competitors, linked to your main product. Their details can be synced via the Bright Data webhook and viewed on the product detail page.
-   **Settings Management**: Dedicated screens to manage Market and Manager master data.
-   **Advertisement Data Management**: Screen to upload and view marketing campaign data from Excel/CSV files.
-   **Depletion Report Configuration**: Configure inventory logistics (associated products, lead times stored on the product record) and sales targets for products.
-   **Theming**: Styled with a professional design using Tailwind CSS and ShadCN UI components.

## Getting Started

### Prerequisites

-   Node.js (version 18 or higher recommended)
-   npm or yarn
-   A Supabase project ([https://supabase.com/dashboard](https://supabase.com/dashboard))
-   A Bright Data account and API credentials (if using the live sync feature)

### Setup

1.  **Clone the repository (or download the files):**
    ```bash
    # If you had cloned a repo
    # git clone <repository-url>
    # cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Set up Supabase:**
    *   Create a Supabase project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
    *   In your Supabase project, go to the **SQL Editor** (under "Database").
    *   Run the following SQL commands to create the necessary tables. Adjust column types and constraints as needed.

        ```sql
        -- Markets Table (stores market configurations)
        CREATE TABLE public.markets (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            market_name TEXT NOT NULL,
            currency_symbol TEXT NOT NULL,
            domain_identifier TEXT NOT NULL, -- e.g., "www.amazon.com" or "https://www.amazon.co.uk/"
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT markets_pkey PRIMARY KEY (id),
            CONSTRAINT markets_market_name_key UNIQUE (market_name)
        );
        -- Trigger to automatically update markets.modified_on
        CREATE OR REPLACE FUNCTION public.update_markets_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_markets_updated_at
        BEFORE UPDATE ON public.markets
        FOR EACH ROW
        EXECUTE FUNCTION public.update_markets_modified_on_column();

        -- Managers Table (stores owner/manager information)
        CREATE TABLE public.managers (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            role TEXT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT managers_pkey PRIMARY KEY (id),
            CONSTRAINT managers_name_key UNIQUE (name)
        );
        -- Trigger to automatically update managers.modified_on
        CREATE OR REPLACE FUNCTION public.update_managers_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_managers_updated_at
        BEFORE UPDATE ON public.managers
        FOR EACH ROW
        EXECUTE FUNCTION public.update_managers_modified_on_column();

        -- Portfolios Table (placeholder for future portfolio management if needed)
        CREATE TABLE public.portfolios (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT portfolios_pkey PRIMARY KEY (id),
            CONSTRAINT portfolios_name_key UNIQUE (name)
        );
        -- (Optional: Trigger for portfolios.modified_on similar to others if needed)


        -- Core Products Table
        CREATE TABLE public.products (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NULL,
            barcode TEXT NOT NULL, -- Primary unique identifier (e.g., UPC, EAN)
            product_code TEXT NOT NULL, -- Your internal SKU
            portfolio_id uuid NULL, -- FK to a portfolios table
            description TEXT NULL,
            properties JSONB NULL, -- Replaced dimensions with generic properties
            image_url TEXT NULL, -- Direct image URL for the core product
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            associated_products TEXT[] NULL, -- For depletion report
            local_warehouse_lead_time SMALLINT NULL DEFAULT 14, -- For depletion report
            reorder_lead_time SMALLINT NULL DEFAULT 100, -- For depletion report
            CONSTRAINT products_pkey PRIMARY KEY (id),
            CONSTRAINT products_barcode_key UNIQUE (barcode),
            CONSTRAINT products_product_code_key UNIQUE (product_code),
            CONSTRAINT products_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES public.portfolios (id) ON UPDATE CASCADE ON DELETE SET NULL
        );
        -- Trigger to automatically update products.modified_on
        CREATE OR REPLACE FUNCTION public.update_products_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_products_updated_at
        BEFORE UPDATE ON public.products
        FOR EACH ROW
        EXECUTE FUNCTION public.update_products_modified_on_column();

        -- Product Listings Table (Market-specific data for your products and competitors)
        CREATE TABLE public.product_listings (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            product_id uuid NOT NULL, -- FK to your products.id
            market_id uuid NOT NULL, -- FK to markets.id
            manager_id uuid NOT NULL, -- FK to managers.id (Manager for this specific listing)
            data JSONB NULL,         -- Stores ASIN, price, currency, title, desc, BSR, images, URL from BrightData
            is_competitor BOOLEAN NOT NULL DEFAULT FALSE, -- True if this listing represents a competitor to product_id
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_on TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Add this for listings
            CONSTRAINT product_listings_pkey PRIMARY KEY (id),
            CONSTRAINT product_listings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_listings_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_listings_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers (id) ON UPDATE CASCADE ON DELETE RESTRICT, 
            -- Ensure a product can only have one non-competitor listing per market with the same ASIN
            CONSTRAINT product_listing_unique_product_market_asin UNIQUE (product_id, market_id, (data->>'asinCode'), is_competitor)
        );
        -- Trigger for product_listings.updated_on
        CREATE OR REPLACE FUNCTION public.update_product_listings_updated_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_product_listings_updated_at
        BEFORE UPDATE ON public.product_listings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_product_listings_updated_on_column();

        -- External API Data Table (to store raw responses from BrightData or other providers)
        CREATE TABLE public.external_api_data (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            product_listing_id uuid NULL, -- FK to product_listings.id
            provider CHARACTER VARYING NULL, -- e.g., "BrightData"
            data JSONB NULL, -- Raw JSON payload from the API
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT external_api_data_pkey PRIMARY KEY (id),
            CONSTRAINT external_api_data_product_listing_id_fkey FOREIGN KEY (product_listing_id) REFERENCES public.product_listings (id) ON UPDATE CASCADE ON DELETE SET NULL
        );

        -- Marketing Data Table
        CREATE TABLE public.marketing_data (
          id SERIAL NOT NULL, -- Auto-incrementing integer primary key
          date DATE NULL,
          asin TEXT NULL,
          product_code TEXT NULL,
          product_description TEXT NULL,
          person TEXT NULL,
          portfolio TEXT NULL,
          sub_portfolio TEXT NULL,
          total_qty_sold NUMERIC NULL,
          total_adv_units_sold NUMERIC NULL,
          total_revenue_ex_vat_cp NUMERIC NULL,
          total_sales_revenue_ex_vat_sp NUMERIC NULL,
          total_adv_spend NUMERIC NULL,
          total_adv_sales NUMERIC NULL,
          per_unit_adv_spend_on_total_qty_sold NUMERIC NULL,
          per_unit_adv_spend_on_adv_qty_sold NUMERIC NULL,
          marketing_percent NUMERIC NULL,
          acos_percent NUMERIC NULL,
          zero_adv_profit_sc NUMERIC NULL,
          zero_adv_profit_vc NUMERIC NULL,
          total_zero_adv_gross_profit NUMERIC NULL,
          total_gp NUMERIC NULL,
          gp_percent NUMERIC NULL,
          fba_stock INTEGER NULL,
          bww_actual_stock INTEGER NULL,
          vc_stock INTEGER NULL,
          total_stock INTEGER NULL,
          moh NUMERIC NULL,
          adv_marketplace TEXT NULL,
          created_at TIMESTAMPTZ NULL DEFAULT NOW(),
          CONSTRAINT marketing_data_pkey PRIMARY KEY (id),
          CONSTRAINT marketing_data_date_asin_unique UNIQUE (date, asin) -- Added unique constraint for upsert
        );

        -- Sales Targets Table
        CREATE TABLE public.sales_targets (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            product_id uuid NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            sales_forecast BIGINT NOT NULL,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ NULL,
            CONSTRAINT sales_targets_pkey PRIMARY KEY (id),
            CONSTRAINT sales_targets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products (id) ON UPDATE CASCADE ON DELETE CASCADE
        ) TABLESPACE pg_default;

        -- Enable Row Level Security (RLS) - STRONGLY RECOMMENDED
        ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.external_api_data ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.marketing_data ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies as needed (EXAMPLES - TAILOR TO YOUR NEEDS):
        -- Allow public read for settings tables (if needed for client-side dropdowns, otherwise restrict)
        CREATE POLICY "Public can read markets" ON public.markets FOR SELECT USING (true);
        CREATE POLICY "Public can read managers" ON public.managers FOR SELECT USING (true);
        CREATE POLICY "Public can read portfolios" ON public.portfolios FOR SELECT USING (true);
        -- Authenticated users can manage their own settings data
        CREATE POLICY "Authenticated users can manage markets" ON public.markets FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage managers" ON public.managers FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage portfolios" ON public.portfolios FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can read product listings" ON public.product_listings FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage product listings" ON public.product_listings FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can manage external_api_data" ON public.external_api_data FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage marketing_data" ON public.marketing_data FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage sales_targets" ON public.sales_targets FOR ALL USING (auth.role() = 'authenticated');
        ```
    *   Go to **Project Settings** > **API** in your Supabase dashboard. Find your **Project URL** and **anon public key**.

4.  **Configure Environment Variables:**
    *   Open `.env.local` (create it if it doesn't exist at the root of your project).
    *   Fill in your configuration values (replace placeholders):
        ```env
        # Supabase (Required)
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL_HERE
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE

        # Bright Data API (Optional, for live data sync)
        BRIGHTDATA_API_KEY=YOUR_BRIGHTDATA_API_KEY_HERE
        BRIGHTDATA_API_URL=https://api.brightdata.com/datasets/v3/trigger # Or your specific Bright Data trigger URL
        BRIGHTDATA_DATASET_ID=YOUR_BRIGHTDATA_DATASET_ID_HERE
        AMAZON_BASE_URL=https://www.amazon.com # Or the Amazon domain you are targeting (e.g., amazon.co.uk)

        # Webhook Configuration (Optional, for Bright Data to send updates back to your app)
        WEBHOOK_API=YOUR_APPLICATION_BASE_URL/api/webhook/product-update
        WEBHOOK_SECRET=YOUR_STRONG_SECRET_FOR_WEBHOOK_AUTHENTICATION # A long, random string
        ```

### Running the Development Server

1.  **Start the Next.js development server:**
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:9002`.

2.  **Start the Genkit development server (for AI features, in a separate terminal):**
    ```bash
    npm run genkit:dev
    # or, to watch for changes:
    # npm run genkit:watch
    ```
    The Genkit server usually runs on port `3400`.

### Using the App

-   Open the application in your browser.
-   Use the sidebar (☰ icon) to navigate to **Settings > Market Master** or **Settings > Manager Master** to add initial market and manager data. (Portfolio management UI not yet implemented).
-   Navigate to **Advertisement Details** (from sidebar) to upload and view marketing campaign data.
-   On the main dashboard, click "Add Product" to add your products (core details + initial market listing details like market, manager for that listing, ASIN).
-   For each product on the dashboard, click the "Add Competitors" (➕ icon) to link competitor ASINs for a specific market and assign a manager to those competitor listings. These create `product_listings` records with `is_competitor=true`, linked to your main product.
-   Click the "Sync Products" button in the header. This will trigger a request to Bright Data to fetch information for ASINs from your product listings (both your own and competitors).
-   If you've configured the webhook, Bright Data will send updates to your `/api/webhook/product-update` endpoint. This updates `product_listings.data` for matching ASINs/markets and stores raw data in `external_api_data`. It may also update core fields (like name, description) in the `products` table if the updated listing is one of your own.
-   Products and their details will be displayed on the dashboard. Click on a product to see its detailed view and linked competitor information.
-   On the Product Detail page, find the "Depletion Report" card and click "Configure Depletion Report" to manage inventory logistics (now part of the product record) and sales targets for that product.
-   Click "Enhance Description" (if available on Product Detail page) to use the AI tool (updates `product_listings.data.description`).

## Building for Production

```bash
npm run build
npm run start
```

## Key Files and Directories

-   `src/app/page.tsx`: The main dashboard page.
-   `src/app/product/[productId]/page.tsx`: Product detail and competitor comparison page.
-   `src/app/settings/market-master/page.tsx`: Page for managing market settings.
-   `src/app/settings/manager-master/page.tsx`: Page for managing manager settings.
-   `src/app/settings/advertisement-details/page.tsx`: Page for managing advertisement data.
-   `src/app/actions.ts`: Server-side actions.
-   `src/app/api/webhook/product-update/route.ts`: Webhook endpoint for receiving updates from Bright Data.
-   `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`: Supabase client initializations.
-   `src/server/services/products.ts`: Service for `products` table operations (now also includes depletion-related fields).
-   `src/server/services/productListingService.ts`: Service for `product_listings` table operations.
-   `src/server/services/externalApiDataService.ts`: Service for `external_api_data` table operations.
-   `src/server/services/marketSettingsService.ts`: Service for `markets` table operations.
-   `src/server/services/managerSettingsService.ts`: Service for `managers` table operations.
-   `src/server/services/marketingDataService.ts`: Service for `marketing_data` table operations.
-   `src/server/services/depletionSettingsService.ts`: Service for `sales_targets` and updating depletion-related fields on `products`.
-   `src/server/ai/flows/generate-product-description.ts`: AI flow for description generation.
-   `src/lib/types.ts`: TypeScript type definitions.
-   `src/components/`: Reusable UI components.
-   `src/components/depletion-report-config-modal.tsx`: Modal for configuring depletion reports.

## Customization

-   **Styling**: Modify `src/app/globals.css` and Tailwind CSS classes.
-   **Product API Integration**: Update `.env.local` for Bright Data. `syncProductsWithBrightData` action and webhook handler manage this.
-   **AI Prompts**: Adjust prompt in `src/server/ai/flows/generate-product-description.ts`.
-   **Supabase Policies**: Secure your database with RLS policies in the Supabase dashboard.
