import ring from "@/assets/demo/ring.jpg";
import necklace from "@/assets/demo/necklace.jpg";
import bracelet from "@/assets/demo/bracelet.jpg";
import earrings from "@/assets/demo/earrings.jpg";
import custom from "@/assets/demo/custom.jpg";

/**
 * Maps a product category to a representative product image. Used to give the
 * catalogue a fully-populated, production-ready look (especially for demo data).
 */
const BY_CATEGORY: Record<string, string> = {
  "Bague": ring,
  "Alliance": ring,
  "Collier": necklace,
  "Chaîne": necklace,
  "Pendentif": necklace,
  "Bracelet": bracelet,
  "Boucles d'oreilles": earrings,
  "Montre": custom,
  "Autre": custom,
};

export function productImage(category: string | null | undefined): string {
  return (category && BY_CATEGORY[category]) || custom;
}
