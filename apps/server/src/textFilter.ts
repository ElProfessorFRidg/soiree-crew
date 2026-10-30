import { HttpError } from "./context";

/**
 * COM-08 automatic filters, run on every text other people will read (reviews, quotes, crew cards,
 * party names, going-out notes, bios, event titles, owner replies). A hit refuses the text with a
 * code the app explains next to the field; nothing is stored. COM-02 adds the named-person rule
 * for reviews. Heuristics, deliberately narrow: a false refusal costs a rewording, a missed one
 * still goes through reports.
 */
export type FilterCode = "text_abusive" | "text_personal_data" | "text_names_person";

/** Lowercase, no accents, common letter swaps undone, so "C0NN4RD" and "connard" read the same. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[0134@$5]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s", "5": "s" })[c]!)
    .replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Insults and harassment. FR and EN in depth, ES, IT, DE and PT basics. Whole words only, so
 * "con" never catches "concert". Words are stored normalised (no accents).
 */
const ABUSIVE_WORDS = new Set([
  // fr
  "connard", "connards", "connasse", "connasses", "conne", "salope", "salopes", "salaud", "salauds", "pute", "putes",
  "encule", "encules", "enculee", "enfoire", "enfoires", "batard", "batards", "pd", "pede", "pedes", "tapette", "tarlouze", "gouine",
  "negro", "bougnoule", "bicot", "youpin", "chintok", "bamboula", "pouffiasse", "grognasse", "abruti", "abrutis",
  "attarde", "attardes", "trisomique", "fdp", "ntm", "ta gueule", "ferme ta gueule", "nique ta mere",
  "fils de pute", "sale pute", "sale con", "va te faire", "suicide toi", "je vais te tuer", "on va te tuer", "grosse vache",
  "sac a foutre", "salope de", "trou du cul", "merdeux", "raclure", "sous merde", "boloss", "baltringue", "cassos",
  // en
  "asshole", "assholes", "bitch", "bitches", "bastard", "bastards", "cunt", "cunts", "dickhead", "dickheads", "fuck you", "fuck off",
  "fucker", "motherfucker", "motherfuckers", "slut", "sluts", "whore", "whores", "faggot", "faggots", "dyke", "nigger",
  "niggers", "nigga", "retarded", "spastic", "tranny", "kike", "chink", "paki", "wanker", "wankers", "twat",
  "twats", "prick", "kill yourself", "kys", "go die", "i will kill you", "piece of shit", "shithead", "scumbag", "skank", "cocksucker",
  // es
  "puta", "putas", "cabron", "cabrones", "gilipollas", "hijo de puta", "maricon", "maricones", "pendejo", "pendejos", "zorra", "zorras",
  "imbecil", "subnormal", "malparido",
  // it
  "stronzo", "stronzi", "stronza", "vaffanculo", "puttana", "puttane", "frocio", "froci", "coglione", "coglioni",
  "figlio di puttana", "bastardo", "bastarda", "ricchione",
  // de
  "arschloch", "arschlocher", "hurensohn", "hure", "huren", "fotze", "wichser", "schwuchtel", "missgeburt", "spast", "fick dich",
  "drecksau", "schlampe", "kanake",
  // pt
  "caralho", "filho da puta", "puta que pariu", "vadia", "viado", "arrombado", "otario", "babaca", "buceta",
]);

const ABUSIVE_PHRASES = [...ABUSIVE_WORDS].filter((w) => w.includes(" "));
const ABUSIVE_SINGLE = new Set([...ABUSIVE_WORDS].filter((w) => !w.includes(" ")));

export function isAbusive(text: string): boolean {
  const flat = normalise(text);
  const words = flat.split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => ABUSIVE_SINGLE.has(w))) return true;
  const spaced = ` ${words.join(" ")} `;
  return ABUSIVE_PHRASES.some((p) => spaced.includes(` ${p} `));
}

/** French numbers (06 12 34 56 78, +33 6 12 34 56 78) and any international number with a +. */
const PHONE_FR = /(?:\+33|0033|\b0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/;
const PHONE_INTL = /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,5}/;
/** Nine or more digits in a row, with or without spaces, read as a phone number too. */
const LONG_DIGITS = /\b\d(?:[\s.-]?\d){8,}\b/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** Street words that rarely follow a plain number otherwise; "place" needs its "de" ("12 place de la Mairie"). */
const STREET_WORDS = "rue|avenue|av|boulevard|bd|blvd|chemin|allee|impasse|quai|street|road|calle|avenida|viale|piazza|rua|travessa|strasse|gasse|platz|place (?:de|du|des|d')";
const ADDRESS_NUMBER_FIRST = new RegExp(String.raw`\b\d{1,4}\s?(?:bis|ter|[a-c])?,?\s+(?:${STREET_WORDS})\b\.?\s*\S`, "i");
const ADDRESS_GERMAN = /\b[a-z]+(?:strasse|str\.|gasse|platz|weg)\s+\d{1,4}\b/i;

