import { pathToFileURL } from "node:url";
export function previewOrigin(template, pr) {
  if (!/^[1-9]\d*$/.test(String(pr)) || !template.includes("{pr}")) throw new Error("Missing per-PR preview URL template");
  const url = new URL(template.replaceAll("{pr}",String(pr)));
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Preview URL must be an HTTPS origin");
  return url.origin;
}
export async function verifyPreview({ template, pr, sha, fetcher = fetch }) {
  const origin = previewOrigin(template,pr);
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Missing exact expected preview commit");
  for (const path of ["/v1/ready","/v1/info"]) {
    const res = await fetcher(origin+path,{redirect:"error",signal:AbortSignal.timeout(10000)});
    if (!res.ok) throw new Error("Preview not ready: "+path);
    const data = await res.json();
    if (path === "/v1/ready") {
      if (data.ok !== true) throw new Error("Preview database not ready");
      if (data.sourceCommit !== sha) throw new Error("Preview commit does not match the OTA commit");
    }
  }
  return origin;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { CREW_PREVIEW_URL_TEMPLATE:template, PREVIEW_PR:pr, PREVIEW_SHA:sha } = process.env;
  if (!template) {
    console.log("::notice::Per-PR preview verification not configured; no preview availability claim.");
  } else {
    let last;
    for (let n=0;n<12;n++) {
      try { console.log(await verifyPreview({template,pr,sha})); last=null; break; }
      catch(e) { last=e; if(n<11) await new Promise(r=>setTimeout(r,10000)); }
    }
    if(last) throw last;
  }
}
