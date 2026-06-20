import {
  Gem, Link2, CircleDot, Watch, Wrench, Recycle, Sparkles, Layers,
  Crown, Hand, type LucideIcon, Package,
} from "lucide-react";

/**
 * Maps a jewelry category name to a representative icon. Used by the inventory
 * category panel and statistics. Falls back to a generic package icon.
 */
const ICONS: Record<string, LucideIcon> = {
  "Bague": Gem,
  "Alliance": Gem,
  "Collier": Link2,
  "Chaîne": Link2,
  "Pendentif": Hand,
  "Bracelet": CircleDot,
  "Bracelet de cheville": CircleDot,
  "Boucles d'oreilles": Sparkles,
  "Montre": Watch,
  "Parure": Layers,
  "Pièce personnalisée": Crown,
  "Or de récupération": Recycle,
  "Réparations": Wrench,
  "Autre": Package,
};

export function categoryIcon(category: string | null | undefined): LucideIcon {
  return (category && ICONS[category]) || Package;
}
