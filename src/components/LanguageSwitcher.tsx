import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** FR/AR language selector shown in the app header. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  const options: { value: Lang; label: string }[] = [
    { value: "fr", label: t("common.french") },
    { value: "ar", label: t("common.arabic") },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          aria-label={t("common.language")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-sm font-medium uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => setLang(o.value)}
            className={lang === o.value ? "font-semibold text-primary" : ""}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
