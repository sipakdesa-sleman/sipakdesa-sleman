-- ========================================================================
-- SIPAKDESA SLEMAN SEED DATA FILE FOR EASY DEPLOYMENT
-- Run this script in Supabase SQL Editor to populate initial master data
-- ========================================================================

-- A. Ensure schema has nature column
ALTER TABLE public.sipakdesa_criteria ADD COLUMN IF NOT EXISTS nature VARCHAR DEFAULT 'kuantitatif';

-- 1. Seed Criteria Data
INSERT INTO public.sipakdesa_criteria (code, name, type, nature, active, order_num) VALUES 
('C1', 'Jumlah Padukuhan', 'benefit', 'kuantitatif', true, 1),
('C2', 'Jumlah Penduduk Miskin', 'benefit', 'kuantitatif', true, 2),
('C3', 'Luas Wilayah', 'benefit', 'kuantitatif', true, 3),
('C4', 'Jumlah Penduduk', 'benefit', 'kuantitatif', true, 4),
('C5', 'IKG', 'benefit', 'kuantitatif', true, 5)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name, 
    type = EXCLUDED.type, 
    nature = EXCLUDED.nature, 
    active = EXCLUDED.active, 
    order_num = EXCLUDED.order_num;

-- 2. Seed Alternatives (Villages) Data
INSERT INTO public.sipakdesa_alternatives (id, code, name, kecamatan, jumlah_padukuhan, jumlah_dukuh, jumlah_bpkal) VALUES 
('A1', 'A1', 'Balecatur', 'Gamping', 18, 18, 9),
('A2', 'A2', 'Ambarketawang', 'Gamping', 13, 13, 9),
('A3', 'A3', 'Banyuraden', 'Gamping', 8, 8, 9),
('A4', 'A4', 'Nogotirto', 'Gamping', 8, 8, 9),
('A5', 'A5', 'Trihanggo', 'Gamping', 12, 12, 9),
('A6', 'A6', 'Sidorejo', 'Godean', 13, 13, 7),
('A7', 'A7', 'Sidoluhur', 'Godean', 15, 15, 9),
('A8', 'A8', 'Sidomulyo', 'Godean', 8, 8, 7),
('A9', 'A9', 'Sidoagung', 'Godean', 8, 8, 9),
('A10', 'A10', 'Sidokarto', 'Godean', 14, 14, 9),
('A11', 'A11', 'Sidoarum', 'Godean', 8, 8, 9),
('A12', 'A12', 'Sidomoyo', 'Godean', 11, 11, 7),
('A13', 'A13', 'Sumberrahayu', 'Moyudan', 15, 15, 7),
('A14', 'A14', 'Sumbersari', 'Moyudan', 13, 13, 9),
('A15', 'A15', 'Sumberagung', 'Moyudan', 21, 21, 9),
('A16', 'A16', 'Sumberarum', 'Moyudan', 16, 16, 7),
('A17', 'A17', 'Sendangarum', 'Minggir', 9, 9, 5),
('A18', 'A18', 'Sendangmulyo', 'Minggir', 16, 16, 7),
('A19', 'A19', 'Sendangagung', 'Minggir', 15, 15, 7),
('A20', 'A20', 'Sendangsari', 'Minggir', 12, 12, 7),
('A21', 'A21', 'Sendangrejo', 'Minggir', 16, 16, 9),
('A22', 'A22', 'Margoluwih', 'Seyegan', 14, 14, 9),
('A23', 'A23', 'Margodadi', 'Seyegan', 16, 16, 9),
('A24', 'A24', 'Margokaton', 'Seyegan', 12, 12, 7),
('A25', 'A25', 'Margomulyo', 'Seyegan', 13, 13, 9),
('A26', 'A26', 'Margoagung', 'Seyegan', 12, 12, 9),
('A27', 'A27', 'Sinduadi', 'Mlati', 18, 18, 9),
('A28', 'A28', 'Sendangadi', 'Mlati', 14, 14, 9),
('A29', 'A29', 'Tlogoadi', 'Mlati', 12, 12, 9),
('A30', 'A30', 'Tirtoadi', 'Mlati', 15, 15, 9),
('A31', 'A31', 'Sumberadi', 'Mlati', 15, 15, 9),
('A32', 'A32', 'Caturtunggal', 'Depok', 20, 20, 9),
('A33', 'A33', 'Maguwoharjo', 'Depok', 20, 20, 9),
('A34', 'A34', 'Condongcatur', 'Depok', 18, 18, 9),
('A35', 'A35', 'Sendangtirto', 'Berbah', 18, 18, 9),
('A36', 'A36', 'Tegaltirto', 'Berbah', 14, 14, 9),
('A37', 'A37', 'Kalitirto', 'Berbah', 16, 16, 9),
('A38', 'A38', 'Jogotirto', 'Berbah', 10, 10, 9),
('A39', 'A39', 'Sumberharjo', 'Prambanan', 18, 18, 9),
('A40', 'A40', 'Wukirharjo', 'Prambanan', 6, 6, 5),
('A41', 'A41', 'Gayamharjo', 'Prambanan', 7, 7, 7),
('A42', 'A42', 'Sambirejo', 'Prambanan', 8, 8, 7),
('A43', 'A43', 'Madurejo', 'Prambanan', 16, 16, 9),
('A44', 'A44', 'Bokoharjo', 'Prambanan', 13, 13, 9),
('A45', 'A45', 'Purwomartani', 'Kalasan', 21, 21, 9),
('A46', 'A46', 'Tirtomartani', 'Kalasan', 17, 17, 9),
('A47', 'A47', 'Tamanmartani', 'Kalasan', 22, 22, 9),
('A48', 'A48', 'Selomartani', 'Kalasan', 20, 20, 9),
('A49', 'A49', 'Sindumartani', 'Ngemplak', 11, 11, 7),
('A50', 'A50', 'Bimomartani', 'Ngemplak', 12, 12, 7),
('A51', 'A51', 'Widodomartani', 'Ngemplak', 19, 19, 7),
('A52', 'A52', 'Wedomartani', 'Ngemplak', 25, 25, 9),
('A53', 'A53', 'Umbulmartani', 'Ngemplak', 15, 15, 9),
('A54', 'A54', 'Sariharjo', 'Ngaglik', 16, 16, 9),
('A55', 'A55', 'Minomartani', 'Ngaglik', 6, 6, 9),
('A56', 'A56', 'Sinduharjo', 'Ngaglik', 17, 17, 9),
('A57', 'A57', 'Sukoharjo', 'Ngaglik', 14, 14, 9),
('A58', 'A58', 'Sardonoharjo', 'Ngaglik', 18, 18, 9),
('A59', 'A59', 'Donoharjo', 'Ngaglik', 16, 16, 9),
('A60', 'A60', 'Caturharjo', 'Sleman', 20, 20, 9),
('A61', 'A61', 'Triharjo', 'Sleman', 12, 12, 9),
('A62', 'A62', 'Tridadi', 'Sleman', 15, 15, 9),
('A63', 'A63', 'Pandowoharjo', 'Sleman', 22, 22, 9),
('A64', 'A64', 'Trimulyo', 'Sleman', 14, 14, 9),
('A65', 'A65', 'Banyurejo', 'Tempel', 14, 14, 7),
('A66', 'A66', 'Tambakrejo', 'Tempel', 11, 11, 7),
('A67', 'A67', 'Sumberrejo', 'Tempel', 10, 10, 7),
('A68', 'A68', 'Pondokrejo', 'Tempel', 9, 9, 7),
('A69', 'A69', 'Mororejo', 'Tempel', 13, 13, 7),
('A70', 'A70', 'Margorejo', 'Tempel', 14, 14, 9),
('A71', 'A71', 'Lumbungrejo', 'Tempel', 10, 10, 7),
('A72', 'A72', 'Merdikorejo', 'Tempel', 17, 17, 7),
('A73', 'A73', 'Bangunkerto', 'Turi', 12, 12, 9),
('A74', 'A74', 'Donokerto', 'Turi', 16, 16, 9),
('A75', 'A75', 'Girikerto', 'Turi', 13, 13, 7),
('A76', 'A76', 'Wonokerto', 'Turi', 13, 13, 9),
('A77', 'A77', 'Purwobinangun', 'Pakem', 16, 16, 9),
('A78', 'A78', 'Candibinangun', 'Pakem', 12, 12, 7),
('A79', 'A79', 'Harjobinangun', 'Pakem', 11, 11, 7),
('A80', 'A80', 'Pakembinangun', 'Pakem', 10, 10, 7),
('A81', 'A81', 'Hargobinangun', 'Pakem', 12, 12, 9),
('A82', 'A82', 'Argomulyo', 'Cangkringan', 22, 22, 7),
('A83', 'A83', 'Wukirsari', 'Cangkringan', 24, 24, 9),
('A84', 'A84', 'Glagaharjo', 'Cangkringan', 10, 10, 5),
('A85', 'A85', 'Kepuharjo', 'Cangkringan', 8, 8, 5),
('A86', 'A86', 'Umbulharjo', 'Cangkringan', 9, 9, 7)
ON CONFLICT (id) DO UPDATE SET 
    code = EXCLUDED.code, 
    name = EXCLUDED.name, 
    kecamatan = EXCLUDED.kecamatan, 
    jumlah_padukuhan = EXCLUDED.jumlah_padukuhan, 
    jumlah_dukuh = EXCLUDED.jumlah_dukuh, 
    jumlah_bpkal = EXCLUDED.jumlah_bpkal;

-- 3. Seed Default Super Admin User (FORCE ROLE FORCE INJECT)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'de305d54-75b4-431b-adb2-eb6b9e546014',
    'authenticated',
    'authenticated',
    'admin@sipakdesa.id',
    crypt('password123', gen_salt('bf')),
    now(), null, null,
    '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
    '{"fullname": "Super Admin Sipakdesa"}'::jsonb,
    now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO UPDATE SET 
    raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "super_admin"}'::jsonb,
    raw_user_meta_data = '{"fullname": "Super Admin Sipakdesa"}'::jsonb;

INSERT INTO public.sipakdesa_users (id, email, role, fullname, active, created_at)
VALUES (
    'de305d54-75b4-431b-adb2-eb6b9e546014',
    'admin@sipakdesa.id',
    'super_admin',
    'Super Admin Sipakdesa',
    true,
    now()
)
ON CONFLICT (id) DO UPDATE SET 
    role = 'super_admin', 
    email = EXCLUDED.email, 
    fullname = EXCLUDED.fullname;