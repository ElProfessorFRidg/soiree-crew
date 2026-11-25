import {previewOrigin} from "./preview-gate.mjs";
import {appendFileSync} from "node:fs";
const pr=process.env.PREVIEW_PR;
const template=process.env.CREW_PREVIEW_URL_TEMPLATE;
if(pr && template){
 const origin=previewOrigin(template,pr);
 appendFileSync(process.env.GITHUB_ENV,`CREW_SERVER_URL=${origin}\n`);
}
