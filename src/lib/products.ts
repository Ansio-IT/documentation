
import { ref, set, get, update, child, push, remove, query, equalTo, orderByChild } from "firebase/database";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/types"; 

class ProductsService {
  private productsRef = ref(db, "products");

  async getAllProducts(): Promise<Product[]> {
    try {
      const snapshot = await get(this.productsRef);
      if (snapshot.exists()) {
        const productsData = snapshot.val();
        return Object.entries(productsData).map(([key, value]) => ({
          ...(value as Omit<Product, 'id'>),
          id: (value as Product).id || key, 
        }));
      }
      return [];
    } catch (error) {
      console.error("Error fetching products from Firebase:", error);
      throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    try {
      const productSpecificRef = child(this.productsRef, productId);
      const snapshot = await get(productSpecificRef);
      if (snapshot.exists()) {
        const productData = snapshot.val();
        const competitorLinksRef = child(productSpecificRef, 'competitorLinks');
        const competitorLinksSnapshot = await get(competitorLinksRef);
        const competitorLinks = competitorLinksSnapshot.exists() ? competitorLinksSnapshot.val() : {};
        
        return { ...productData, id: productId, competitorLinks } as Product;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching product ${productId} from Firebase:`, error);
      throw new Error(`Failed to fetch product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addProduct(productData: Omit<Product, 'id' | 'competitorLinks' | 'lastUpdated'>): Promise<Product> {
    try {
      const newProductRef = push(this.productsRef);
      if (!newProductRef.key) {
        throw new Error("Firebase failed to generate a unique key for new product.");
      }
      // Ensure all required fields are present, providing defaults if necessary
      const completeProductData: Product = {
        title: productData.title,
        asinCode: productData.asinCode,
        productCode: productData.productCode,
        price: productData.price,
        market: productData.market,
        owner: productData.owner,
        attentionNeeded: productData.attentionNeeded,
        description: productData.description || '',
        imageUrl: productData.imageUrl || '',
        dataAiHint: productData.dataAiHint || '',
        category: productData.category || '',
        targetAudience: productData.targetAudience || '',
        keywords: productData.keywords || '',
        id: newProductRef.key, // Add the generated ID
        competitorLinks: {}, // Initialize with empty competitorLinks
        // lastUpdated will be set by webhook or specific updates
      };
      await set(newProductRef, completeProductData);
      return completeProductData;
    } catch (error) {
      console.error("Error adding product to Firebase:", error);
      throw new Error(`Failed to add product: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  async updateProduct(productId: string, productData: Partial<Omit<Product, 'competitorLinks' | 'id'>>): Promise<void> {
    try {
      const productSpecificRef = child(this.productsRef, productId);
      const snapshot = await get(productSpecificRef);
      if (!snapshot.exists()) {
        throw new Error(`Product with ID ${productId} not found for update.`);
      }
      // Add lastUpdated timestamp
      const updatePayload = { ...productData, lastUpdated: new Date().toISOString() };
      await update(productSpecificRef, updatePayload);
    } catch (error) {
      console.error(`Error updating product ${productId} in Firebase:`, error);
      throw new Error(`Failed to update product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const productSpecificRef = child(this.productsRef, productId);
      await remove(productSpecificRef);
    } catch (error) {
      console.error(`Error deleting product ${productId} from Firebase:`, error);
      throw new Error(`Failed to delete product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addCompetitors(productId: string, competitorsAsins: Array<{ asin: string }>): Promise<void> {
    try {
      const productSpecificRef = child(this.productsRef, productId);
      const productSnapshot = await get(productSpecificRef);
      if (!productSnapshot.exists()) {
        throw new Error(`Product with ID ${productId} not found to add competitors.`);
      }

      const competitorLinksRef = child(productSpecificRef, 'competitorLinks');
      
      const updates: Record<string, { competitorAsin: string }> = {};
      for (const competitorData of competitorsAsins) {
        const newLinkRefKey = push(competitorLinksRef).key; 
        if (newLinkRefKey) {
           updates[newLinkRefKey] = { competitorAsin: competitorData.asin };
        } else {
           console.warn("Could not generate Firebase key for competitor ASIN link:", competitorData.asin);
        }
      }
      if (Object.keys(updates).length > 0) {
        await update(competitorLinksRef, updates);
      }

    } catch (error) {
      console.error(`Error adding competitor links to product ${productId} in Firebase:`, error);
      throw new Error(`Failed to add competitor links for product ${productId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateProductByAsin(asin: string, webhookProductData: Partial<Product>): Promise<Product | null> {
    try {
      const q = query(this.productsRef, orderByChild('asinCode'), equalTo(asin));
      const snapshot = await get(q);

      if (snapshot.exists()) {
        let updatedProductData: Product | null = null;
        snapshot.forEach((childSnapshot) => {
          if (!updatedProductData) { 
            const productId = childSnapshot.key;
            if (productId) {
              const existingProduct = childSnapshot.val() as Product;
              const updateData: Partial<Product> = { 
                ...webhookProductData, 
                lastUpdated: new Date().toISOString() 
              };
              delete updateData.id; 
              
              update(child(this.productsRef, productId), updateData);
              updatedProductData = { ...existingProduct, ...updateData, id: productId };
              console.log(`Product with ASIN ${asin} (ID: ${productId}) updated successfully from webhook in 'products' collection.`);
            }
          }
        });
        return updatedProductData; 
      } else {
        console.warn(`Product with ASIN ${asin} not found in 'products' collection. Webhook data for own product not applied.`);
        return null;
      }
    } catch (error) {
      console.error(`Error updating product by ASIN ${asin} in 'products' collection:`, error);
      throw new Error(`Failed to update product by ASIN ${asin} in 'products': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const productsService = new ProductsService();
