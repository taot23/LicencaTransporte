-- função padrão
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- utilitário: adiciona created_at/updated_at se faltar e cria trigger
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type='BASE TABLE'
      AND table_name IN ('vehicles','license_vehicles','licenses','transporters','vehicle_set_types')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();', r.table_schema, r.table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I.%I;', r.table_name, r.table_schema, r.table_name);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I.%I
                    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
                    r.table_name, r.table_schema, r.table_name);
  END LOOP;
END $$;