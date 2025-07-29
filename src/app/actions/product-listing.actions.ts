
'use server';

import type { ParsedProductListingUploadRow, ProductListingUploadSummary } from '@/lib/types';
import { keywordService } from '@/server/services/keywordService';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function processProductListingUploadBatchAction(
  batch: ParsedProductListingUploadRow[]
): Promise<ProductListingUploadSummary> {
  const supabase = createClient(cookies());
  const summary: ProductListingUploadSummary = {
    totalRowsProcessed: batch.length,
    productsCreated: 0,
    productsUpdated: 0,
    listingsCreated: 0,
    listingsUpdated: 0,
    cartonSpecsSaved: 0,
    errorsEncountered: [],
  };

  const productCodes = new Set<string>();
  const marketNames = new Set<string>();
  const managerNames = new Set<string>();
  const portfolioNames = new Set<string>();
  const allKeywords = new Set<string>();

  batch.forEach(row => {
    if (row.productCode) productCodes.add(row.productCode);
    if (row.marketNameOrCode) marketNames.add(row.marketNameOrCode);
    if (row.managerName) managerNames.add(row.managerName);
    if (row.productPortfolioName) portfolioNames.add(row.productPortfolioName);
    if (row.productSubPortfolioName) portfolioNames.add(row.productSubPortfolioName);
    if (row.keywordsRaw) {
      row.keywordsRaw.split(',').forEach(k => {
        const trimmed = k.trim();
        if (trimmed) allKeywords.add(trimmed);
      });
    }
  });

  const [
    existingProductsRes,
    existingMarketsRes,
    existingManagersRes,
    existingPortfoliosRes,
    allKeywordsFromDb
  ] = await Promise.all([
    productCodes.size > 0 ? supabase.from('products').select('*').in('product_code', [...productCodes]) : Promise.resolve({ data: [], error: null }),
    marketNames.size > 0 ? supabase.from('markets').select('*').in('market_name', [...marketNames]) : Promise.resolve({ data: [], error: null }),
    managerNames.size > 0 ? supabase.from('managers').select('*').in('name', [...managerNames]) : Promise.resolve({ data: [], error: null }),
    portfolioNames.size > 0 ? supabase.from('portfolios').select('*').in('name', [...portfolioNames]) : Promise.resolve({ data: [], error: null }),
    keywordService.findKeywordsByText([...allKeywords])
  ]);
  
  if (existingProductsRes.error || existingMarketsRes.error || existingManagersRes.error || existingPortfoliosRes.error) {
    summary.errorsEncountered.push({ rowIndexInExcel: 0, error: 'Failed to fetch prerequisite data. Aborting upload.' });
    return summary;
  }
  
  const keywordMap = new Map(allKeywordsFromDb.map(k => [k.keyword.toLowerCase(), k.id]));
  const productsMap = new Map(existingProductsRes.data?.map(p => [p.product_code, p]));
  const marketsMap = new Map(existingMarketsRes.data?.map(m => [m.market_name, m]));
  const managersMap = new Map(existingManagersRes.data?.map(m => [m.name, m]));
  const portfoliosMap = new Map(existingPortfoliosRes.data?.map(p => [p.name, p]));

  const uniquePortfoliosToInsert = new Map<string, { name: string; slug: string; parentName?: string }>();
  const uniqueSubPortfoliosToInsert = new Map<string, { name: string; slug: string; parentName?: string }>();
  const portfolioNamesToInsert = new Set<string>();

  for (const row of batch) {
    if (row.productPortfolioName && !portfoliosMap.has(row.productPortfolioName)) {
      uniquePortfoliosToInsert.set(row.productPortfolioName, {
        name: row.productPortfolioName,
        slug: row.productPortfolioName.toLowerCase().replace(/\s+/g, '-'),
      });
      portfolioNamesToInsert.add(row.productPortfolioName);
    }
    if (row.productSubPortfolioName && !portfoliosMap.has(row.productSubPortfolioName)) {
      uniqueSubPortfoliosToInsert.set(row.productSubPortfolioName, {
        name: row.productSubPortfolioName,
        slug: row.productSubPortfolioName.toLowerCase().replace(/\s+/g, '-'),
        parentName: row.productPortfolioName || undefined,
      });
      console.log(row.productSubPortfolioName.toLowerCase().replace(/\s+/g, '-'));
      portfolioNamesToInsert.add(row.productSubPortfolioName);
    }
  }
// console.log(uniqueSubPortfoliosToInsert);
  if (uniquePortfoliosToInsert.size > 0) {
    const portfoliosToInsert = Array.from(uniquePortfoliosToInsert.values());
    const { data: insertedPortfolios, error } = await supabase.from('portfolios').insert(portfoliosToInsert.map(({ name, slug }) => ({ name, slug }))).select('id, name, slug');
    if (error) {
      summary.errorsEncountered.push({ rowIndexInExcel: -1, error: `Bulk portfolio insert failed: ${error.message}` });
      return summary;
    }
    insertedPortfolios?.forEach(p => portfoliosMap.set(p.name, p));
  }

  if (uniqueSubPortfoliosToInsert.size > 0) {
    let subPortfoliosToInsert = Array.from(uniqueSubPortfoliosToInsert.values());
    subPortfoliosToInsert = subPortfoliosToInsert.map(sp => ({ name: sp.name, slug: sp.slug, parent_id: portfoliosMap.get(sp.parentName).id }));
    const { data: insertedSubPortfolios, error: subPortfolioError } = await supabase.from('portfolios').insert(subPortfoliosToInsert).select('id, name, slug');
    if (subPortfolioError) {
      summary.errorsEncountered.push({ rowIndexInExcel: -1, error: `Bulk sub-portfolio insert failed: ${subPortfolioError.message}` });
      return summary;
    }
    insertedSubPortfolios?.forEach(p => portfoliosMap.set(p.name, p));
  }

  const productsToInsert: any[] = [];
  const productsToUpdate: any[] = [];
  const productCodeToIdMap = new Map<string, string>();

  for (const row of batch) {
      try {
          const productCode = row.productCode;
          if (!productCode) {
              summary.errorsEncountered.push({ rowIndexInExcel: row.rowIndexInExcel, error: "Row skipped: Product Code (SKU) is required." });
              continue;
          }
          
          const existingProduct = productsMap.get(productCode);
          let portfolioId: string | null = null;
          if (row.productSubPortfolioName) portfolioId = portfoliosMap.get(row.productSubPortfolioName)?.id || null;
          if (!portfolioId && row.productPortfolioName) portfolioId = portfoliosMap.get(row.productPortfolioName)?.id || null;
          const keywordIds = row.keywordsRaw ? row.keywordsRaw.split(',').map(k => keywordMap.get(k.trim().toLowerCase())).filter(Boolean) as string[] : [];
          
          const productDataPayload = {
              product_code: productCode,
              name: row.productName,
              description: row.productDescription,
              image_url: row.productImageUrl,
              brand: row.brand,
              portfolio_id: portfolioId,
              properties: (row.productPropertiesLengthCm || row.productPropertiesWidthCm || row.productPropertiesHeightCm || row.productPropertiesWeightKg) ? { item_dimensions: { length_cm: row.productPropertiesLengthCm, width_cm: row.productPropertiesWidthCm, height_cm: row.productPropertiesHeightCm, weight_kg: row.productPropertiesWeightKg } } : null,
              is_active: true,
              associated_products: row.associatedProductsSkuList ? row.associatedProductsSkuList.split(',').map(s => s.trim()).filter(Boolean) : null,
              local_warehouse_lead_time: row.localWarehouseLeadTimeDays,
              reorder_lead_time: row.reorderingLeadTimeDays,
              keywords: keywordIds.length > 0 ? keywordIds : null,
          };
          
          if (existingProduct) {
              if (!productsToUpdate.some(p => p.id === existingProduct.id)) {
                productsToUpdate.push({ id: existingProduct.id, ...productDataPayload, barcode: existingProduct.barcode });
                summary.productsUpdated++;
              }
              productCodeToIdMap.set(productCode, existingProduct.id);
          } else {
              if (!row.barcode) {
                  summary.errorsEncountered.push({ rowIndexInExcel: row.rowIndexInExcel, productCode, error: "Barcode is required for new products." });
                  continue;
              }
              if (!productsToInsert.some(p => p.barcode === row.barcode)) {
                productsToInsert.push({ ...productDataPayload, barcode: row.barcode });
                summary.productsCreated++;
              }
          }
      } catch (e: any) {
          summary.errorsEncountered.push({ rowIndexInExcel: row.rowIndexInExcel, productCode: row.productCode, error: e.message || 'Unknown error during row processing.' });
      }
  }

  // Perform operations in two steps: INSERT new, then UPDATE existing.
  if (productsToInsert.length > 0) {
      const { data: insertedProducts, error } = await supabase.from('products').insert(productsToInsert).select('id, product_code');
      if (error) {
          summary.errorsEncountered.push({ rowIndexInExcel: 0, error: `Bulk product insert failed: ${error.message}` });
          return summary;
      }
      insertedProducts?.forEach(p => productCodeToIdMap.set(p.product_code, p.id));
  }
  
  if (productsToUpdate.length > 0) {
      const { data: updatedProducts, error } = await supabase.from('products').upsert(productsToUpdate, { onConflict: 'product_code' }).select('id, product_code');
      if (error) {
          summary.errorsEncountered.push({ rowIndexInExcel: 0, error: `Bulk product update failed: ${error.message}` });
          return summary;
      }
      updatedProducts?.forEach(p => productCodeToIdMap.set(p.product_code, p.id));
  }
  
  const listingsToUpsert: any[] = [];
  const competitorListingsToInsert: any[] = [];
  const cartonSpecsToUpsert: any[] = [];

  for(const row of batch) {
      const productId = productCodeToIdMap.get(row.productCode);
      if(!productId) continue;

      const market = marketsMap.get(row.marketNameOrCode);
      if(!market) continue;

      const cartonSpecData = {
        product_id: productId, market_id: market.id, carton_length_cm: row.cartonLengthCm, carton_width_cm: row.cartonWidthCm,
        carton_height_cm: row.cartonHeightCm, carton_weight_kg: row.cartonWeightKg, cartons_per_container: row.cartonsPerContainer,
        cbm_per_carton: row.cbmPerCarton, units_per_carton: row.unitsPerCarton, cartons_per_pallet: row.cartonsPerPallet,
        units_per_pallet: row.unitsPerPallet, pallet_weight_kg: row.palletWeightKg, pallet_loading_height_cm: row.palletLoadingHeightCm,
        container_quantity: row.containerQuantity, cbm_40hq: row.cbm40hq, container_weight: row.containerWeight
      };
      
      const hasCartonData = Object.values(cartonSpecData).some(v => v !== null && v !== undefined && v !== productId && v !== market.id);
      if(hasCartonData) cartonSpecsToUpsert.push(cartonSpecData);

      const manager = managersMap.get(row.managerName);
      if(!manager) continue;

      listingsToUpsert.push({
          product_id: productId,
          market_id: market.id,
          manager_id: manager.id,
          asin: row.asin || null,
          is_competitor: false,
      });

      if (row.competitorDetails) {
        const competitorAsins = row.competitorDetails.split(',').map(asin => asin.trim()).filter(Boolean);
        competitorAsins.forEach(asin => {
          competitorListingsToInsert.push({
            product_id: productId,
            market_id: market.id,
            manager_id: manager.id,
            asin: asin,
            is_competitor: true,
          });
        });
      }
  }

  const dbPromises = [];
  if (cartonSpecsToUpsert.length > 0) {
    dbPromises.push(supabase.from('product_carton_specifications').upsert(cartonSpecsToUpsert, { onConflict: 'product_id,market_id' }).then(res => {
        if(res.error) summary.errorsEncountered.push({rowIndexInExcel: 0, error: `Carton specs bulk upsert failed: ${res.error.message}`});
        else summary.cartonSpecsSaved += res.data?.length || 0;
    }));
  }

  if (listingsToUpsert.length > 0) {
    dbPromises.push(supabase.from('product_listings').upsert(listingsToUpsert, { onConflict: 'asin,product_id,market_id' }).then(res => {
        if(res.error) summary.errorsEncountered.push({rowIndexInExcel: 0, error: `Main listings bulk upsert failed: ${res.error.message}`});
        else summary.listingsUpdated += res.data?.length || 0;
    }));
  }
  
  if (competitorListingsToInsert.length > 0) {
    dbPromises.push(supabase.from('product_listings').upsert(competitorListingsToInsert, { onConflict: 'asin,product_id,market_id' }).then(res => {
        if(res.error) summary.errorsEncountered.push({rowIndexInExcel: 0, error: `Competitor listings bulk insert failed: ${res.error.message}`});
        else if (res.data) summary.listingsCreated += res.data.length;
    }));
  }

  await Promise.all(dbPromises);

  return summary;
}

