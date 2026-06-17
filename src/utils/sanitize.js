/**
 * Melakukan sanitasi teks masukan untuk mencegah serangan Cross-Site Scripting (XSS).
 * Fungsi ini membuang tag skrip secara rekursif dan membersihkan tag HTML lainnya.
 * 
 * @param {string} text Masukan teks mentah dari form.
 * @returns {string} Teks yang telah dibersihkan.
 */
export function sanitizeInputText(text) {
  if (typeof text !== "string") return text;
  
  return text
    // Hapus script block beserta isinya secara case-insensitive
    .replace(/<script[^>]*>([\S\s]*?)<\/script>/gi, "")
    // Hapus semua tag HTML/XML lainnya
    .replace(/<\/?[^>]+(>|$)/g, "")
    // Bersihkan spasi berlebih di awal/akhir
    .trim();
}
