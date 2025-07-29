
import { type SupabaseClient } from '@supabase/supabase-js';
import type { ProductCartonSpecification } from '@/lib/types';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

const fromSnakeCase = (dbSpec: any): ProductCartonSpecification => {
  if (!dbSpec) return {} as ProductCartonSpecification;
  return {
    id: dbSpec.id,
    productId: dbSpec.product_id,
    marketId: dbSpec.market_id,
    lengthCm: dbSpec.length_cm,
    widthCm: dbSpec.width_cm,
    heightCm: dbSpec.height_cm,
    weightKg: dbSpec.weight_kg,
    cartonsPerContainer: dbSpec.cartons_per_container,
    cbmPerCarton: dbSpec.cbm_per_carton,
    unitsPerCarton: dbSpec.units_per_carton,
    cartonsPerPallet: dbSpec.cartons_per_pallet,
    unitsPerPallet: dbSpec.units_per_pallet,
    palletWeightKg: dbSpec.pallet_weight_kg,
    palletLoadingHeightCm: dbSpec.pallet_loading_height_cm,
    containerQuantity: dbSpec.container_quantity,
    createdOn: dbSpec.created_on,
    modifiedOn: dbSpec.modified_on,
  };
};

const toSnakeCase = (spec: Partial<ProductCartonSpecification>): any => {
  const result: any = {};
  if (spec.id !== undefined) result.id = spec.id;
  if (spec.productId !== undefined) result.product_id = spec.productId;
  if (spec.marketId !== undefined) result.market_id = spec.marketId;
  if (spec.lengthCm !== undefined) result.length_cm = spec.lengthCm;
  if (spec.widthCm !== undefined) result.width_cm = spec.widthCm;
  if (spec.heightCm !== undefined) result.height_cm = spec.heightCm;
  if (spec.weightKg !== undefined) result.weight_kg = spec.weightKg;
  if (spec.cartonsPerContainer !== undefined) result.cartons_per_container = spec.cartonsPerContainer;
  if (spec.cbmPerCarton !== undefined) result.cbm_per_carton = spec.cbmPerCarton;
  if (spec.unitsPerCarton !== undefined) result.units_per_carton = spec.unitsPerCarton;
  if (spec.cartonsPerPallet !== undefined) result.cartons_per_pallet = spec.cartonsPerPallet;
  if (spec.unitsPerPallet !== undefined) result.units_per_pallet = spec.unitsPerPallet;
  if (spec.palletWeightKg !== undefined) result.pallet_weight_kg = spec.palletWeightKg;
  if (spec.palletLoadingHeightCm !== undefined) result.pallet_loading_height_cm = spec.palletLoadingHeightCm;
  if (spec.containerQuantity !== undefined) result.container_quantity = spec.containerQuantity;
  return result;
};

class ProductCartonSpecificationService {
  private getSupabaseClient(): SupabaseClient {
    const cookieStore = cookies();
    return createClient(cookieStore);
  }

  async upsertCartonSpecification(
    specData: Omit<ProductCartonSpecification, 'id' | 'createdOn' | 'modifiedOn'>
  ): Promise<ProductCartonSpecification> {
    const supabase = this.getSupabaseClient();
    const specToUpsert = toSnakeCase(specData);

    const { data, error } = await supabase
      .from('product_carton_specifications')
      .upsert(specToUpsert, { onConflict: 'product_id,market_id' })
      .select()
      .single();

    if (error || !data) {
      console.error("Error upserting product carton specification to Supabase:", error);
      throw new Error(`Failed to upsert product carton specification: ${error?.message}`);
    }
    return fromSnakeCase(data);
  }

  async getCartonSpecification(productId: string, marketId: string): Promise<ProductCartonSpecification | null> {
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase
      .from('product_carton_specifications')
      .select('*')
      .eq('product_id', productId)
      .eq('market_id', marketId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching carton specification for product ${productId}, market ${marketId}:`, error);
      throw error;
    }
    return data ? fromSnakeCase(data) : null;
  }
}

export const productCartonSpecificationService = new ProductCartonSpecificationService();
