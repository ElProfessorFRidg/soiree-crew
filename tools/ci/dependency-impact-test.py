import copy
import runpy
import unittest
from pathlib import Path
m = runpy.run_path(str(Path(__file__).with_name("dependency-impact.py")))
classify, root_test_only = m["classify"], m["root_test_only"]

def fixture():
    return {
        "lockfileVersion": "9.0",
        "settings": {"autoInstallPeers": True},
        "importers": {
            "apps/mobile": {"dependencies": {"zustand": {"version": "1"}, "@crew/fuzzy": {"version": "link:../../packages/fuzzy"}}},
            "packages/fuzzy": {"dependencies": {"double-metaphone": {"version": "1"}}},
            "apps/server": {"dependencies": {"fastify": {"version": "1"}}},
        },
        "packages": {"zustand@1": {}, "double-metaphone@1": {}, "fastify@1": {}},
        "snapshots": {"zustand@1": {}, "double-metaphone@1": {}, "fastify@1": {}},
    }

def bump(lock, importer, name):
    lock["importers"][importer]["dependencies"][name]["version"] = "2"
    lock["packages"][name+"@2"] = {}
    lock["snapshots"][name+"@2"] = {}

class ImpactTests(unittest.TestCase):
    def test_server_resolution(self):
        a = fixture(); b = copy.deepcopy(a); bump(b,"apps/server","fastify")
        self.assertEqual(classify(a,b),"checks")
    def test_mobile_js(self):
        a = fixture(); b = copy.deepcopy(a); bump(b,"apps/mobile","zustand")
        self.assertEqual(classify(a,b),"ota")
    def test_workspace_js(self):
        a = fixture(); b = copy.deepcopy(a); bump(b,"packages/fuzzy","double-metaphone")
        self.assertEqual(classify(a,b),"ota")
    def test_unknown_transitive(self):
        a = fixture(); b = copy.deepcopy(a)
        b["snapshots"]["zustand@1"]["dependencies"] = {"native-module":"1"}
        b["snapshots"]["native-module@1"] = {}; b["packages"]["native-module@1"] = {}
        self.assertEqual(classify(a,b),"ipa")
    def test_global_settings(self):
        a = fixture(); b = copy.deepcopy(a); b["settings"]["autoInstallPeers"] = False
        self.assertEqual(classify(a,b),"ipa")
    def test_native_change(self):
        a = fixture(); b = copy.deepcopy(a)
        b["importers"]["apps/mobile"]["dependencies"]["expo"] = {"version":"1"}
        b["packages"]["expo@1"] = {}; b["snapshots"]["expo@1"] = {}
        self.assertEqual(classify(a,b),"ipa")
    def test_root_dev(self):
        self.assertTrue(root_test_only('{"devDependencies":{"vitest":"1"}}','{"devDependencies":{"vitest":"2"}}'))
        self.assertFalse(root_test_only('{"devDependencies":{"typescript":"1"}}','{"devDependencies":{"typescript":"2"}}'))

if __name__ == "__main__":
    unittest.main()
