import { supabase } from "../supabase/supabaseConfig";

// Ambil daftar kriteria (wajib punya field code)
export async function getCriteria() {
  const { data, error } = await supabase
    .from("sipakdesa_criteria")
    .select("code, name, type")
    .order("order_num", { ascending: true });

  if (error) {
    throw new Error(`Gagal mengambil data kriteria: ${error.message}`);
  }

  return data.map((d) => ({
    id: d.code,
    code: d.code,
    name: d.name ?? "",
    type: d.type ?? null,
  }));
}

// Ambil tipe kriteria tiap kode: "benefit" atau "cost"
export async function getCriteriaTypes() {
  const { data, error } = await supabase
    .from("sipakdesa_criteria")
    .select("code, type");

  if (error) {
    throw new Error(`Gagal mengambil tipe kriteria: ${error.message}`);
  }

  const obj = {};
  data.forEach((d) => {
    const code = String(d.code).toUpperCase();
    const rawType = d.type ?? null;
    const normalized = rawType === null || rawType === ""
      ? null
      : String(rawType).toLowerCase();
    obj[code] = normalized === "cost" || normalized === "benefit" ? normalized : null;
  });
  return obj;
}