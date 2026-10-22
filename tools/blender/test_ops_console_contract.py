"""Static contract regression: ops console family must use parameterized renderer."""
import ast
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = (root / "sprites" / "consoles.py").read_text()
tree = ast.parse(src)
jobs = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "jobs")
assert len(jobs.args.args) >= 2, "consoles.jobs must accept names and rots"
assert "console_ops" in src, "Ops console geometry must be registered before job creation"
assert '"comms": "module.comms_console"' in src, "Missing comms asset ID"
assert '"sensor": "module.sensor_console"' in src, "Missing sensor asset ID"
print("Ops console jobs contract verified.")
