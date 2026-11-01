#!/usr/bin/env python3
"""P1 audio batch (owner-approved 01/11/2026): render Piper amy (US) + alba (GB)
to wav, convert to m4a via afconvert. Only deck words (IELTS/TOEIC-biz/comm).
Skips existing files (rerunnable). Voices live OUTSIDE the repo (~/piper-voices).
Usage: python3 tools/render-audio.py [--limit N]"""
import json, os, subprocess, sys

REPO = os.path.join(os.path.dirname(__file__), '..')
AUD = os.path.join(REPO, 'audio')
US_VOICE = os.path.expanduser('~/piper-voices/en_US-amy-medium.onnx')
GB_VOICE = os.path.expanduser('~/piper-voices/en_GB-alba-medium.onnx')
BIZ = set('account bank balance invoice payment budget finance marketing sales contract meeting office shipping delivery order customer client employee manager payroll revenue profit audit tax loan credit stock share board quarter expense claim warranty supplier retail import export freight cargo warehouse inventory deadline overtime salary conference proposal dividend interest mortgage insurance premium booking memo agenda'.split())

tags = json.load(open(os.path.join(REPO, 'data', 'exam-tags.json')))
wm = json.load(open(os.path.join(REPO, 'docs', 'wordpages-manifest.json')))
wordset = set(wm.get('slugs', []))

words = sorted({w for w, t in tags.get('words', {}).items()
                if w in wordset and ('ielts' in t.get('tags', []) or 'giao-tiep' in t.get('tags', []))})
words += sorted({w for w in BIZ if w in wordset and w not in set(words)})
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else 99999
words = words[:limit]
print(f'deck words to render: {len(words)}')

def render(word, voice, out):
    if os.path.exists(out):
        return 'skip'
    wav = out + '.tmp.wav'
    p1 = subprocess.run([sys.executable, '-m', 'piper', '--model', voice, '--output_file', wav],
                        input=word.encode(), capture_output=True)
    if p1.returncode != 0 or not os.path.exists(wav):
        return 'FAIL-piper'
    p2 = subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', wav, out], capture_output=True)
    try: os.remove(wav)
    except OSError: pass
    return 'ok' if p2.returncode == 0 else 'FAIL-conv'

stats = {'ok': 0, 'skip': 0, 'fail': []}
for i, w in enumerate(words):
    safe = w.replace("'", '')
    for accent, voice in (('us', US_VOICE), ('gb', GB_VOICE)):
        d = os.path.join(AUD, accent)
        os.makedirs(d, exist_ok=True)
        out = os.path.join(d, safe + '.m4a')
        r = render(w, voice, out)
        if r == 'ok': stats['ok'] += 1
        elif r == 'skip': stats['skip'] += 1
        else: stats['fail'].append((w, accent, r))
    if (i + 1) % 200 == 0:
        print(f'  {i + 1}/{len(words)} ok={stats["ok"]} skip={stats["skip"]} fail={len(stats["fail"])}', flush=True)
print(f'DONE ok={stats["ok"]} skip={stats["skip"]} fail={len(stats["fail"])}')
for f in stats['fail'][:10]:
    print('  FAIL', f)
