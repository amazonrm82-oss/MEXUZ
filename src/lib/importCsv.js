import Papa from "papaparse";
import { isUSCountryValue } from "./constants";

const FIELD_ALIASES = {
  name: ["name", "שם"],
  phone: ["phone", "טלפון"],
  businessName: ["business", "business_name", "עסק", "שם עסק"],
  contactRole: ["role", "תפקיד"],
  product: ["product", "מוצר"],
  quantity: ["quantity", "qty", "כמות"],
  adName: ["ad", "ad_name", "מודעה"],
  channel: ["channel", "ערוץ"],
  address: ["address", "כתובת"],
  city: ["city", "עיר"],
  country: ["country", "מדינה"],
};

function pick(row, aliases) {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase();
    if (aliases.some((a) => a.toLowerCase() === norm)) return row[key];
  }
  return "";
}

export function parseLeadsCsv(csvText, defaultCountry) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return (parsed.data || []).map((row) => {
    const country = (pick(row, FIELD_ALIASES.country) || defaultCountry || "").trim();
    return {
      name: (pick(row, FIELD_ALIASES.name) || "").trim(),
      phone: (pick(row, FIELD_ALIASES.phone) || "").trim(),
      business_name: (pick(row, FIELD_ALIASES.businessName) || "").trim(),
      contact_role: (pick(row, FIELD_ALIASES.contactRole) || "").trim(),
      product: (pick(row, FIELD_ALIASES.product) || "").trim(),
      quantity: Number(pick(row, FIELD_ALIASES.quantity)) || 0,
      ad_name: (pick(row, FIELD_ALIASES.adName) || "").trim(),
      channel: (pick(row, FIELD_ALIASES.channel) || "ייבוא").trim(),
      address: (pick(row, FIELD_ALIASES.address) || "").trim(),
      city: (pick(row, FIELD_ALIASES.city) || "").trim(),
      country,
      is_international: isUSCountryValue(country),
    };
  }).filter((r) => r.name || r.phone);
}
