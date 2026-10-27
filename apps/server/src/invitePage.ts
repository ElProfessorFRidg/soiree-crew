/**
 * N-30, QOL-05: the page an invite link opens in a browser. Its copy lives here,
 * in both languages, like the app's catalogues; the language follows the browser.
 */
const copy = {
  fr: {
    title: (crew: string) => `Rejoins ${crew} sur Soirée Crew`,
    members: (n: number) => (n === 1 ? "1 membre" : `${n} membres`),
    open: "Ouvrir dans l'app",
    code: "Ou tape ce code dans l'onglet Crew :",
    noApp: "Pas encore l'app ? Demande le lien d'installation à ton crew.",
    expired: "Cette invitation n'existe plus. Demande un nouveau lien.",
  },
  en: {
    title: (crew: string) => `Join ${crew} on Soirée Crew`,
    members: (n: number) => (n === 1 ? "1 member" : `${n} members`),
    open: "Open in the app",
    code: "Or type this code in the Crew tab:",
    noApp: "No app yet? Ask your crew for the install link.",
    expired: "This invite is gone. Ask for a new link.",
  },
};

export type InviteLanguage = keyof typeof copy;

export function pickLanguage(acceptLanguage: string | undefined): InviteLanguage {
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("fr") ? "fr" : "en";
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(language: InviteLanguage, title: string, body: string): string {
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #1E2624; color: #F1EEE6; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 360px; padding: 24px; display: grid; gap: 14px; }
  h1 { font-size: 26px; line-height: 1.15; margin: 0; }
  a.button { display: block; text-align: center; padding: 16px; border-radius: 14px; background: #F2B33D; color: #1E2624; font-weight: 700; text-decoration: none; }
  code { font-size: 24px; letter-spacing: 3px; font-weight: 700; }
  p { margin: 0; color: #B8B2A6; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

export function invitePage(
  language: InviteLanguage,
  invite: { code: string; crewName: string; members: number; serverUrl: string } | null,
): string {
  const t = copy[language];
  if (!invite) return page(language, t.expired, `<h1>${escape(t.expired)}</h1>`);
  const deepLink = `soireecrew://join?code=${encodeURIComponent(invite.code)}&server=${encodeURIComponent(invite.serverUrl)}`;
  const title = t.title(invite.crewName);
  return page(
    language,
    title,
    `<h1>${escape(title)}</h1>
<p>${escape(t.members(invite.members))}</p>
<a class="button" href="${escape(deepLink)}">${escape(t.open)}</a>
<p>${escape(t.code)}</p>
<code>${escape(invite.code)}</code>
<p>${escape(t.noApp)}</p>`,
  );
}
