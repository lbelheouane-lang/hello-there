import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/data-client";
import { productImage } from "@/lib/product-image";

interface ProductPhotoProps {
  /** Storage path inside the product-photos bucket, or null. */
  imageUrl: string | null | undefined;
  /** Category used to pick a representative placeholder when no photo exists. */
  category: string;
  alt: string;
  className?: string;
}

/**
 * Shows a product's captured photo (resolved to a short-lived signed URL from
 * the private product-photos bucket) and falls back to the category
 * placeholder image when the article has no photo.
 */
export function ProductPhoto({ imageUrl, category, alt, className }: ProductPhotoProps) {
  const { data: signed } = useQuery({
    queryKey: ["product-photo", imageUrl],
    enabled: !!imageUrl,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("product-photos")
        .createSignedUrl(imageUrl!, 600);
      return data?.signedUrl ?? null;
    },
  });

  const src = imageUrl ? signed ?? undefined : productImage(category);
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
