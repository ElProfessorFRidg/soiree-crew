import {expect,it} from "vitest";
import {addedNativeImports} from "./native-imports.mjs";
it("detects newly introduced native imports",()=>expect(addedNativeImports("import {x} from 'expo-camera'","import {x} from 'expo-camera'; import('expo-location'); require('react-native-svg')")).toEqual(["expo-location","react-native-svg"]));
it("ignores pure JS imports",()=>expect(addedNativeImports("","import {x} from 'zustand'")).toEqual([]));
