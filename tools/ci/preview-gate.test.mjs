import {expect,it} from "vitest";
import {previewOrigin,verifyPreview} from "./preview-gate.mjs";
it("requires distinct HTTPS PR origins",()=>{
 expect(previewOrigin("https://pr-{pr}.example.com",42)).toBe("https://pr-42.example.com");
 expect(()=>previewOrigin("https://example.com",42)).toThrow();
 expect(()=>previewOrigin("http://pr-{pr}.example.com",42)).toThrow();
});
it("requires readiness and the exact deployed commit",async()=>{
 const options={template:"https://pr-{pr}.example.com",pr:42,sha:"abc",fetcher:async url=>({ok:true,json:async()=>url.endsWith("/ready")?{ok:true}:{sourceCommit:"abc"}})};
 await expect(verifyPreview(options)).resolves.toBe("https://pr-42.example.com");
 await expect(verifyPreview({...options,sha:"different"})).rejects.toThrow("commit");
});
