import { expect, it } from "vitest";
import { staleCacheIds } from "./prune-build-caches.mjs";
it("keeps two newest per cache family and never touches PR or unrelated caches",()=>{
  const c=(id,key,ref="refs/heads/main")=>({id,key,ref,created_at:new Date(id*1000).toISOString()});
  expect(staleCacheIds([
    c(1,"ios-build-xcode26.6-abcd-iphone-1"),c(2,"ios-build-v2-xcode26.6-iphone-abcd-2"),c(3,"ios-build-v2-xcode26.6-iphone-efgh-3"),
    c(4,"ios-build-v2-xcode26.6-ipad-abcd-4"),c(5,"ios-build-v2-xcode26.6-iphone-abcd-5","refs/pull/44/merge"),
    c(6,"unrelated"),c(7,"expo-modules-jsi-v2-xcode26.6-ipad-a"),c(8,"expo-modules-jsi-v2-xcode26.6-ipad-b"),c(9,"expo-modules-jsi-v2-xcode26.6-ipad-c"),
    c(10,"pnpm-store-v2-Linux-X64-a"),c(11,"pnpm-store-v2-Linux-X64-b"),c(12,"pnpm-store-v2-Linux-X64-c")
  ]).sort((a,b)=>a-b)).toEqual([1,7,10]);
});
