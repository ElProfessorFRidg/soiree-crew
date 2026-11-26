import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { IPA_ASSETS, verifyRelease, verifyAsset, verifyGate } from "./delivery-integrity.mjs";
const tag = "v0.2.44-preview.42+build.348";
const digest = data => "sha256:" + createHash("sha256").update(data).digest("hex");
const fixture = () => ({tag_name:tag,draft:false,prerelease:true,assets:IPA_ASSETS.map(name=>({name,state:"uploaded",size:4,digest:digest("test")}))});
const options = {tag,preview:true};
const gate = {route:"ipa",checks:"success",version:"success",ota:"skipped",ios:"success",launch:"success",release:"success",publicationRequired:true,android:"skipped",androidRequired:false};
const cli = new URL("./delivery-integrity.mjs",import.meta.url).pathname;
test("checks GitHub REST release identity and all four uploaded assets",()=>{
  verifyRelease(fixture(),options);
  for(const k of ["tag_name","draft","prerelease"]) {const r=fixture();r[k]=null;assert.throws(()=>verifyRelease(r,options));}
  for(const name of IPA_ASSETS) {const r=fixture();r.assets=r.assets.filter(a=>a.name!==name);assert.throws(()=>verifyRelease(r,options),/asset/);}
});
test("rejects missing digest, duplicate, unfinished and empty assets",()=>{
  for(const change of [{digest:null},{digest:"md5:abcd"},{state:"starter"},{size:0},{size:"4"}]) {const r=fixture();Object.assign(r.assets[0],change);assert.throws(()=>verifyRelease(r,options));}
  const r=fixture();r.assets.push({...r.assets[0]});assert.throws(()=>verifyRelease(r,options));
});
test("verifies real file bytes, including tampering that preserves size",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"crew-integrity-"));t.after(()=>rm(dir,{recursive:true,force:true}));
  const path=join(dir,IPA_ASSETS[0]);await writeFile(path,"test");await verifyAsset(fixture(),path);
  await writeFile(path,"evil");await assert.rejects(verifyAsset(fixture(),path),/digest mismatch/);
  await writeFile(path,"longer");await assert.rejects(verifyAsset(fixture(),path),/size mismatch/);
});
test("CLI checks actual on-disk release JSON and files",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"crew-integrity-cli-"));t.after(()=>rm(dir,{recursive:true,force:true}));
  const meta=join(dir,"release.json"),path=join(dir,IPA_ASSETS[2]);await writeFile(meta,JSON.stringify(fixture()));await writeFile(path,"test");
  const run=()=>spawnSync(process.execPath,[cli,"assets",meta,tag,path],{encoding:"utf8",env:{...process.env,RELEASE_DRAFT:"false"}});
  assert.equal(run().status,0);await writeFile(path,"evil");const bad=run();assert.equal(bad.status,1);assert.match(bad.stderr,/digest mismatch/);
});
test("native gate requires successful publication for repository-owned builds",()=>{
  verifyGate(gate);
  for(const status of ["skipped","cancelled","failure",""]) assert.throws(()=>verifyGate({...gate,release:status}),/publication/);
  verifyGate({...gate,publicationRequired:false,release:"skipped"});
  assert.throws(()=>verifyGate({...gate,publicationRequired:false}),/publication/);
});
test("OTA and checks-only cannot hide failed or unexpected jobs",()=>{
  const ota={...gate,route:"ota",ota:"success",ios:"skipped",launch:"skipped",release:"skipped"};verifyGate(ota);
  assert.throws(()=>verifyGate({...ota,ota:"failure"}));assert.throws(()=>verifyGate({...ota,release:"success"}));
  const checks={...ota,route:"checks",ota:"skipped"};verifyGate(checks);assert.throws(()=>verifyGate({...checks,ota:"cancelled"}));assert.throws(()=>verifyGate({...checks,ios:"success"}));
});
test("failed checks, cancelled launches and unknown routes fail closed",()=>{
  for(const change of [{checks:"failure"},{version:"cancelled"},{launch:"cancelled"},{route:"mixed"},{route:""}])assert.throws(()=>verifyGate({...gate,...change}));
});
test("requested Android build must succeed; unexpected build cannot pass",()=>{
  verifyGate({...gate,android:"success",androidRequired:true});assert.throws(()=>verifyGate({...gate,androidRequired:true}));assert.throws(()=>verifyGate({...gate,android:"success"}));
});
test("gate CLI returns nonzero for a missing publication",()=>{
  const env={...process.env,ROUTE:"ipa",CHECKS:"success",VERSION:"success",OTA:"skipped",IOS:"success",LAUNCH:"success",RELEASE:"skipped",PUBLICATION_REQUIRED:"true",ANDROID:"skipped",ANDROID_REQUIRED:"false"};
  assert.equal(spawnSync(process.execPath,[cli,"gate"],{env}).status,1);assert.equal(spawnSync(process.execPath,[cli,"gate"],{env:{...env,RELEASE:"success"}}).status,0);
});
