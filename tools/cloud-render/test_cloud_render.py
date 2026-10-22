"""Standard-library smoke tests for the cloud-render supervisor (no Blender required)."""
import json
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cloud_render as cr  # noqa: E402


class CloudRenderTests(unittest.TestCase):
    def test_clip_catalog_and_families(self):
        clips = cr.clips()
        self.assertIn("idle", clips)
        self.assertIn("crouch_fire_heavy", clips)
        self.assertEqual(len(clips), len(set(clips)))
        self.assertEqual(len(cr.FAMILIES), 32)
        self.assertEqual(len(cr.FAMILIES), len(set(cr.FAMILIES)))

    def test_crew_progress_parsing(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "crew_idle.log"
            log.write_text("CREW scene 0.4s; 1000 entries, 200 cache hits, 800 misses\n"
                           "  rendered 400/800\n")
            with patch.object(cr, "LOG_DIR", Path(tmp)):
                self.assertEqual(cr.job_detail("crew:idle"), "600/1000 frames (60%)")

    def test_family_progress_parsing(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "family_env.log"
            log.write_text("FAMILY_PROGRESS env 10 40\nFAMILY_PROGRESS env 20 40\n")
            with patch.object(cr, "LOG_DIR", Path(tmp)):
                self.assertEqual(cr.job_detail("family:env"), "20/40 jobs (50%)")

    def test_resume_and_source_invalidation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state = root / "state.json"
            logs = root / "logs"
            output = root / "public/assets"
            args = SimpleNamespace(scale=2, fresh=False, workers=2, threads=2)
            with patch.object(cr, "STATE_DIR", root), patch.object(cr, "STATE_FILE", state), \
                 patch.object(cr, "LOG_DIR", logs), patch.object(cr, "OUT", output), \
                 patch.object(cr, "source_key", return_value="A"), \
                 patch.dict(os.environ, {"BLENDER_BIN": sys.executable}):
                runner = cr.Runner(args)
                runner.mark("crew:idle", "done")
                resumed = cr.Runner(args)
                self.assertTrue(resumed.done("crew:idle"))
            with patch.object(cr, "STATE_DIR", root), patch.object(cr, "STATE_FILE", state), \
                 patch.object(cr, "LOG_DIR", logs), patch.object(cr, "OUT", output), \
                 patch.object(cr, "source_key", return_value="B"), \
                 patch.dict(os.environ, {"BLENDER_BIN": sys.executable}):
                changed = cr.Runner(args)
                self.assertFalse(changed.done("crew:idle"))
            self.assertEqual(json.loads(state.read_text())["signature"], "B")


    def test_asset_inventory_integrity(self):
        script = Path(__file__).resolve().with_name("verify_assets.py")
        spec = importlib.util.spec_from_file_location("cloud_asset_verify", script)
        verify_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verify_module)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            assets = root / "assets"
            (assets / "sprites").mkdir(parents=True)
            (assets / "sprites" / "test.png").write_bytes(b"test sprite")
            manifest = {
                "tile": {"w": 128, "h": 64},
                "sheets": {"test": {"image": "sprites/test.png"}},
                "assets": {}
            }
            (assets / "manifest.json").write_text(json.dumps(manifest))
            self.assertEqual(verify_module.verify(assets), ["manifest.json", "sprites/test.png"])
            first = verify_module.digest(assets / "sprites/test.png")
            (assets / "sprites" / "test.png").write_bytes(b"corrupted")
            self.assertNotEqual(first, verify_module.digest(assets / "sprites/test.png"))
            manifest["sheets"]["test"]["image"] = "../outside.png"
            (assets / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                verify_module.verify(assets)

    def test_complete_state_required_for_final_transfer(self):
        script = Path(__file__).resolve().with_name("verify_assets.py")
        spec = importlib.util.spec_from_file_location("cloud_asset_verify", script)
        verify_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verify_module)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            assets = root / "assets"
            assets.mkdir()
            (assets / "manifest.json").write_text(json.dumps({
                "tile": {"w": 128, "h": 64}, "sheets": {}, "assets": {}
            }))
            state = root / "state.json"
            state.write_text(json.dumps({"jobs": {}}))
            with self.assertRaisesRegex(ValueError, "Incomplete render jobs"):
                verify_module.verify(assets, True, state)


if __name__ == "__main__":
    unittest.main()
