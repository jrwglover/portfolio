"""Remove every AUD curve, row and key from the published data under
public/data. Run after any re-export from the engines, which still carry the
AUD curves behind their own switch."""
import json, re, glob, os
HERE = os.path.dirname(os.path.abspath(__file__))
AUD = re.compile(r'(^|_)(AUD|AONIA|BBSW|AUDUSD)|EOD_AUD|AUD_')
KEYF = ('curve', 'id', 'key', 'ccy', 'curveId', 'index', 'tick', 'currency', 'name', 'curve_id')
def hit(s): return isinstance(s, str) and bool(AUD.search(s))
def strip(o):
    if isinstance(o, dict):
        return {k: strip(v) for k, v in o.items() if not hit(k) and not k.lower().startswith('bbsw')}
    if isinstance(o, list):
        return [strip(x) for x in o if not hit(x) and not (isinstance(x, dict) and any(hit(x.get(f)) for f in KEYF))]
    return o
for f in glob.glob(os.path.join(HERE, '..', 'public', 'data', '*', '*.json')):
    d = json.load(open(f, encoding='utf-8')); before = len(json.dumps(d))
    d = strip(d)
    for k in ('engineDemo', 'traderDemo'):
        if k in d: d[k] = '\n'.join(l for l in d[k].split('\n') if not re.search(r'AUD|BBSW|AONIA|RBA', l))
    s = json.dumps(d, separators=(',', ':'))
    s = s.replace('max(f_SOFR, f_EURUSD_XCCY, f_AUDUSD_XCCY)', 'max(f_SOFR, f_EURUSD_XCCY)').replace('Projection bases up 15bp (EURIBOR, BBSW)', 'Projection basis up 15bp (EURIBOR)')
    open(f, 'w', encoding='utf-8', newline='\n').write(s)
    print('%-60s %8d -> %8d  AUD left: %d' % (os.path.relpath(f, HERE), before, len(s), len(re.findall(r'AUD|BBSW|AONIA', s))))
