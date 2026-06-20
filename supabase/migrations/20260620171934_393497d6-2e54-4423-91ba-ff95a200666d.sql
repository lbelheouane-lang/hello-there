ALTER TABLE public.store_settings ALTER COLUMN eur_to_dzd SET DEFAULT 280;
UPDATE public.store_settings SET eur_to_dzd = 280 WHERE eur_to_dzd = 145;