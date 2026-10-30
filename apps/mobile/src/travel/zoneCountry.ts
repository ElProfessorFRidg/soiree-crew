/**
 * PREF-05: the country a time zone points to, for the countries the app has driving rules for.
 * People rarely change their phone's region on a trip, but the clock follows the network, so a
 * new time zone is often the only sign of being abroad. Unknown zones give null.
 */
const ZONES: Record<string, string> = {
  "Europe/Paris": "FR",
  "Europe/Brussels": "BE",
  "Europe/Luxembourg": "LU",
  "Europe/Zurich": "CH",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
  "Europe/Madrid": "ES",
  "Atlantic/Canary": "ES",
  "Africa/Ceuta": "ES",
  "Europe/Rome": "IT",
  "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT",
  "Atlantic/Azores": "PT",
  "Europe/Amsterdam": "NL",
  "Europe/Dublin": "IE",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Bratislava": "SK",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/London": "GB",
  "Asia/Tokyo": "JP",
  "Pacific/Auckland": "NZ",
  "Africa/Casablanca": "MA",
  "Africa/Tunis": "TN",
  "Africa/Algiers": "DZ",
  "Pacific/Honolulu": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "America/Detroit": "US",
  "America/Boise": "US",
  "America/Toronto": "CA",
  "America/Montreal": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/Sao_Paulo": "BR",
  "America/Manaus": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Bahia": "BR",
  "America/Belem": "BR",
  "Europe/Moscow": "RU",
  "Europe/Kaliningrad": "RU",
  "Europe/Samara": "RU",
  "Asia/Yekaterinburg": "RU",
  "Asia/Omsk": "RU",
  "Asia/Novosibirsk": "RU",
  "Asia/Krasnoyarsk": "RU",
  "Asia/Irkutsk": "RU",
  "Asia/Vladivostok": "RU",
};

export function countryOfTimeZone(zone: string): string | null {
  if (ZONES[zone]) return ZONES[zone]!;
  if (zone.startsWith("Australia/")) return "AU";
  // The main US zones and their Indiana and Kentucky variants.
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Indiana\/|Kentucky\/|North_Dakota\/)/.test(zone)) return "US";
  return null;
}
