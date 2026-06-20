import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/format";

export interface ProductCategory {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface ProductSubcategory {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
}

/**
 * Loads the jewelry categories from the database, falling back to the built-in
 * defaults if none are available yet. Administrators can add custom categories.
 */
export function useCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as ProductCategory[];
    },
  });
}

/** Loads custom subcategories grouped under each category. */
export function useSubcategories() {
  return useQuery({
    queryKey: ["product_subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_subcategories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ProductSubcategory[];
    },
  });
}

/** Returns category names as a string array, always falling back to defaults. */
export function useCategoryNames(): string[] {
  const { data } = useCategories();
  if (data && data.length > 0) return data.map((c) => c.name);
  return [...CATEGORIES];
}
