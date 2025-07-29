
# Product Showcase App

This is a Next.js application designed to fetch product data, store it in **Supabase**, and display it on a dashboard. It also features AI-powered product description enhancement and integration with an external data provider (Bright Data) for product updates.

## Features

-   **Product Listing**: View products fetched from Supabase. Each product on the dashboard shows key details from its primary market listing.
-   **Product Details Page**: Click on a product to see its detailed view (core product info + primary listing details) and linked competitor information (other listings marked as competitors).
-   **Supabase Integration**: Uses Supabase for data storage with tables for `products`, `product_listings`, `external_api_data`, `markets`, `managers`, `sales_targets`, `marketing_data`, `warehouses`, `warehouse_stocks`, `channel_stocks`, `channels`, `product_carton_specifications`, and `keywords`.
-   **External API Sync (Bright Data)**: Functionality to trigger data refresh from Bright Data for your products and their competitors. Updates are received via a webhook.
-   **AI-Powered Descriptions**: Enhance product descriptions using a Genkit AI flow (updates `product_listings.data.description` and optionally the core `products.description`).
-   **Competitor Tracking**: Add competitor ASINs to your products. These create `product_listings` records flagged as competitors, linked to your main product. Their details can be synced via the Bright Data webhook and viewed on the product detail page.
-   **Settings Management**: Dedicated screens to manage Market, Manager, and Keyword master data.
-   **Advertisement Data Management**: Screen to upload and view marketing campaign data from Excel/CSV files.
-   **Stock Data Management**: Functionality to upload BWW, VC, and SC FBA Stock Sheets (Excel/CSV) to update the `warehouse_stocks` and `channel_stocks` tables.
-   **Product + Listing + Carton Data Upload**: Functionality to upload comprehensive product data including core details, market listings, and carton specifications.
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
        -- Keywords Table (stores keyword master data)
        CREATE TABLE public.keywords (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            keyword TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_on TIMESTAMPTZ,
            CONSTRAINT keywords_pkey PRIMARY KEY (id),
            CONSTRAINT keywords_keyword_key UNIQUE (keyword)
        );
        -- Trigger to automatically update keywords.updated_on
        CREATE OR REPLACE FUNCTION public.update_keywords_updated_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_keywords_updated_at
        BEFORE UPDATE ON public.keywords
        FOR EACH ROW
        EXECUTE FUNCTION public.update_keywords_updated_on_column();

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

        -- Portfolios Table
        CREATE TABLE public.portfolios (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT portfolios_pkey PRIMARY KEY (id),
            CONSTRAINT portfolios_name_key UNIQUE (name)
        );
        -- Trigger for portfolios.modified_on
        CREATE OR REPLACE FUNCTION public.update_portfolios_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_portfolios_updated_at
        BEFORE UPDATE ON public.portfolios
        FOR EACH ROW
        EXECUTE FUNCTION public.update_portfolios_modified_on_column();

        -- Channels Table
        CREATE TABLE public.channels (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT channels_pkey PRIMARY KEY (id),
            CONSTRAINT channels_name_key UNIQUE (name)
        );
        -- Trigger for channels.modified_on
        CREATE OR REPLACE FUNCTION public.update_channels_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_channels_updated_at
        BEFORE UPDATE ON public.channels
        FOR EACH ROW
        EXECUTE FUNCTION public.update_channels_modified_on_column();


        -- Core Products Table
        CREATE TABLE public.products (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name TEXT NULL,
            barcode TEXT NOT NULL,
            product_code TEXT NOT NULL,
            portfolio_id uuid NULL,
            description TEXT NULL,
            properties JSONB NULL,
            image_url TEXT NULL,
            brand TEXT NULL,
            keywords uuid[] NULL, -- Changed to array of UUIDs
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            associated_products TEXT[] NULL,
            local_warehouse_lead_time SMALLINT NULL DEFAULT 14,
            reorder_lead_time SMALLINT NULL DEFAULT 100,
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
            product_id uuid NOT NULL,
            market_id uuid NOT NULL,
            manager_id uuid NOT NULL,
            asin TEXT NULL,
            current_price REAL NULL,
            list_price REAL NULL,
            discount REAL NULL,
            deal_type TEXT NULL,
            category_ranks JSONB NULL,
            dispatched_from TEXT NULL,
            sold_by TEXT NULL,
            delivery_info TEXT NULL,
            data JSONB NULL, -- Stores remaining unstructured data like title, description, images, url
            is_competitor BOOLEAN NOT NULL DEFAULT FALSE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT product_listings_pkey PRIMARY KEY (id),
            CONSTRAINT product_listings_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_listings_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_listings_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.managers (id) ON UPDATE CASCADE ON DELETE RESTRICT,
            CONSTRAINT product_listing_unique_product_market_asin UNIQUE (product_id, market_id, asin, is_competitor)
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

        -- Product Carton Specifications Table
        CREATE TABLE public.product_carton_specifications (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            product_id uuid NOT NULL,
            market_id uuid NOT NULL,
            length_cm NUMERIC NULL,
            width_cm NUMERIC NULL,
            height_cm NUMERIC NULL,
            weight_kg NUMERIC NULL,
            cartons_per_container NUMERIC NULL,
            cbm_per_carton NUMERIC NULL,
            units_per_carton NUMERIC NULL,
            cartons_per_pallet NUMERIC NULL,
            units_per_pallet NUMERIC NULL,
            pallet_weight_kg NUMERIC NULL,
            pallet_loading_height_cm NUMERIC NULL,
            container_quantity NUMERIC NULL,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT product_carton_specifications_pkey PRIMARY KEY (id),
            CONSTRAINT product_carton_specifications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_carton_specifications_market_id_fkey FOREIGN KEY (market_id) REFERENCES public.markets (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT product_carton_specifications_unique_product_market UNIQUE (product_id, market_id)
        );
        -- Trigger for product_carton_specifications.modified_on
        CREATE OR REPLACE FUNCTION public.update_product_carton_specifications_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_product_carton_specifications_updated_at
        BEFORE UPDATE ON public.product_carton_specifications
        FOR EACH ROW
        EXECUTE FUNCTION public.update_product_carton_specifications_modified_on_column();


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

        -- Daily Sales Table
        create table public.daily_sales (
          id uuid not null default gen_random_uuid (),
          product_id uuid not null,
          channel_id uuid null,
          sale_date date not null,
          units_sold bigint not null default 0,
          revenue_amount numeric(12, 2) null,
          created_on timestamp with time zone not null default now(),
          constraint daily_sales_pkey primary key (id),
          constraint daily_sales_unique unique (product_id, channel_id, sale_date),
          constraint daily_sales_channel_id_fkey foreign KEY (channel_id) references channels (id) on update CASCADE on delete CASCADE,
          constraint daily_sales_product_id_fkey foreign KEY (product_id) references products (id) on update CASCADE on delete CASCADE,
          constraint daily_sales_non_negative check (
            (
              (units_sold >= 0)
              and (revenue_amount >= (0)::numeric)
            )
          )
        ) TABLESPACE pg_default;
         
        create index IF not exists idx_daily_sales_product_channel_date on public.daily_sales using btree (product_id, channel_id, sale_date desc) TABLESPACE pg_default;
         
        create index IF not exists idx_daily_sales_channel_date on public.daily_sales using btree (channel_id, sale_date desc) TABLESPACE pg_default;

        -- Sales Targets Table
        CREATE TABLE public.sales_targets (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            product_id uuid NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            sales_forecast BIGINT NOT NULL,
            channel TEXT NULL, -- Added channel field
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ NULL,
            CONSTRAINT sales_targets_pkey PRIMARY KEY (id),
            CONSTRAINT sales_targets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products (id) ON UPDATE CASCADE ON DELETE CASCADE,
            CONSTRAINT sales_targets_product_date_range_unique UNIQUE (product_id, start_date, end_date) -- Added UNIQUE constraint
        ) TABLESPACE pg_default;
        -- Trigger for sales_targets.modified_on
        CREATE OR REPLACE FUNCTION public.update_sales_targets_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_sales_targets_updated_at
        BEFORE UPDATE ON public.sales_targets
        FOR EACH ROW
        EXECUTE FUNCTION public.update_sales_targets_modified_on_column();


        -- Warehouses Table (NEW)
        CREATE TABLE public.warehouses (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            warehouse_code TEXT NOT NULL,
            warehouse_name TEXT NOT NULL,
            location TEXT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_on TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT warehouses_pkey PRIMARY KEY (id),
            CONSTRAINT warehouses_warehouse_code_key UNIQUE (warehouse_code)
        );
        COMMENT ON TABLE public.warehouses IS 'Stores information about different warehouses, e.g., BWW, VC, SC FBA.';

        -- Trigger for warehouses.modified_on
        CREATE OR REPLACE FUNCTION public.update_warehouses_modified_on_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.modified_on = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_warehouses_updated_at
        BEFORE UPDATE ON public.warehouses
        FOR EACH ROW
        EXECUTE FUNCTION public.update_warehouses_modified_on_column();

        -- Warehouse Stocks Table (NEW)
        CREATE TABLE public.warehouse_stocks (
          id uuid NOT NULL DEFAULT gen_random_uuid (),
          product_id uuid NOT NULL,
          warehouse_id uuid NOT NULL,
          current_stock bigint NOT NULL DEFAULT 0,
          allocated_stock bigint NULL DEFAULT 0,
          available_stock bigint GENERATED ALWAYS as (
            (
              current_stock - COALESCE(allocated_stock, (0)::bigint)
            )
          ) STORED NULL,
          reserved_stock bigint NULL DEFAULT 0,
          inbound_stock bigint NULL DEFAULT 0,
          minimum_stock_level bigint NULL DEFAULT 0,
          maximum_stock_level bigint NULL,
          last_counted_date date NULL,
          last_updated timestamp with time zone NOT NULL DEFAULT now(),
          created_on timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT warehouse_stocks_pkey PRIMARY KEY (id),
          CONSTRAINT warehouse_stocks_unique UNIQUE (product_id, warehouse_id),
          CONSTRAINT warehouse_stocks_product_id_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT warehouse_stocks_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON UPDATE CASCADE ON DELETE CASCADE,
          CONSTRAINT warehouse_stocks_non_negative CHECK (
            (
              (current_stock >= 0)
              AND (COALESCE(allocated_stock, 0) >= 0)
              AND (COALESCE(reserved_stock, 0) >= 0)
              AND (COALESCE(inbound_stock, 0) >= 0)
              AND (COALESCE(minimum_stock_level, 0) >= 0)
            )
          )
        ) TABLESPACE pg_default;
        COMMENT ON TABLE public.warehouse_stocks IS 'Tracks stock levels for each product in each warehouse.';

        -- Trigger for warehouse_stocks.last_updated
        CREATE OR REPLACE FUNCTION public.update_warehouse_stocks_last_updated_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.last_updated = NOW();
           RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER handle_warehouse_stocks_updated_at
        BEFORE UPDATE ON public.warehouse_stocks
        FOR EACH ROW
        EXECUTE FUNCTION public.update_warehouse_stocks_last_updated_column();
        
        -- Channels Table
        create table public.channels (
          id uuid not null default gen_random_uuid (),
          channel_code character varying not null,
          channel_name character varying not null,
          channel_type character varying not null,
          market_id uuid not null,
          is_active boolean not null default true,
          default_lead_time_days smallint null default 14,
          cost_per_unit numeric(8, 4) null,
          created_on timestamp with time zone not null default now(),
          modified_on timestamp with time zone null,
          constraint channels_pkey primary key (id),
          constraint channels_channel_code_key unique (channel_code),
          constraint channels_market_id_fkey foreign KEY (market_id) references markets (id) on update CASCADE on delete CASCADE
        ) TABLESPACE pg_default;

        -- Daily Sales Table
        create table public.daily_sales (
          id uuid not null default gen_random_uuid (),
          product_id uuid not null,
          channel_id uuid null,
          sale_date date not null,
          units_sold bigint not null default 0,
          revenue_amount numeric(12, 2) null,
          created_on timestamp with time zone not null default now(),
          constraint daily_sales_pkey primary key (id),
          constraint daily_sales_unique unique (product_id, channel_id, sale_date),
          constraint daily_sales_channel_id_fkey foreign KEY (channel_id) references channels (id) on update CASCADE on delete CASCADE,
          constraint daily_sales_product_id_fkey foreign KEY (product_id) references products (id) on update CASCADE on delete CASCADE,
          constraint daily_sales_non_negative check (
            (
              (units_sold >= 0)
              and (revenue_amount >= (0)::numeric)
            )
          )
        ) TABLESPACE pg_default;
        
        -- Indexes for daily_sales
        create index IF not exists idx_daily_sales_product_channel_date on public.daily_sales using btree (product_id, channel_id, sale_date desc) TABLESPACE pg_default;
        create index IF not exists idx_daily_sales_channel_date on public.daily_sales using btree (channel_id, sale_date desc) TABLESPACE pg_default;

        -- Channel Stocks Table
        create table public.channel_stocks (
          id uuid not null default gen_random_uuid (),
          product_id uuid not null,
          channel_id uuid not null,
          current_stock bigint not null default 0,
          reserved_stock bigint null default 0,
          inbound_stock bigint null default 0,
          stranded_stock bigint null default 0,
          last_sync_date timestamp with time zone null,
          last_updated timestamp with time zone not null default now(),
          created_on timestamp with time zone not null default now(),
          constraint channel_stocks_pkey primary key (id),
          constraint channel_stocks_unique unique (product_id, channel_id),
          constraint channel_stocks_channel_id_fkey foreign KEY (channel_id) references channels (id) on update CASCADE on delete CASCADE,
          constraint channel_stocks_product_id_fkey foreign KEY (product_id) references products (id) on update CASCADE on delete CASCADE,
          constraint channel_stocks_non_negative check ((current_stock >= 0))
        ) TABLESPACE pg_default;

        -- Function to validate a batch of product codes against the products table
        create or replace function validate_product_codes(codes text[])
        returns table (product_code text)
        language sql
        as $$
          select p.product_code
          from public.products as p
          where p.product_code = any(codes);
        $$;


        -- Enable Row Level Security (RLS) - STRONGLY RECOMMENDED
        ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.product_listings ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.product_carton_specifications ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.external_api_data ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.marketing_data ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.warehouse_stocks ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.channel_stocks ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies as needed (EXAMPLES - TAILOR TO YOUR NEEDS):
        -- Allow public read for settings tables (if needed for client-side dropdowns, otherwise restrict)
        CREATE POLICY "Public can read keywords" ON public.keywords FOR SELECT USING (true);
        CREATE POLICY "Public can read markets" ON public.markets FOR SELECT USING (true);
        CREATE POLICY "Public can read managers" ON public.managers FOR SELECT USING (true);
        CREATE POLICY "Public can read portfolios" ON public.portfolios FOR SELECT USING (true);
        CREATE POLICY "Public can read channels" ON public.channels FOR SELECT USING (true);
        -- Authenticated users can manage their own settings data
        CREATE POLICY "Authenticated users can manage keywords" ON public.keywords FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage markets" ON public.markets FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage managers" ON public.managers FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage portfolios" ON public.portfolios FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage channels" ON public.channels FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can read product listings" ON public.product_listings FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can read product_carton_specifications" ON public.product_carton_specifications FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage product listings" ON public.product_listings FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage product_carton_specifications" ON public.product_carton_specifications FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can manage external_api_data" ON public.external_api_data FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage marketing_data" ON public.marketing_data FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage daily_sales" ON public.daily_sales FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated users can manage sales_targets" ON public.sales_targets FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated can read warehouses" ON public.warehouses FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can manage warehouses" ON public.warehouses FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can read warehouse_stocks" ON public.warehouse_stocks FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can manage warehouse_stocks" ON public.warehouse_stocks FOR ALL USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated can read channels" ON public.channels FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can manage channels" ON public.channels FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can read daily_sales" ON public.daily_sales FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can manage daily_sales" ON public.daily_sales FOR ALL USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can read channel_stocks" ON public.channel_stocks FOR SELECT USING (auth.role() = 'authenticated');
        CREATE POLICY "Authenticated can manage channel_stocks" ON public.channel_stocks FOR ALL USING (auth.role() = 'authenticated');

        -- Seed initial warehouses
        INSERT INTO public.warehouses (warehouse_code, warehouse_name) VALUES ('BWW', 'BWW Main Warehouse') ON CONFLICT (warehouse_code) DO NOTHING;
        INSERT INTO public.warehouses (warehouse_code, warehouse_name) VALUES ('VC', 'Vendor Central') ON CONFLICT (warehouse_code) DO NOTHING;
        INSERT INTO public.warehouses (warehouse_code, warehouse_name) VALUES ('SC_FBA', 'Seller Central FBA') ON CONFLICT (warehouse_code) DO NOTHING;
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
-   Use the sidebar (☰ icon) to navigate to **Settings > Keyword Master**, **Settings > Market Master** or **Settings > Manager Master** to add initial data. (Portfolio management UI not yet implemented).
-   Navigate to **Advertisement Details** (from sidebar) to upload and view marketing campaign data. This page also allows uploading **Stock Sheets** and **Product + Listing + Carton Data Sheets**.
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
-   `src/app/settings/keyword-master/page.tsx`: Page for managing keyword settings.
-   `src/app/settings/advertisement-details/page.tsx`: Page for managing advertisement and stock data uploads.
-   `src/app/actions.ts`: Server-side actions.
-   `src/app/api/webhook/product-update/route.ts`: Webhook endpoint for receiving updates from Bright Data.
-   `src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`: Supabase client initializations.
-   `src/server/services/products.ts`: Service for `products` table operations (now also includes depletion-related fields).
-   `src/server/services/productListingService.ts`: Service for `product_listings` table operations.
-   `src/server/services/productCartonSpecificationService.ts`: Service for `product_carton_specifications` table operations.
-   `src/server/services/externalApiDataService.ts`: Service for `external_api_data` table operations.
-   `src/server/services/marketSettingsService.ts`: Service for `markets` table operations.
-   `src/server/services/managerSettingsService.ts`: Service for `managers` table operations.
-   `src/server/services/portfolioSettingsService.ts`: Service for `portfolios` table operations.
-   `src/server/services/keywordService.ts`: Service for `keywords` table operations.
-   `src/server/services/marketingDataService.ts`: Service for `marketing_data` table operations.
-   `src/server/services/stocksReportService.ts`: Service for `warehouse_stocks` and `channel_stocks` table uploads.
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

