
import { ref, set, get, update, child, push, query, equalTo, orderByChild } from "firebase/database";
import { db } from "@/lib/firebase";
import type { CompetitorProduct, Product } from "@/lib/types"; // Using Product type for competitors as well

class CompetitorsService {
  private competitorsRef = ref(db, "competitors");

  async upsertCompetitorByAsin(asin: string, data: Partial<CompetitorProduct>): Promise<CompetitorProduct> {
    try {
      const q = query(this.competitorsRef, orderByChild('asinCode'), equalTo(asin));
      const snapshot = await get(q);
      
      const competitorDataWithTimestamp = { ...data, asinCode: asin, lastUpdated: new Date().toISOString() };
      // Ensure ID from data doesn't overwrite Firebase key if present
      if ('id' in competitorDataWithTimestamp) {
        delete competitorDataWithTimestamp.id;
      }


      if (snapshot.exists()) {
        // Update existing competitor
        let existingCompetitorId: string | null = null;
        snapshot.forEach(childSnapshot => { // Should be only one due to ASIN uniqueness
          if (!existingCompetitorId) existingCompetitorId = childSnapshot.key;
        });

        if (existingCompetitorId) {
          const competitorSpecificRef = child(this.competitorsRef, existingCompetitorId);
          await update(competitorSpecificRef, competitorDataWithTimestamp);
          console.log(`Competitor with ASIN ${asin} updated in 'competitors' collection.`);
          return { ...((await get(competitorSpecificRef)).val() as CompetitorProduct), id: existingCompetitorId };
        } else {
           throw new Error(`Competitor with ASIN ${asin} found by query but key retrieval failed.`);
        }
      } else {
        // Create new competitor
        const newCompetitorRef = push(this.competitorsRef);
        if (!newCompetitorRef.key) {
          throw new Error("Firebase failed to generate a unique key for new competitor.");
        }
        const newCompetitor: CompetitorProduct = { 
          ...competitorDataWithTimestamp, 
          id: newCompetitorRef.key,
        } as CompetitorProduct; // Cast as Product type expects more fields if not Partial
        
        // Ensure all required fields of Product are present or provide defaults
        const defaults: Partial<Product> = {
            productCode: `COMP-${asin.slice(-4)}`,
            title: data.title || `Competitor ${asin}`,
            price: data.price || 0,
            market: data.market || 'US', // Default market
            owner: data.owner || 'Competitor', // Default owner
            attentionNeeded: data.attentionNeeded || false,
        };
        const finalNewCompetitor = { ...defaults, ...newCompetitor };


        await set(newCompetitorRef, finalNewCompetitor);
        console.log(`Competitor with ASIN ${asin} created in 'competitors' collection with ID ${newCompetitorRef.key}.`);
        return finalNewCompetitor;
      }
    } catch (error) {
      console.error(`Error upserting competitor by ASIN ${asin} in 'competitors' collection:`, error);
      throw new Error(`Failed to upsert competitor by ASIN ${asin}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCompetitorsByAsins(asins: string[]): Promise<CompetitorProduct[]> {
    if (!asins || asins.length === 0) {
      return [];
    }
    try {
      const snapshot = await get(this.competitorsRef);
      if (snapshot.exists()) {
        const allCompetitorsData = snapshot.val();
        const filteredCompetitors = Object.entries(allCompetitorsData)
          .map(([key, value]) => ({ ...(value as Omit<CompetitorProduct, 'id'>), id: key }))
          .filter(competitor => asins.includes(competitor.asinCode));
        return filteredCompetitors;
      }
      return [];
    } catch (error) {
      console.error("Error fetching competitors by ASINs from Firebase:", error);
      throw new Error(`Failed to fetch competitors by ASINs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const competitorsService = new CompetitorsService();
