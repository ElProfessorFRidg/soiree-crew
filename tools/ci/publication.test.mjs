import {it,expect} from "vitest";
import {serialize,contentIdentity,older,sequenceOf} from "../../deploy/ota/publication.mjs";
it("serializes writes to one runtime",async()=>{
 const order=[];
 await Promise.all([serialize("a",async()=>{order.push(1);await Promise.resolve();order.push(2)}),serialize("a",async()=>order.push(3))]);
 expect(order).toEqual([1,2,3]);
});
it("releases lock after failure",async()=>{
 await expect(serialize("x",()=>{throw Error("failed")})).rejects.toThrow();
 await expect(serialize("x",()=>42)).resolves.toBe(42);
});
it("ignores only publication identity and timestamp",()=>{
 expect(contentIdentity({id:"a",createdAt:"x",extra:{b:1,a:2}})).toBe(contentIdentity({id:"b",createdAt:"y",extra:{a:2,b:1}}));
 expect(contentIdentity({extra:{a:1}})).not.toBe(contentIdentity({extra:{a:2}}));
});
it("rejects invalid sequence and compares retries",()=>{
 expect(()=>sequenceOf({sequence:"bad"})).toThrow();
 expect(older("100.2","101.1")).toBe(true);
 expect(older("100.2","100.1")).toBe(false);
});
