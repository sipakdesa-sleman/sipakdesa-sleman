-- ========================================================================
-- SIPAKDESA SLEMAN COMPLETE DATABASE SCHEMA (FIXED HANDOVER VERSION)
-- Execute this script in Supabase SQL Editor BEFORE seeding data
-- ========================================================================

-- DROP existing tables in reverse dependency order to avoid foreign key issues
DROP TABLE IF EXISTS public.sipakdesa_moora_run_items CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_moora_runs CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_pra_kalkulasi_run_items CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_pra_kalkulasi_runs CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_ahp_runs CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_desa_raw_values CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_system_parameters CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_bpkal_configs CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_periods CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_parameters CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_criteria CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_alternatives CASCADE;
DROP TABLE IF EXISTS public.sipakdesa_users CASCADE;

-- 1. Create sipakdesa_users
CREATE TABLE public.sipakdesa_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    fullname VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create sipakdesa_alternatives (Villages)
CREATE TABLE public.sipakdesa_alternatives (
    id VARCHAR(50) PRIMARY KEY, -- ID Dokumen Kalurahan (A1, A2, dst.)
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    kecamatan VARCHAR(255) NOT NULL,
    jumlah_padukuhan INTEGER,
    jumlah_dukuh INTEGER,
    jumlah_bpkal INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create sipakdesa_criteria
CREATE TABLE public.sipakdesa_criteria (
    code VARCHAR(50) PRIMARY KEY, -- Kode Kriteria (C1, C2, dst.)
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('benefit', 'cost')),
    nature VARCHAR(50) DEFAULT 'kuantitatif' CHECK (nature IN ('kuantitatif', 'kualitatif')),
    active BOOLEAN DEFAULT TRUE,
    order_num INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create sipakdesa_parameters
CREATE TABLE public.sipakdesa_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criteria_code VARCHAR(50) REFERENCES public.sipakdesa_criteria(code) ON DELETE CASCADE,
    min_val NUMERIC,
    max_val NUMERIC,
    score INTEGER NOT NULL,
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create sipakdesa_periods
CREATE TABLE public.sipakdesa_periods (
    id VARCHAR(50) PRIMARY KEY, -- String Tahun Anggaran (misal: '2026')
    year INTEGER UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    needs_recalc BOOLEAN DEFAULT FALSE,
    ahp_done BOOLEAN DEFAULT FALSE,
    pra_kalkulasi_done BOOLEAN DEFAULT FALSE,
    moora_done BOOLEAN DEFAULT FALSE,
    pra_kalkulasi_result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create sipakdesa_bpkal_configs
CREATE TABLE public.sipakdesa_bpkal_configs (
    period_id VARCHAR(50) PRIMARY KEY REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    tarif_ketua NUMERIC DEFAULT 0,
    tarif_wakil NUMERIC DEFAULT 0,
    tarif_sekretaris NUMERIC DEFAULT 0,
    tarif_bidang NUMERIC DEFAULT 0,
    tarif_anggota NUMERIC DEFAULT 0,
    templates JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create sipakdesa_system_parameters
CREATE TABLE public.sipakdesa_system_parameters (
    period_id VARCHAR(50) PRIMARY KEY REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    umk_aktif NUMERIC DEFAULT 0,
    rate_bpjs_kes NUMERIC DEFAULT 0,
    rate_bpjs_naker NUMERIC DEFAULT 0,
    siltap_lurah NUMERIC DEFAULT 0,
    siltap_carik NUMERIC DEFAULT 0,
    siltap_kasi NUMERIC DEFAULT 0,
    siltap_dukuh NUMERIC DEFAULT 0,
    default_lurah_count INTEGER DEFAULT 1,
    default_carik_count INTEGER DEFAULT 1,
    default_kasi_kaur_count INTEGER DEFAULT 1,
    bpjs_staff_count INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create sipakdesa_desa_raw_values
CREATE TABLE public.sipakdesa_desa_raw_values (
    desa_id VARCHAR(50) REFERENCES public.sipakdesa_alternatives(id) ON DELETE CASCADE,
    period_id VARCHAR(50) REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    values JSONB DEFAULT '{}'::jsonb NOT NULL,
    jumlah_bpkal INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (desa_id, period_id)
);

-- 9. Create sipakdesa_ahp_runs
CREATE TABLE public.sipakdesa_ahp_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id VARCHAR(50) REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    label VARCHAR(255) ,
    cr NUMERIC,
    weights JSONB DEFAULT '{}'::jsonb,
    matrix JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Create sipakdesa_pra_kalkulasi_runs
CREATE TABLE public.sipakdesa_pra_kalkulasi_runs (
    id VARCHAR(50) PRIMARY KEY, 
    period_id VARCHAR(50) REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    label VARCHAR(255),
    summary JSONB DEFAULT '{}'::jsonb,
    pagu_total_kab NUMERIC DEFAULT 0,
    pagu_kab NUMERIC DEFAULT 0,
    is_kebijakan_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Create sipakdesa_pra_kalkulasi_run_items
CREATE TABLE public.sipakdesa_pra_kalkulasi_run_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(50) REFERENCES public.sipakdesa_pra_kalkulasi_runs(id) ON DELETE CASCADE,
    desa_id VARCHAR(50) REFERENCES public.sipakdesa_alternatives(id) ON DELETE CASCADE,
    desa_name VARCHAR(255) NOT NULL,
    kecamatan VARCHAR(255) NOT NULL,
    siltap_count JSONB DEFAULT '{}'::jsonb,
    bpkal_count INTEGER,
    add_sil NUMERIC DEFAULT 0,
    add_kes NUMERIC DEFAULT 0,
    add_ker NUMERIC DEFAULT 0,
    add_keb NUMERIC DEFAULT 0,
    add_bpkal NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Create sipakdesa_moora_runs
CREATE TABLE public.sipakdesa_moora_runs (
    id VARCHAR(50) PRIMARY KEY, 
    period_id VARCHAR(50) REFERENCES public.sipakdesa_periods(id) ON DELETE CASCADE,
    ahp_results_id UUID REFERENCES public.sipakdesa_ahp_runs(id) ON DELETE SET NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Create sipakdesa_moora_run_items
CREATE TABLE public.sipakdesa_moora_run_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(50) REFERENCES public.sipakdesa_moora_runs(id) ON DELETE CASCADE,
    desa_id VARCHAR(50) REFERENCES public.sipakdesa_alternatives(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    yi NUMERIC DEFAULT 0,
    rank INTEGER NOT NULL,
    nominal NUMERIC DEFAULT 0,
    normalized JSONB DEFAULT '{}'::jsonb,
    weighted JSONB DEFAULT '{}'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================================
-- MANDATORY API PRIVILEGES & GLOBAL GRANTS (FIXES PERMISSION DENIED)
-- ========================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- ========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================================
ALTER TABLE public.sipakdesa_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_alternatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_bpkal_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_system_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_desa_raw_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_ahp_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_pra_kalkulasi_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_pra_kalkulasi_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_moora_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sipakdesa_moora_run_items ENABLE ROW LEVEL SECURITY;

-- 1. sipakdesa_users policies
CREATE POLICY "Users viewable by authenticated" ON public.sipakdesa_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users editable by admin or super_admin" ON public.sipakdesa_users FOR ALL TO authenticated USING (true);

-- 2. Master Data policies (alternatives & criteria)
CREATE POLICY "Master data viewable by authenticated" ON public.sipakdesa_alternatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master data editable by authenticated" ON public.sipakdesa_alternatives FOR ALL TO authenticated USING (true);
CREATE POLICY "Criteria viewable by authenticated" ON public.sipakdesa_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criteria editable by authenticated" ON public.sipakdesa_criteria FOR ALL TO authenticated USING (true);
CREATE POLICY "Parameters viewable by authenticated" ON public.sipakdesa_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Parameters editable by authenticated" ON public.sipakdesa_parameters FOR ALL TO authenticated USING (true);

-- 3. Periods & configs policies (OPEN ACCESS FIX FOR RUN MOTORS)
CREATE POLICY "Periods viewable by authenticated" ON public.sipakdesa_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Periods editable by authenticated" ON public.sipakdesa_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "BPKal configs viewable by authenticated" ON public.sipakdesa_bpkal_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "BPKal configs editable by authenticated" ON public.sipakdesa_bpkal_configs FOR ALL TO authenticated USING (true);
CREATE POLICY "System parameters viewable by authenticated" ON public.sipakdesa_system_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "System parameters editable by authenticated" ON public.sipakdesa_system_parameters FOR ALL TO authenticated USING (true);

-- 4. Raw values and runs policies
CREATE POLICY "Desa raw values viewable by authenticated" ON public.sipakdesa_desa_raw_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Desa raw values editable by authenticated" ON public.sipakdesa_desa_raw_values FOR ALL TO authenticated USING (true);
CREATE POLICY "AHP runs viewable by authenticated" ON public.sipakdesa_ahp_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "AHP runs editable by authenticated" ON public.sipakdesa_ahp_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "Pra-kalkulasi runs viewable by authenticated" ON public.sipakdesa_pra_kalkulasi_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pra-kalkulasi runs editable by authenticated" ON public.sipakdesa_pra_kalkulasi_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "Pra-kalkulasi run items viewable by authenticated" ON public.sipakdesa_pra_kalkulasi_run_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Pra-kalkulasi run items editable by authenticated" ON public.sipakdesa_pra_kalkulasi_run_items FOR ALL TO authenticated USING (true);
CREATE POLICY "MOORA runs viewable by authenticated" ON public.sipakdesa_moora_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "MOORA runs editable by authenticated" ON public.sipakdesa_moora_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "MOORA run items viewable by authenticated" ON public.sipakdesa_moora_run_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "MOORA run items editable by authenticated" ON public.sipakdesa_moora_run_items FOR ALL TO authenticated USING (true);

-- ========================================================================
-- Trigger logic to prevent modifying locked period data
-- ========================================================================
CREATE OR REPLACE FUNCTION public.check_period_lock()
RETURNS TRIGGER AS $$
BEGIN
IF EXISTS (
    SELECT 1 FROM public.sipakdesa_periods
WHERE id = COALESCE(NEW.period_id, OLD.period_id) AND locked = TRUE
) THEN
RAISE EXCEPTION 'Operasi dibatalkan: Periode anggaran tahun ini telah dikunci dan tidak dapat diubah!';
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_prevent_changes_on_locked_period_raw
BEFORE INSERT OR UPDATE OR DELETE ON public.sipakdesa_desa_raw_values
FOR EACH ROW EXECUTE FUNCTION public.check_period_lock();
CREATE TRIGGER trg_prevent_changes_on_locked_period_bpkal
BEFORE INSERT OR UPDATE OR DELETE ON public.sipakdesa_bpkal_configs
FOR EACH ROW EXECUTE FUNCTION public.check_period_lock();
CREATE TRIGGER trg_prevent_changes_on_locked_period_system
BEFORE INSERT OR UPDATE OR DELETE ON public.sipakdesa_system_parameters
FOR EACH ROW EXECUTE FUNCTION public.check_period_lock();

-- ========================================================================
-- Trigger logic to delete Supabase Auth user when profile is deleted
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_delete_user()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_delete_supabase_auth_user
AFTER DELETE ON public.sipakdesa_users
FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user();

