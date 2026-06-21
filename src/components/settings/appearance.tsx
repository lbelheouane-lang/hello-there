import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Palette, Check, RotateCcw, ArrowUp, ArrowDown, Save, Image as ImageIcon, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { THEMES, type ThemeKey } from "@/lib/themes";
import {
  useUserPreferences, saveUserPreferences, applyPreferences,
  DEFAULT_PREFERENCES, USER_PREFERENCES_QUERY_KEY, LANDING_PAGE_OPTIONS,
  DASHBOARD_WIDGETS, MENU_ITEMS, type UserPreferences,
} from "@/lib/user-preferences";
import { STORE_SETTINGS_QUERY_KEY } from "@/lib/store-settings";

const COLOR_FIELDS: { key: keyof UserPreferences; label: string; fallback: string }[] = [
  { key: "primary_color", label: "Couleur primaire", fallback: "#c89b46" },
  { key: "secondary_color", label: "Couleur secondaire", fallback: "#efe9dc" },
  { key: "accent_color", label: "Couleur d'accent", fallback: "#e8d6b0" },
  { key: "sidebar_color", label: "Couleur de la barre latérale", fallback: "#3a3a44" },
  { key: "header_color", label: "Couleur de l'en-tête", fallback: "#ffffff" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AppearanceCard() {
  const qc = useQueryClient();
  const { data } = useUserPreferences();
  const [draft, setDraft] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  // Live preview while editing.
  useEffect(() => {
    applyPreferences(draft);
  }, [draft]);

  function patch(p: Partial<UserPreferences>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  const save = useMutation({
    mutationFn: () => saveUserPreferences(draft),
    onSuccess: () => {
      toast.success("Préférences enregistrées.");
      qc.invalidateQueries({ queryKey: USER_PREFERENCES_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    const base = data ?? DEFAULT_PREFERENCES;
    setDraft(base);
    applyPreferences(base);
  }

  const activeTheme = THEMES.find((t) => t.key === draft.theme);
  const modeLocked = !!activeTheme?.forceMode;

  // Menu order helpers
  const order = draft.menu_order && draft.menu_order.length > 0
    ? [...draft.menu_order]
    : MENU_ITEMS.map((m) => m.to);
  const orderedMenu = [
    ...order.filter((to) => MENU_ITEMS.some((m) => m.to === to)),
    ...MENU_ITEMS.map((m) => m.to).filter((to) => !order.includes(to)),
  ];
  function moveMenu(idx: number, dir: -1 | 1) {
    const next = [...orderedMenu];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    patch({ menu_order: next });
  }

  function toggleWidget(key: string, visible: boolean) {
    const hidden = new Set(draft.hidden_widgets);
    if (visible) hidden.delete(key);
    else hidden.add(key);
    patch({ hidden_widgets: [...hidden] });
  }

  return (
    <div className="space-y-6">
      {/* THEME */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Thème
          </CardTitle>
          <CardDescription>
            Choisissez un thème prédéfini. Vos préférences sont propres à votre compte
            et restaurées automatiquement à chaque connexion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => patch({ theme: t.key as ThemeKey })}
                className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  draft.theme === t.key ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex">
                  {t.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="h-7 w-5 rounded-sm border border-black/10"
                      style={{ backgroundColor: c, marginLeft: i ? -6 : 0 }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{t.label}</span>
                {draft.theme === t.key && (
                  <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* APPEARANCE */}
      <Card>
        <CardHeader>
          <CardTitle>Apparence</CardTitle>
          <CardDescription>Mode de couleur et densité de l'interface.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode de couleur</Label>
              <Select
                value={modeLocked ? activeTheme!.forceMode : draft.mode}
                onValueChange={(v) => patch({ mode: v as "light" | "dark" })}
                disabled={modeLocked}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Mode clair</SelectItem>
                  <SelectItem value="dark">Mode sombre</SelectItem>
                </SelectContent>
              </Select>
              {modeLocked && (
                <p className="text-xs text-muted-foreground">Ce thème impose son propre mode.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Densité</Label>
              <Select value={draft.density} onValueChange={(v) => patch({ density: v as "comfortable" | "compact" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Confortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CUSTOM COLORS */}
      <Card>
        <CardHeader>
          <CardTitle>Couleurs personnalisées</CardTitle>
          <CardDescription>
            Surchargez les couleurs du thème. Laissez vide pour utiliser celles du thème.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {COLOR_FIELDS.map((f) => {
              const val = (draft[f.key] as string | null) ?? "";
              return (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={val || f.fallback}
                      onChange={(e) => patch({ [f.key]: e.target.value } as Partial<UserPreferences>)}
                      className="h-9 w-12 cursor-pointer rounded border"
                    />
                    <Input
                      value={val}
                      placeholder="Couleur du thème"
                      onChange={(e) => patch({ [f.key]: e.target.value || null } as Partial<UserPreferences>)}
                    />
                    {val && (
                      <Button variant="ghost" size="sm" onClick={() => patch({ [f.key]: null } as Partial<UserPreferences>)}>
                        Effacer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* NAVIGATION */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation</CardTitle>
          <CardDescription>État de la barre latérale et ordre des menus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Barre latérale par défaut</Label>
            <Select value={draft.sidebar_default} onValueChange={(v) => patch({ sidebar_default: v as "expanded" | "collapsed" })}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expanded">Déployée</SelectItem>
                <SelectItem value="collapsed">Réduite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ordre des menus</Label>
            <div className="divide-y rounded-lg border">
              {orderedMenu.map((to, idx) => {
                const item = MENU_ITEMS.find((m) => m.to === to)!;
                return (
                  <div key={to} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">{item.label}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveMenu(idx, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === orderedMenu.length - 1} onClick={() => moveMenu(idx, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DASHBOARD */}
      <Card>
        <CardHeader>
          <CardTitle>Tableau de bord</CardTitle>
          <CardDescription>Affichez ou masquez les widgets et choisissez la page d'accueil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Page d'accueil par défaut</Label>
            <Select value={draft.landing_page} onValueChange={(v) => patch({ landing_page: v })}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANDING_PAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Widgets du tableau de bord</Label>
            {DASHBOARD_WIDGETS.map((w) => (
              <div key={w.key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm">{w.label}</span>
                <Switch
                  checked={!draft.hidden_widgets.includes(w.key)}
                  onCheckedChange={(c) => toggleWidget(w.key, c)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ACTIONS */}
      <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button variant="outline" onClick={reset} disabled={save.isPending}>
          <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" /> Enregistrer mes préférences
        </Button>
      </div>

      <SystemDefaultsCard />
    </div>
  );
}

/** Super-administrator: system default theme + branding inherited by new users. */
function SystemDefaultsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["store-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("id, default_theme, default_mode, login_logo_url, login_background_url, favicon_url")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        default_theme: string;
        default_mode: string;
        login_logo_url: string | null;
        login_background_url: string | null;
        favicon_url: string | null;
      } | null;
    },
  });

  const [defaults, setDefaults] = useState({ default_theme: "gold", default_mode: "light" });
  useEffect(() => {
    if (data) setDefaults({ default_theme: data.default_theme, default_mode: data.default_mode });
  }, [data]);

  const branding: { key: "login_logo_url" | "login_background_url" | "favicon_url"; label: string }[] = [
    { key: "login_logo_url", label: "Logo de l'écran de connexion" },
    { key: "login_background_url", label: "Image de fond de connexion" },
    { key: "favicon_url", label: "Favicon / icône de l'application" },
  ];

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("store_settings")
        .update(patch)
        .eq("singleton", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres par défaut enregistrés.");
      qc.invalidateQueries({ queryKey: ["store-defaults"] });
      qc.invalidateQueries({ queryKey: STORE_SETTINGS_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadBranding(key: string, file: File) {
    const dataUrl = await readFileAsDataUrl(file);
    save.mutate({ [key]: dataUrl });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Thème système par défaut & image de marque
        </CardTitle>
        <CardDescription>
          Réservé aux super-administrateurs. Les nouveaux utilisateurs héritent de ce thème
          jusqu'à ce qu'ils personnalisent leurs propres préférences.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Thème par défaut</Label>
            <Select value={defaults.default_theme} onValueChange={(v) => setDefaults((d) => ({ ...d, default_theme: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mode par défaut</Label>
            <Select value={defaults.default_mode} onValueChange={(v) => setDefaults((d) => ({ ...d, default_mode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Mode clair</SelectItem>
                <SelectItem value="dark">Mode sombre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => save.mutate(defaults)} disabled={save.isPending}>
          <Save className="mr-2 h-4 w-4" /> Définir comme thème système
        </Button>

        <div className="space-y-3 border-t pt-4">
          {branding.map((b) => {
            const current = data?.[b.key] ?? null;
            return (
              <div key={b.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {current ? (
                      <img src={current} alt={b.label} className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm">{b.label}</span>
                </div>
                <div className="flex gap-2">
                  <label>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBranding(b.key, f); }}
                    />
                    <span className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                      Téléverser
                    </span>
                  </label>
                  {current && (
                    <Button variant="ghost" size="sm" onClick={() => save.mutate({ [b.key]: null })}>
                      Retirer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
