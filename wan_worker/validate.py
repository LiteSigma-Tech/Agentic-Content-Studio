"""Quick validation script — run inside the deps-only image to confirm
everything works before doing the expensive full build with model weights.

Usage:
  docker build --target deps-only -t wan-test wan_worker/
  docker run --rm wan-test python3 validate.py
"""
import sys

errors = []

# 1. Check Python version
print(f"Python: {sys.version}")
major, minor = sys.version_info[:2]
if major < 3 or (major == 3 and minor < 10):
    errors.append(f"Python >= 3.10 required, got {major}.{minor}")

# 2. Check torch version
try:
    import torch
    print(f"PyTorch: {torch.__version__}")
    if not torch.cuda.is_available():
        print("  (CUDA not available — expected in CPU-only test environment)")
    major = int(torch.__version__.split(".")[0])
    minor = int(torch.__version__.split(".")[1])
    if major < 2 or (major == 2 and minor < 5):
        errors.append(f"PyTorch >= 2.5 required, got {torch.__version__}")
except ImportError as e:
    errors.append(f"torch import failed: {e}")

# 3. Check diffusers Wan pipeline imports
try:
    from diffusers import WanImageToVideoPipeline, WanPipeline
    print("diffusers: WanImageToVideoPipeline + WanPipeline imported OK")
except Exception as e:
    errors.append(f"diffusers Wan import failed: {e}")

# 4. Check other handler dependencies
try:
    import boto3
    import imageio
    import runpod
    import PIL
    print(f"boto3: {boto3.__version__}")
    print(f"runpod: {runpod.__version__}")
    print("imageio + PIL: OK")
except ImportError as e:
    errors.append(f"dependency import failed: {e}")

# 5. Check handler.py parses without error
try:
    import ast, pathlib
    src = pathlib.Path("/app/handler.py").read_text()
    ast.parse(src)
    print("handler.py: syntax OK")
except SyntaxError as e:
    errors.append(f"handler.py syntax error: {e}")
except FileNotFoundError:
    errors.append("handler.py not found at /app/handler.py")

# 6. Check model path would exist (skipped in deps-only, present in full)
import pathlib
model_dir = pathlib.Path("/app/models/Wan2.2-TI2V-5B")
if model_dir.exists():
    index = model_dir / "model_index.json"
    if index.exists():
        print(f"Model weights: found at {model_dir} ✓")
    else:
        errors.append(f"model_index.json missing in {model_dir}")
else:
    print(f"Model weights: not present (deps-only image — expected)")

print()
if errors:
    print("VALIDATION FAILED:")
    for e in errors:
        print(f"  ✗ {e}")
    sys.exit(1)
else:
    print("ALL CHECKS PASSED — safe to do full build")
