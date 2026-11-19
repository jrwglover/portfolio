"""Checks on the data the engines exported, before a build is published.

Every file under public/data must parse as JSON, stay under the host's
per-file limit, and hold no curve from the currency that was taken off the
site. The recorded session must have frames, and every frame must carry the
timings and the curve status the replay panel reads."""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'public', 'data')
LIMIT = 25 * 1024 * 1024            # Cloudflare's limit for one static asset
REMOVED = re.compile(r'AUD|BBSW|AONIA')
FRAME_KEYS = ('epoch', 'status', 'cycleUs', 'npvUs', 'riskUs', 'books')

errors = []
files = sorted(glob.glob(os.path.join(DATA, '*', '*.json')))
if not files:
    errors.append('no data files found')
for f in files:
    name = os.path.relpath(f, DATA).replace(os.sep, '/')
    size = os.path.getsize(f)
    try:
        text = open(f, encoding='utf-8').read()
        doc = json.loads(text)
    except ValueError as e:
        errors.append('%s does not parse: %s' % (name, e))
        continue
    if size > LIMIT:
        errors.append('%s is %d bytes, over the asset limit' % (name, size))
    left = len(REMOVED.findall(text))
    if left:
        errors.append('%s still holds %d removed-currency strings' % (name, left))
    if name == 'rt_engine/timeline.json':
        frames = doc.get('frames', [])
        if not frames:
            errors.append('timeline.json has no frames')
        for i, fr in enumerate(frames):
            missing = [k for k in FRAME_KEYS if k not in fr]
            if missing:
                errors.append('timeline frame %d lacks %s' % (i, ', '.join(missing)))
    print('ok   %-34s %9d bytes' % (name, size))

for e in errors:
    print('FAIL ' + e, file=sys.stderr)
print('%d files checked, %d problems' % (len(files), len(errors)))
sys.exit(1 if errors else 0)
