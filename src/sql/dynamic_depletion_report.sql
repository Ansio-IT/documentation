-- This view creates a dynamic, 101-day depletion forecast for each product.
-- It can be queried like a table, e.g., "SELECT * FROM dynamic_depletion_report WHERE product_code = 'ANSIO 4012';"
CREATE OR REPLACE VIEW dynamic_depletion_report AS
WITH
  -- 1. Generate a date series for each product, from 100 days before its stockout date up to the stockout date.
  date_series AS (
    SELECT
      p.product_id,
      p.product_code,
      p.product_name,
      p.current_stock,
      p.stockout_date,
      generate_series(
        p.stockout_date - INTERVAL '100 days',
        p.stockout_date,
        '1 day'::INTERVAL
      )::DATE AS forecast_date
    FROM
      depletion_report_dummy AS p
  ),
  -- 2. Join the date series with sales targets to find the applicable daily forecast for each date.
  -- This assumes the sales_forecast value is for the entire period and should be averaged out.
  daily_forecasts AS (
    SELECT
      ds.product_id,
      ds.product_code,
      ds.product_name,
      ds.current_stock,
      ds.stockout_date,
      ds.forecast_date,
      -- If a date has no forecast, assume 0. Divide the forecast over the period duration.
      COALESCE(st.sales_forecast / NULLIF(st.end_date - st.start_date + 1, 0), 0) AS daily_forecast
    FROM
      date_series ds
      LEFT JOIN sales_targets st ON ds.product_id = st.product_id
      AND ds.forecast_date BETWEEN st.start_date AND st.end_date
  ),
  -- 3. Use a window function to calculate the cumulative forecast up to each date for each product.
  cumulative_forecasts AS (
    SELECT
      *,
      SUM(daily_forecast) OVER (
        PARTITION BY
          product_id
        ORDER BY
          forecast_date
      ) AS cumulative_forecast
    FROM
      daily_forecasts
  )
-- 4. Final selection: calculate remaining stock, add status flags, and format date parts.
SELECT
  cf.product_id,
  cf.product_code,
  cf.product_name,
  cf.forecast_date,
  TO_CHAR(cf.forecast_date, 'Day') AS day_name,
  EXTRACT(ISODOW FROM cf.forecast_date) IN (6, 7) AS is_weekend,
  cf.daily_forecast,
  (cf.current_stock - cf.cumulative_forecast) AS remaining_stock,
  cf.current_stock,
  cf.stockout_date,
  CASE
    WHEN cf.forecast_date = (cf.stockout_date - INTERVAL '100 days') THEN 'Place Order'
    WHEN cf.forecast_date >= (cf.stockout_date - INTERVAL '13 days') THEN 'Depletion Alert' -- 'within 14 days' includes the start date
    ELSE NULL
  END AS status_flag
FROM
  cumulative_forecasts
ORDER BY
  cf.product_code,
  cf.forecast_date;

-- Example Query:
-- SELECT * FROM dynamic_depletion_report WHERE product_code = 'ANSIO 4012';