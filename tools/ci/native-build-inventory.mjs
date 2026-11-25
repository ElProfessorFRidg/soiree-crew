// Record the installed native project and its actual linked modules at build time.
// This is an audit fingerprint, not a substitute for compatibility checks on old IPAs.
import {createHash} from "node:crypto";
import {readdirSync,readFileSync,statSync} from "node:fs";
import {join,relative} from "node:path";
import {execFileSync} from "node:child_process";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const root=process.argv[2];
if (!root) throw Error("Expected generated iOS directory");
const files=[];
function walk(dir) {
 for (const e of readdirSync(dir,{withFileTypes:true})) {
  if (["build",".git","Pods","xcuserdata"].includes(e.name)) continue;
  const path=join(dir,e.name);
  if(e.isDirectory()) walk(path);
  else if(e.isFile()) files.push([relative(root,path),hash(readFileSync(path))]);
 }
}
walk(root);
files.sort((a,b)=>a[0].localeCompare(b[0]));
const lock=files.find(([name])=>name==="Podfile.lock");
if(!lock) throw Error("Missing resolved CocoaPods lock");
const pods=readFileSync(join(root,"Podfile.lock"),"utf8");
const capabilities=[...new Set(pods.split("\n").filter(l=>/^  - [^ ]/.test(l)).map(l=>l.trim().slice(2).split(/[ (:/]/)[0]))].sort();
const xcode=execFileSync("xcodebuild",["-version"],{encoding:"utf8"}).trim();
console.log(JSON.stringify({schema:1,projectHash:hash(JSON.stringify(files)),podLockHash:lock[1],capabilities,files,xcode}));
