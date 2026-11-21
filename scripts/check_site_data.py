"""Checks on the data the engines exported, before a build is published.

Every file a page fetches must be present. Every file under public/data must
parse as JSON, stay under the host's per-file limit, and hold no curve from the
currency that was taken off the site. The recorded session must have frames,
and every frame must carry the timings, the curve status and the bond lane the
replay panels read. The bond files must carry what the bond panels read: the
bond universe, the curve grid and the static data reconciliation in
curve_model/bonds.json, and the bond desk in rt_engine/timeline.json.

Usage: python scripts/check_site_data.py [data-dir]   (default public/data)"""
import glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'public', 'data')
LIMIT = 25 * 1024 * 1024            # Cloudflare's limit for one static asset
REMOVED = re.compile(r'AUD|BBSW|AONIA')
FRAME_KEYS = ('epoch', 'status', 'cycleUs', 'npvUs', 'riskUs', 'books', 'bond')

# Every file a dashboard fetches. A missing one is served as the site's HTML
# fallback with status 200, so the page breaks quietly. It must fail here.
# Keep in step with DATA_FILES in scripts/smoke_site.mjs.
REQUIRED = (
    'curve_model/bonds.json', 'curve_model/curves.json', 'curve_model/inputs.json',
    'curve_model/performance.json', 'curve_model/trades.json',
    'rt_engine/demo.json', 'rt_engine/eod_marking.json', 'rt_engine/graph.json',
    'rt_engine/risk_val.json', 'rt_engine/timeline.json', 'rt_engine/val_adjustments.json',
)

errors = []


def need(cond, msg):
    if not cond:
        errors.append(msg)
    return bool(cond)


def nonempty_list(o, key, where):
    return need(isinstance(o.get(key), list) and len(o[key]) > 0, '%s has no %s' % (where, key))


def check_bonds_file(doc):
    """curve_model/bonds.json, read by the Bootstrapped Curves, Bond RV and
    Static Data panels."""
    w = 'bonds.json'
    if nonempty_list(doc, 'bonds', w):
        for i, b in enumerate(doc['bonds']):
            miss = [k for k in ('id', 'name', 'benchmark', 'onCurve', 't', 'clean', 'yield', 'residBp')
                    if k not in b]
            if miss:
                errors.append('%s bond %d lacks %s' % (w, i, ', '.join(miss)))
        need(any(b.get('onCurve') for b in doc['bonds']), '%s has no bond on the curve' % w)
        need(any(not b.get('onCurve') for b in doc['bonds']),
             '%s has no bond measured against the curve' % w)
    nonempty_list(doc, 'pillars', w)
    need(isinstance(doc.get('curve'), dict), '%s has no curve block' % w)
    cols = doc.get('gridColumns')
    if nonempty_list(doc, 'grid', w) and need(isinstance(cols, list) and len(cols) >= 3,
                                                 '%s gridColumns missing or short' % w):
        bad = [i for i, g in enumerate(doc['grid']) if not isinstance(g, list) or len(g) != len(cols)]
        need(not bad, '%s grid rows %s do not match gridColumns' % (w, bad[:5]))
    sd = doc.get('staticData')
    if need(isinstance(sd, dict), '%s has no staticData' % w):
        need(isinstance(sd.get('breaks'), list), '%s staticData has no breaks list' % w)
        nonempty_list(sd, 'fields', w + ' staticData')
        need(isinstance(sd.get('summary'), dict) and 'bonds' in sd['summary'],
             '%s staticData summary lacks bonds' % w)


def check_timeline(doc):
    frames = doc.get('frames', [])
    if not frames:
        errors.append('timeline.json has no frames')
    for i, fr in enumerate(frames):
        missing = [k for k in FRAME_KEYS if k not in fr]
        if missing:
            errors.append('timeline frame %d lacks %s' % (i, ', '.join(missing)))
            continue
        b = fr['bond']
        if not need(isinstance(b, dict), 'timeline frame %d bond is not an object' % i):
            continue
        miss = [k for k in ('us', 'status', 'events', 'book') if k not in b]
        if miss:
            errors.append('timeline frame %d bond lacks %s' % (i, ', '.join(miss)))
            continue
        need(isinstance(b['events'], list), 'timeline frame %d bond.events is not a list' % i)
        need(isinstance(b['book'], dict) and isinstance(b['book'].get('swapLad'), list),
             'timeline frame %d bond.book lacks swapLad' % i)
    if frames:
        need(any(isinstance(f.get('bond'), dict) and f['bond'].get('events') for f in frames),
             'timeline.json has no frame with a bond price event')

    desk = doc.get('bondDesk')
    if not need(isinstance(desk, dict), 'timeline.json has no bondDesk'):
        return
    w = 'timeline.json bondDesk'
    for k in ('curve', 'swapCurve', 'valuation'):
        need(isinstance(desk.get(k), str) and desk[k], '%s has no %s' % (w, k))
    for k in ('bonds', 'positions', 'hedges', 'packages', 'swapT'):
        nonempty_list(desk, k, w)
    need(isinstance(desk.get('gates'), dict) and isinstance(desk['gates'].get('rows'), list),
         '%s gates lacks rows' % w)
    nb = len(desk.get('bonds') or [])
    bad = [i for i, p in enumerate(desk.get('positions') or [])
           if not isinstance(p.get('bond'), int) or not 0 <= p['bond'] < nb]
    need(not bad, '%s positions %s point at no bond' % (w, bad[:5]))


for name in REQUIRED:
    if not os.path.isfile(os.path.join(DATA, name)):
        errors.append('%s is missing' % name)

files = sorted(glob.glob(os.path.join(DATA, '*', '*.json')))
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
        check_timeline(doc)
    elif name == 'curve_model/bonds.json':
        check_bonds_file(doc)
    print('ok   %-34s %9d bytes' % (name, size))

for e in errors:
    print('FAIL ' + e, file=sys.stderr)
print('%d files checked, %d required, %d problems' % (len(files), len(REQUIRED), len(errors)))
sys.exit(1 if errors else 0)
