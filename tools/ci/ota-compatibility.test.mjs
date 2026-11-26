import { expect,it } from "vitest";
import { summarizeCompatibility } from "./ota-compatibility.mjs";
it("reports gaps, does not imply interval compatibility",()=>{
 const r=summarizeCompatibility([310,315].map(build=>({release:`v0.2.${build}+build.${build}`,target:"iphone"})));
 expect(r["public/iphone"].minBuild).toBe(310);
 expect(r["public/iphone"].maxBuild).toBe(315);
 expect(r["public/iphone"].exact.map(x=>x.build)).toEqual([310,315]);
});
it("isolates preview PRs and targets",()=>{
 const r=summarizeCompatibility([{release:"v0.2.1-preview.42+build.1",target:"iphone"},{release:"v0.2.1-preview.43+build.1",target:"ipad"}]);
 expect(Object.keys(r)).toEqual(["preview.42/iphone","preview.43/ipad"]);
});
