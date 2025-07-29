
"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export interface Priority {
    priority_id: string;
    priority_name: string;
    priority_description?: string | null;
    pattern_id?: string | null;
    is_active: boolean;
}

export async function fetchActivePrioritiesAction(patternId?: string): Promise<Priority[]> {
    const supabase = createClient(cookies());
    
    let query = supabase
        .from('priorities')
        .select('*')
        .eq('is_active', true)
        .order('priority_name', { ascending: true });

    if (patternId) {
        query = query.eq('pattern_id', patternId);
    }
    
    const { data, error } = await query;

    if (error) {
        console.error("Error fetching active priorities:", error.message);
        return [];
    }
    
    return data || [];
}
