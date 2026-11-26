import { expect, it } from "vitest";
import { releasePlan, retrying, reconcileRelease, retryableReleaseError } from "./publish-release.mjs";

const base = { version: "0.2.5", build: 115, sha: "a".repeat(40) };
it("publishes previews under immutable tags without moving public latest or consuming a public patch", () => {
  const plan = releasePlan({ ...base, channel: "preview", pr: 4 });
  expect(plan.tag).toBe("v0.2.5-preview.4+build.115");
  expect(plan.flags).toEqual(["--prerelease", "--latest=false"]);
});
it("keeps the public tag scheme and latest link", () => {
  expect(releasePlan({ ...base, channel: "public" })).toMatchObject({ tag: "v0.2.5+build.115", flags: ["--latest=true"] });
});
it("refuses missing PR identity, unknown channels and non-version strings before publishing", () => {
  expect(() => releasePlan({ ...base, channel: "preview" })).toThrow();
  expect(() => releasePlan({ ...base, channel: "beta" })).toThrow();
  expect(() => releasePlan({ ...base, version: "latest", channel: "public" })).toThrow();
});
it("retries a step that GitHub answered with a 5xx, then gives up after the last attempt", () => {
  const waits = [];
  let calls = 0;
  const flaky = () => {
    if (++calls < 3) throw new Error("HTTP 500");
    return "done";
  };
  expect(retrying(flaky, { sleep: (ms) => waits.push(ms) })).toBe("done");
  expect(calls).toBe(3);
  expect(waits).toEqual([5000, 15000]);
  expect(() => retrying(() => { throw new Error("HTTP 500"); }, { attempts: 2, sleep: () => undefined })).toThrow("HTTP 500");
});

const plan = {"tag":"v0.2.5-preview.4+build.115","sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","preview":true};
const payload = [{"name":"a.ipa","path":"dist/a.ipa","size":10,"digest":"sha256:a"},{"name":"b.json","path":"dist/b.json","size":3,"digest":"sha256:b"}];
const uploaded = f => ({name:f.name,size:f.size,digest:f.digest,state:"uploaded"});
function fakeRelease({ draft = true, initial = [], existing = true } = {}) {
  const state = {release: existing ? {id:1,tag_name:plan.tag,target_commitish:plan.sha,prerelease:true,draft} : null, assets:[...initial], uploads:[], deletes:[], publications:0};
  const api = {
    find:()=>state.release,
    createDraft:()=>state.release={id:1,tag_name:plan.tag,target_commitish:plan.sha,prerelease:true,draft:true},
    verifyTag:()=>{},
    assets:()=>[...state.assets],
    removeIncomplete:id=>{state.deletes.push(id);state.assets=state.assets.filter(a=>a.id!==id);},
    upload:(_id,f)=>{state.uploads.push(f.name);state.assets.push(uploaded(f));},
    publish:()=>{state.publications++;state.release.draft=false;return state.release;},
  };
  return {api,state};
}
it("creates a draft, uploads both files, then publishes", ()=>{
  const {api,state}=fakeRelease({existing:false});
  expect(reconcileRelease(api,plan,payload).draft).toBe(false);
  expect(state.uploads).toEqual(["a.ipa","b.json"]);expect(state.publications).toBe(1);
});
it("resumes a draft without replacing its verified assets", ()=>{
  const {api,state}=fakeRelease({initial:[uploaded(payload[0])]});
  reconcileRelease(api,plan,payload);
  expect(state.uploads).toEqual(["b.json"]);expect(state.deletes).toEqual([]);
});
it("does not modify a complete published release", ()=>{
  const {api,state}=fakeRelease({draft:false,initial:payload.map(uploaded)});
  reconcileRelease(api,plan,payload);
  expect(state.uploads).toEqual([]);expect(state.publications).toBe(0);
});
it("rejects an incomplete published release", ()=>{
  const {api,state}=fakeRelease({draft:false,initial:[uploaded(payload[0])]});
  expect(()=>reconcileRelease(api,plan,payload)).toThrow("incomplete");expect(state.uploads).toEqual([]);
});
it("refuses corrupted or unexpected assets and wrong release identity", ()=>{
  for(const initial of [[{...uploaded(payload[0]),digest:"sha256:wrong"}],[{...uploaded(payload[0]),name:"other"}],[uploaded(payload[0]),uploaded(payload[0])]]){
    const {api,state}=fakeRelease({initial});expect(()=>reconcileRelease(api,plan,payload)).toThrow();expect(state.uploads).toEqual([]);expect(state.deletes).toEqual([]);
  }
  const {api,state}=fakeRelease();state.release.target_commitish="b".repeat(40);
  expect(()=>reconcileRelease(api,plan,payload)).toThrow("identity");
});
it("only deletes an incomplete starter asset from a draft", ()=>{
  const {api,state}=fakeRelease({initial:[{id:42,name:"a.ipa",state:"starter",size:0,digest:null},uploaded(payload[1])]});
  reconcileRelease(api,plan,payload);expect(state.deletes).toEqual([42]);expect(state.uploads).toEqual(["a.ipa"]);
});
it("recovers an interrupted upload without clobbering, then confirms publication", ()=>{
  const {api,state}=fakeRelease();const upload=api.upload;let failed=false;
  api.upload=(id,f)=>{upload(id,f);if(!failed){failed=true;throw new Error("HTTP 502");}};
  retrying(()=>reconcileRelease(api,plan,payload),{sleep:()=>{},shouldRetry:retryableReleaseError});
  expect(state.uploads).toEqual(["a.ipa","b.json"]);expect(state.publications).toBe(1);
});
it("handles a lost publication response without publishing again", ()=>{
  const {api,state}=fakeRelease();const publish=api.publish;
  api.publish=id=>{publish(id);throw new Error("HTTP 503");};
  retrying(()=>reconcileRelease(api,plan,payload),{sleep:()=>{},shouldRetry:retryableReleaseError});
  expect(state.publications).toBe(1);expect(state.uploads).toEqual(["a.ipa","b.json"]);
});
it("does not retry authentication or integrity failures", ()=>{
  expect(retryableReleaseError(new Error("HTTP 401"))).toBe(false);
  expect(retryableReleaseError(new Error("HTTP 403"))).toBe(false);
  expect(retryableReleaseError(new Error("Release asset mismatch"))).toBe(false);
  expect(retryableReleaseError(new Error("HTTP 429"))).toBe(true);
  expect(retryableReleaseError(new Error("HTTP 422: already exists"))).toBe(true);
  expect(retryableReleaseError(new Error("HTTP 422: invalid"))).toBe(false);
});