/** Accents off, ß spelled out, case kept: the name rules need the capitals. */
const plainOf = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");

export function hasPersonalData(text: string): boolean {
  const plain = plainOf(text);
  return [PHONE_FR, PHONE_INTL, LONG_DIGITS, EMAIL, ADDRESS_NUMBER_FIRST, ADDRESS_GERMAN].some((re) => re.test(plain));
}

/** Staff roles a name could follow ("the bartender Kevin", "la serveuse Julie"). DJs are left out: they perform under a stage name. */
const ROLES =
  "bartender|barman|barmaid|barmen|waiter|waitress|server|bouncer|doorman|doorwoman|manager|owner|boss|cashier|security|guard|host|hostess|staff|chef|cook|" +
  "serveur|serveuse|videur|videuse|vigile|physio|patron|patronne|gerant|gerante|caissier|caissiere|responsable|cuisinier|cuisiniere|proprio|hotesse|" +
  "camarero|camarera|portero|cajero|cajera|cameriere|cameriera|buttafuori|cassiere|cassiera|kellner|kellnerin|turseher|tursteher|wirt|wirtin|" +
  "garcom|garconete|seguranca|porteiro|gerente";
const ROLE_THEN_NAME = new RegExp(`\\b(?:${ROLES})\\s+(?:(?:named|called|nomme|nommee|appele|appelee|qui s'appelle|llamado|llamada|chiamato|chiamata|namens|chamado|chamada)\\s+)?([A-Z][a-z]+)\\b`);
/** "Julie at the bar", "Karim au bar", "Lea a l'entree". */
const NAME_AT_PLACE =
  /\b([A-Z][a-z]{2,})\s+(?:at the|behind the|on the|from the|au|a la|a l'|derriere le|du|de la|en la|al|alla|dietro il|an der|am|hinter der|no|na)\s*(?:bar|door|entrance|counter|till|cloakroom|desk|comptoir|entree|porte|caisse|vestiaire|barra|puerta|entrada|banco|ingresso|porta|cassa|theke|tur|eingang|kasse|balcao)\b/;
const TITLE_THEN_NAME = /(?:^|[\s(])(?:Mr|Mrs|Ms|Miss|M\.|Mme|Mlle|Monsieur|Madame|Mademoiselle|Sr|Sra|Senor|Senora|Sig|Signor|Signora|Herr|Frau)\.?\s+[A-Z][a-z]+/;
const HANDLE = /(?:^|[\s(])@[A-Za-z0-9_.]{2,}/;
/** Capitalised words that start sentences far more often than they name anyone. */
const NOT_NAMES = new Set([
  "the", "drinks", "drink", "prices", "price", "service", "music", "staff", "people", "everyone", "nobody", "food", "beer", "beers", "cocktails",
  "queue", "wait", "great", "good", "nice", "bad", "very", "really", "always", "never", "sometimes", "ambiance", "musique", "prix", "bieres",
  "biere", "boissons", "attente", "accueil", "tout", "toujours", "jamais", "super", "tres", "vraiment", "les", "le", "la", "des", "une", "un",
  "cocktail", "pintes", "pinte", "ambiente", "precios", "servicio", "musica", "prezzi", "servizio", "getranke", "preise", "musik", "bebidas",
  "precos", "servico", "seats", "tables", "table", "places", "space", "room", "queueing", "personnel", "equipe", "team", "everything", "nothing",
  "something", "waiting", "ordering", "paying", "payment", "sitting", "standing", "dancing", "shots", "wine", "glasses", "rien", "commander",
  "attendre", "personne", "ici", "here", "there", "also", "aussi", "and", "but", "mais", "et", "ok", "okay", "fun", "cool", "top",
]);

export function namesPerson(text: string): boolean {
  const plain = plainOf(text);
  if (HANDLE.test(plain) || TITLE_THEN_NAME.test(plain)) return true;
  const role = new RegExp(ROLE_THEN_NAME.source, "gi");
  for (const match of plain.matchAll(role)) {
    const name = match[1]!;
    // The role word matches in any case; the name must be capitalised as written.
    if (/^[A-Z]/.test(name) && !NOT_NAMES.has(name.toLowerCase())) return true;
  }
  for (const match of plain.matchAll(new RegExp(NAME_AT_PLACE.source, "g"))) if (!NOT_NAMES.has(match[1]!.toLowerCase())) return true;
  return false;
}

/** The first rule the text breaks, or null. */
export function checkText(text: string, options: { names?: boolean } = {}): FilterCode | null {
  if (!text.trim()) return null;
  if (isAbusive(text)) return "text_abusive";
  if (hasPersonalData(text)) return "text_personal_data";
  if (options.names && namesPerson(text)) return "text_names_person";
  return null;
}

/** Throws the filter's code as a 422, for routes that store text others will read. */
export function assertCleanText(text: string | null | undefined, options: { names?: boolean } = {}): void {
  if (!text) return;
  const code = checkText(text, options);
  if (code) throw new HttpError(422, code);
}
