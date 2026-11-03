"""Build the single-file editor from src. No external Python dependencies."""
import argparse
import base64
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INCLUDE = re.compile(r'/\* @bridge:([a-z0-9_.-]+) \*/')
MODULES = {'gltf_loader.js', 'gameplay_core.js', 'economy_core.js', 'game_runtime.js', 'terrain_core.js', 'studio.js'}


def build():
    def expand(text, parents=()):
        def insert(match):
            name = match[1]
            if name == 'mini-rover.glb':
                return base64.b64encode((ROOT / 'assets' / name).read_bytes()).decode('ascii')
            if name not in MODULES or name in parents:
                raise ValueError(f'Invalid include: {parents} -> {name}')
            source = (ROOT / 'src' / name).read_text(encoding='utf-8').strip()
            return expand(source, (*parents, name))
        return INCLUDE.sub(insert, text)
    return expand((ROOT / 'src/studio_template.html').read_text(encoding='utf-8')).encode('utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--output', type=Path)
    action.add_argument('--check', type=Path)
    args = parser.parse_args()
    payload = build()
    if args.check:
        if args.check.read_bytes() != payload:
            raise SystemExit(f'Build differs from {args.check}')
        print(f'Matched {len(payload)} bytes')
    else:
        args.output.write_bytes(payload)
