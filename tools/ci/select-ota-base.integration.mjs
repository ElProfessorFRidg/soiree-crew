import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { completeIpa, ipaCandidates, latestIpaTag } from "./select-ota-base.mjs";
const names = ["soiree-crew-unsigned.ipa", "soiree-crew-ipad-unsigned.ipa", "ios-build-info-iphone.json", "ios-build-info-ipad.json"];
const release = (build, pr = "", changes = {}) => ({ tag_name: `v0.2.${build}${pr ? `-preview.${pr}` : ""}+build.${build}`, draft: false, prerelease: Boolean(pr), assets: names.map(name => ({name, state:"uploaded",size:100})), ...changes });
const select = new URL("./select-ota-base.mjs",import.meta.url);

test("selects numeric build order, independent of input order", () => {
  assert.deepEqual(ipaCandidates([release(9),release(100),release(20)]), [release(100).tag_name,release(20).tag_name,release(9).tag_name]);
});
test("PR history is strictly isolated; public and OTA notes are excluded", () => {
  const rows = [release(10,"42"),release(11,"41"),release(12),release(13,"42"),{tag_name:"ota-v0.2.13-preview.42+build.13-iphone-1.1",prerelease:true,draft:false}];
  assert.deepEqual(ipaCandidates(rows,"42"),[release(13,"42").tag_name,release(10,"42").tag_name]);
  assert.equal(latestIpaTag(rows),release(12).tag_name);
  assert.equal(latestIpaTag(rows,"43"),"");
});
test("requires both IPA binaries and both complete uploaded metadata assets", () => {
  for (const name of names) {
    const missing = release(1); missing.assets = missing.assets.filter(a=>a.name!==name);
    assert.equal(completeIpa(missing),false);
  }
  for (const changes of [{size:0},{size:-1},{size:"100"},{state:"starter"}]) {
    const invalid=release(1);Object.assign(invalid.assets[0],changes);assert.equal(completeIpa(invalid),false);
  }
  const dup=release(1);dup.assets.push({...dup.assets[0]});assert.equal(completeIpa(dup),false);
});
test("latest incomplete release fails closed instead of targeting an older IPA", () => {
  assert.throws(()=>ipaCandidates([release(5),release(6,"",{assets:[]})]),/Latest IPA release incomplete/);
});
test("incomplete historical releases are excluded, drafts ignored", () => {
  assert.deepEqual(ipaCandidates([release(5),release(4,"",{assets:[]}),release(6,"",{draft:true})]),[release(5).tag_name]);
});
test("duplicate preview runtime across PRs cannot be selected", () => {
  assert.throws(()=>ipaCandidates([release(5,"41"),release(5,"42")],"42"),/Ambiguous IPA runtime/);
  assert.throws(()=>ipaCandidates([release(5,"41"),release(5,"42")],"41"),/Ambiguous IPA runtime/);
  assert.deepEqual(ipaCandidates([release(5,"41"),release(5)],"41"),[release(5,"41").tag_name]);
});
test("rejects duplicate public runtimes, malformed responses and inconsistent flags", () => {
  assert.throws(()=>ipaCandidates([release(5),release(5,"",{tag_name:"v0.3.5+build.5"})]),/Ambiguous IPA runtime/);
  assert.throws(()=>ipaCandidates({}),/Invalid releases response/);
  assert.throws(()=>ipaCandidates([release(1,"",{prerelease:true})]),/Invalid release flags/);
  assert.throws(()=>ipaCandidates([release(1)],"0"),/Invalid preview PR/);
});
test("pagination duplicates deduplicate; conflicting availability fails", () => {
  assert.deepEqual(ipaCandidates([release(5),release(5)]),[release(5).tag_name]);
  assert.throws(()=>ipaCandidates([release(5),release(5,"",{assets:[]})]),/Conflicting release entries/);
});
test("CLI emits exact candidates, empty selection or nonzero infrastructure failure", () => {
  const run=(rows,env={})=>spawnSync(process.execPath,[select.pathname],{input:JSON.stringify(rows),encoding:"utf8",env:{...process.env,PR_NUMBER:"",ALL_CANDIDATES:"",...env}});
  assert.equal(run([release(2),release(1)],{ALL_CANDIDATES:"1"}).stdout.trim(),`${release(2).tag_name}\n${release(1).tag_name}`);
  assert.equal(run([release(2,"41")],{PR_NUMBER:"42"}).stdout.trim(),"");
  const bad=run([release(2,"",{assets:[]})]);assert.equal(bad.status,1);assert.match(bad.stderr,/Latest IPA release incomplete/);
});
