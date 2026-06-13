// Formats an integer to have Indonesian thousands separator (dot). E.g. 1000 -> "1.000"
export function formatInteger(val) {
  if (val === null || val === undefined || val === "") return "";
  // Strip anything that is not a digit
  const clean = String(val).replace(/[^\d]/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID").format(num);
}

// Parses a formatted integer string back to a raw number
export function parseInteger(val) {
  if (val === null || val === undefined || val === "") return "";
  const clean = String(val).replace(/[^\d]/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  return isNaN(num) ? "" : num;
}

// Formats a decimal to have Indonesian thousands separator (dot) and decimal separator (comma).
// E.g. 1000.5 -> "1.000,5"
export function formatDecimal(val) {
  if (val === null || val === undefined || val === "") return "";
  
  let str = String(val);
  
  // Normalize trailing dot (user typing decimal point)
  if (str.endsWith(".")) {
    str = str.slice(0, -1) + ",";
  }
  
  // Normalize single dot decimal input (e.g. "1250.5" -> "1250,5" but keep "1.250" as is)
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount === 1 && !str.includes(",")) {
    const dotIdx = str.indexOf(".");
    const digitsAfter = str.substring(dotIdx + 1);
    if (digitsAfter.length !== 3 || !/^\d+$/.test(digitsAfter)) {
      str = str.replace(".", ",");
    }
  }
  
  const parts = str.split(",");
  
  // Format the integer part by removing all thousands separators (dots) first
  const integerPart = parts[0].replace(/[^\d]/g, "");
  if (!integerPart && parts.length === 1) return "";
  
  const num = parseInt(integerPart, 10);
  const formattedInt = isNaN(num) ? "" : new Intl.NumberFormat("id-ID").format(num);
  
  if (parts.length > 1) {
    // Keep only digits in the decimal part
    const decimalPart = parts[1].replace(/[^\d]/g, "");
    return `${formattedInt},${decimalPart}`;
  }
  
  return formattedInt;
}

// Parses a formatted decimal string back to a raw float number
export function parseDecimal(val) {
  if (val === null || val === undefined || val === "") return "";
  
  let str = String(val);
  if (str.endsWith(".")) {
    str = str.slice(0, -1) + ",";
  }
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount === 1 && !str.includes(",")) {
    const dotIdx = str.indexOf(".");
    const digitsAfter = str.substring(dotIdx + 1);
    if (digitsAfter.length !== 3 || !/^\d+$/.test(digitsAfter)) {
      str = str.replace(".", ",");
    }
  }
  
  // Strip thousands separators (dots in id-ID)
  let clean = str.replace(/\./g, "");
  
  // Replace decimal separator (comma in id-ID) with dot for JS float parsing
  clean = clean.replace(/,/g, ".");
  
  // Strip non-digits and non-dots
  clean = clean.replace(/[^\d.]/g, "");
  
  if (!clean) return "";
  if (clean === ".") return "";
  
  const num = parseFloat(clean);
  return isNaN(num) ? "" : num;
}

// Formats money input while typing, preserving trailing dot thousands separators
export function formatMoney(val) {
  if (val === null || val === undefined || val === "") return "";
  
  let str = String(val);
  const parts = str.split(",");
  
  const integerPart = parts[0].replace(/[^\d]/g, "");
  if (!integerPart && parts.length === 1) return "";
  
  const num = parseInt(integerPart, 10);
  const formattedInt = isNaN(num) ? "" : new Intl.NumberFormat("id-ID").format(num);
  
  let trailing = "";
  if (str.endsWith(".")) {
    trailing = ".";
  }
  
  if (parts.length > 1) {
    const decimalPart = parts[1].replace(/[^\d]/g, "");
    return `${formattedInt},${decimalPart}`;
  }
  
  return formattedInt + trailing;
}

// Parses money input back to a raw number
export function parseMoney(val) {
  if (val === null || val === undefined || val === "") return "";
  
  let str = String(val);
  
  let clean = str.replace(/\./g, "");
  clean = clean.replace(/,/g, ".");
  clean = clean.replace(/[^\d.]/g, "");
  
  if (!clean) return "";
  if (clean === ".") return "";
  
  const num = parseFloat(clean);
  return isNaN(num) ? "" : num;
}

// Formats money display with decimals when blurred using id-ID locale rules
export function formatMoneyDisplay(val, isFocused = false) {
  if (val === null || val === undefined || val === "") return "";
  
  let clean = String(val).replace(/\./g, "").replace(/,/g, ".");
  clean = clean.replace(/[^\d.]/g, "");
  if (!clean) return "";
  
  const num = parseFloat(clean);
  if (isNaN(num)) return "";
  
  if (isFocused) {
    return formatMoney(val);
  } else {
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }
}

// Formats a float or numeric string to Indonesian standard decimal representation. E.g. 12.5 -> "12,5"
export function formatDecimalDisplay(val) {
  if (val === null || val === undefined || val === "") return "";
  const num = parseFloat(val);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 20 }).format(num);
}
