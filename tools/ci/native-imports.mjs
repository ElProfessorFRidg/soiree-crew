import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";
// Inventory is deliberately conservative: new native imports trigger a rebuild unless
// the exact import was present at the baseline. This does not attempt to infer JS semantics.
const native = /^(?:expo(?:-|$)|react-native(?:-|$)|@react-native|@expo\/ui|@\/.*native)/;
export function imports(source) {
 const names=new Set();
 for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g)) if(native.test(m[1])) names.add(m[1]);
 return [...names].sort();
}
export function addedNativeImports(before,after) {
 const old=new Set(imports(before));return imports(after).filter(x=>!old.has(x));
}
