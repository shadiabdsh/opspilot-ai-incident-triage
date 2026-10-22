#!/usr/bin/env python3
"""
Token-level WCAG contrast audit for OpsPilot.

Reads the real values from src/styles/tokens.css, blends translucent colours over their
actual background, and computes WCAG 2.x contrast ratios for every foreground/background
pairing the components use. Prints a Markdown table; exits 1 if any pair fails.

Usage: python3 scripts/contrast-audit.py [--markdown]
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
css = (ROOT / 'src/styles/tokens.css').read_text()
# Every top-level :root block (foundation and semantic layers); media-query overrides are
# layout-only and excluded.
top_level = re.sub(r'@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', css)
blocks = re.findall(r':root\s*\{([^}]*)\}', top_level)
definitions = [d for b in blocks for d in re.findall(r'(--[\w-]+):\s*([^;]+);', b)]
tokens = dict(definitions)
duplicates = sorted({n for n, _ in definitions if [m for m, _ in definitions].count(n) > 1})

def resolve(v):
    v = v.strip()
    if v.startswith('--'):
        return resolve(tokens[v])
    m = re.fullmatch(r'var\((--[\w-]+)\)', v)
    return resolve(tokens[m.group(1)]) if m else v

def parse(c):
    c = resolve(c)
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3: h = ''.join(x * 2 for x in h)
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (1.0,)
    m = re.fullmatch(r'rgba?\(([^)]+)\)', c)
    if m:
        parts = [p.strip() for p in m.group(1).split(',')]
        r, g, b = (int(float(p)) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, a)
    raise ValueError(f'cannot parse colour {c!r}')

def blend(fg, bg):
    """Composite fg (may be translucent) over an opaque bg."""
    r, g, b, a = fg
    return tuple(round(a * x + (1 - a) * y) for x, y in zip((r, g, b), bg[:3])) + (1.0,)

def over(*layers):
    """over(top, ..., bottom): composite a stack of colours, bottom must be opaque."""
    out = parse(layers[-1])
    for layer in reversed(layers[:-1]):
        out = blend(parse(layer), out)
    return out

def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c[:3]
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)

def ratio(fg, bg):
    l1, l2 = sorted((lum(fg), lum(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)

def hexof(c):
    return '#%02x%02x%02x' % c[:3]

DOCK = over('--color-dock', '--color-page')               # translucent navy over the canvas
DOCK_BTN = over('rgba(255, 255, 255, 0.04)', hexof(DOCK))  # secondary action fill
DOCK_CHIP = over('rgba(255, 255, 255, 0.06)', hexof(DOCK))
DOCK_CAUTION = over('rgba(240, 120, 98, 0.16)', hexof(DOCK))
DOCK_RECORDED = over('rgba(60, 200, 216, 0.1)', hexof(DOCK))
NAV_ACTIVE = over('rgba(60, 200, 216, 0.1)', '--color-nav')

# (element, foreground, background, kind) kind: text | large | ui (non-text 3:1)
PAIRS = [
    # Body and metadata on light surfaces
    ('Primary body text', '--color-ink', '--color-surface', 'text'),
    ('Primary text on canvas', '--color-ink', '--color-page', 'text'),
    ('Secondary text (ink-soft)', '--color-ink-soft', '--color-surface', 'text'),
    ('Muted metadata (quiet) on white', '--color-quiet', '--color-surface', 'text'),
    ('Muted metadata (quiet) on canvas', '--color-quiet', '--color-page', 'text'),
    ('Muted metadata (quiet) on sunken', '--color-quiet', '--color-surface-sunken', 'text'),
    ('Faint labels (faint) on white', '--color-faint', '--color-surface', 'text'),
    ('Faint labels (faint) on sunken', '--color-faint', '--color-surface-sunken', 'text'),
    ('Faint labels (faint) on canvas', '--color-faint', '--color-page', 'text'),
    ('Faint labels (faint) on canvas top', '--color-faint', '--color-canvas-top', 'text'),
    ('Faint labels (faint) on AI tint top', '--color-faint', '--color-ai-region-top', 'text'),
    ('Source label (quiet) on sunken group rows', '--color-quiet', '--color-surface-sunken', 'text'),
    ('Timeline raw message (quiet) on trace', '--color-quiet', '--color-trace', 'text'),
    ('Timeline metadata (ink-soft) on trace', '--color-ink-soft', '--color-trace', 'text'),
    ('Links', '--color-link', '--color-surface', 'text'),
    # AI region
    ('AI region meta (quiet) on AI tint top', '--color-quiet', '--color-ai-region-top', 'text'),
    ('AI heading text on AI tint', '--color-ink', '--color-ai-region-top', 'text'),
    ('Teal text on white (rank, toggles)', '--color-inference-strong', '--color-surface', 'text'),
    ('Teal text on pale cyan (Inferred tag)', '--color-inference-strong', '--color-inference-tint', 'text'),
    ('Teal text on strong cyan (tag expanded)', '--color-inference-strong', '--color-inference-tint-strong', 'text'),
    ('Teal text on AI tint top', '--color-inference-strong', '--color-ai-region-top', 'text'),
    ('Confidence word on cyan chip', '--color-inference-strong', '--color-inference-tint', 'text'),
    ('Unknown tag text', '--color-unknown', '--color-unknown-tint', 'text'),
    ('Observed tag text', '--color-ink-soft', '--color-surface-sunken', 'text'),
    ('Observed tag source (quiet)', '--color-quiet', '--color-surface-sunken', 'text'),
    # Status and severity
    ('Critical badge (coral on tint)', '--color-critical', '--color-critical-tint', 'text'),
    ('Coral text on white', '--color-critical', '--color-surface', 'text'),
    ('Decided pill (green on tint)', '--color-success', '--color-success-tint', 'text'),
    ('Caution note (orange on tint)', '--color-warning', '--color-warning-tint', 'text'),
    ('Major badge', '--color-major', '--color-major-tint', 'text'),
    ('Minor badge', '--color-minor', '--color-minor-tint', 'text'),
    ('Info badge', '--color-info', '--color-info-tint', 'text'),
    # Sidebar
    ('Sidebar inactive nav', '--color-nav-text', '--color-nav', 'text'),
    ('Sidebar strong text', '--color-nav-text-strong', '--color-nav', 'text'),
    ('Sidebar active nav', '--color-nav-text-strong', hexof(NAV_ACTIVE), 'text'),
    ('Sidebar raised band text', '--color-nav-text', '--color-nav-raised', 'text'),
    # Decision bar (translucent navy blended over the canvas)
    ('DecisionBar title', '--color-white', hexof(DOCK), 'text'),
    ('DecisionBar secondary (eyebrow, impact, reasons)', '--color-nav-text', hexof(DOCK), 'text'),
    ('DecisionBar secondary action label', '--color-nav-text-strong', hexof(DOCK_BTN), 'text'),
    ('DecisionBar blocked action label', '--color-dock-disabled', hexof(DOCK), 'text'),
    ('Approve label on cyan', '--color-on-inference-bright', '--color-inference-bright', 'text'),
    ('DecisionBar risk chip (caution)', '--color-critical-on-dark', hexof(DOCK_CAUTION), 'text'),
    ('DecisionBar neutral chip', '--color-nav-text-strong', hexof(DOCK_CHIP), 'text'),
    ('DecisionBar recorded message', '--color-nav-text-strong', hexof(DOCK_RECORDED), 'text'),
    ('DecisionBar warning text', '--color-warning-on-dark', hexof(DOCK), 'text'),
    ('DecisionBar link', '--color-inference-bright', hexof(DOCK_RECORDED), 'text'),
    # Dialogs
    ('Dialog description', '--color-quiet', '--color-surface', 'text'),
    ('Dialog facts label (faint) on sunken', '--color-faint', '--color-surface-sunken', 'text'),
    ('Dialog primary button label', '--color-white', '--color-inference-strong', 'text'),
    ('Dialog disabled button label', '--color-faint', '--color-surface-sunken', 'text'),
    ('Dialog error text', '--color-critical', '--color-surface', 'text'),
    # Dashboard (Phase 4): new pairings only
    ('Dashboard changed-row highlight: title (ink)', '--color-ink', '--color-inference-tint', 'text'),
    ('Dashboard changed-row highlight: metadata (quiet)', '--color-quiet', '--color-inference-tint', 'text'),
    ('Dashboard changed-row highlight: id / affected (ink-soft)', '--color-ink-soft', '--color-inference-tint', 'text'),
    ('Dashboard column headers (faint) on white', '--color-faint', '--color-surface', 'text'),
    ('Dashboard preview toggle hover (teal on tint)', '--color-inference-strong', '--color-inference-tint', 'text'),
    ('Site health: degraded state (coral) on white', '--color-critical', '--color-surface', 'text'),
    ('Source-alert panel message (quiet) on white', '--color-quiet', '--color-surface', 'text'),
    # Phase 5: scenario states (new pairings only)
    ('Stale banner title (ink) on caution tint', '--color-ink', '--color-warning-tint', 'text'),
    ('Stale banner body (ink-soft) on caution tint', '--color-ink-soft', '--color-warning-tint', 'text'),
    ('Refreshed notice (ink-soft) on success tint', '--color-ink-soft', '--color-success-tint', 'text'),
    ('Refreshed notice strong (ink) on success tint', '--color-ink', '--color-success-tint', 'text'),
    ('Re-run button label (white) on teal', '--color-white', '--color-inference-strong', 'text'),
    ('Analyzing banner body (ink-soft) on white', '--color-ink-soft', '--color-surface', 'text'),
    ('Demo strip hint (quiet) on canvas top', '--color-quiet', '--color-canvas-top', 'text'),
    ('Demo strip label (ink-soft) on canvas top', '--color-ink-soft', '--color-canvas-top', 'text'),
    ('Demo option pressed (ink) on white', '--color-ink', '--color-surface', 'text'),
    ('Source availability (ink) on sunken', '--color-ink', '--color-surface-sunken', 'text'),
    ('New since analysis label (caution) on white', '--color-warning', '--color-surface', 'text'),
    # Phase 6: audit integrity (new pairings only)
    ('Audit "Event" label (ink-soft) on canvas', '--color-ink-soft', '--color-page', 'text'),
    ('Audit event message (ink-soft) on canvas', '--color-ink-soft', '--color-page', 'text'),
    ('Snapshot group label (ink-soft) on sunken', '--color-ink-soft', '--color-surface-sunken', 'text'),
    # Non-text (3:1)
    ('Input / select / textarea border', '--color-control-border', '--color-surface', 'ui'),
    ('Focus ring on white', '--color-focus', '--color-surface', 'ui'),
    ('Focus ring on canvas', '--color-focus', '--color-page', 'ui'),
    ('Focus ring on trace highlight', '--color-focus', '--color-trace', 'ui'),
    ('Focus ring on DecisionBar (white)', '--color-white', hexof(DOCK), 'ui'),
    ('Focus ring on sidebar (cyan)', '--color-inference-bright', '--color-nav', 'ui'),
    ('Focus ring on active nav item', '--color-inference-bright', hexof(NAV_ACTIVE), 'ui'),
    ('Active tab indicator', '--color-inference', '--color-surface', 'ui'),
    ('Selected recommendation border', '--color-inference', '--color-surface', 'ui'),
    ('Inferred toggle border', '--color-inference', '--color-surface', 'ui'),
    ('Trace edge vs trace fill', '--color-trace-edge', '--color-trace', 'ui'),
    ('Trace edge vs white', '--color-trace-edge', '--color-surface', 'ui'),
    ('Confidence bar fill vs chip', '--color-inference', '--color-inference-tint', 'ui'),
    ('Confidence empty bar vs chip', '--color-control-border', '--color-inference-tint', 'ui'),
    ('Approve button vs dock', '--color-inference-bright', hexof(DOCK), 'ui'),
    ('Secondary action border vs dock', over('rgba(200, 220, 240, 0.48)', hexof(DOCK)), hexof(DOCK), 'ui'),
    ('Timeline expand / control border', '--color-control-border', '--color-surface', 'ui'),
    ('Offline status dot', '--color-critical', '--color-surface', 'ui'),
    ('Online status dot', '--color-success', '--color-surface', 'ui'),
    ('Site health degraded rail (coral) vs white', '--color-critical', '--color-surface', 'ui'),
    ('View-all / Close button border', '--color-control-border', '--color-surface', 'ui'),
    ('Stale banner caution rail vs caution tint', '--color-warning', '--color-warning-tint', 'ui'),
    ('Demo option group border vs canvas top', '--color-faint', '--color-canvas-top', 'ui'),
    ('Demo option pressed outline vs white', '--color-control-border', '--color-surface', 'ui'),
    ('Analyzing progress bar vs its track', '--color-inference', '--color-inference-tint-strong', 'ui'),
]

def to_hex(v):
    if isinstance(v, tuple): return hexof(v)
    c = parse(v)
    return hexof(c) if c[3] == 1 else resolve(v)

rows, failures = [], 0
for name, fg, bg, kind in PAIRS:
    f = fg if isinstance(fg, tuple) else parse(fg)
    b = parse(bg) if not isinstance(bg, tuple) else bg
    if f[3] < 1: f = blend(f, b)
    r = ratio(f, b)
    need = 4.5 if kind == 'text' else 3.0
    ok = r >= need
    failures += not ok
    label = fg if isinstance(fg, str) and fg.startswith('--') else ''
    rows.append((name, label or '(literal)', hexof(f), hexof(b), r, need, ok))

# Semantic-layer integrity: every alias must resolve to a concrete audited value.
alias_problems = []
for name, value in tokens.items():
    if not re.fullmatch(r'var\(--[\w-]+\)', value.strip()):
        continue  # only plain aliases
    try:
        resolved = resolve(value)
    except KeyError as e:
        alias_problems.append(f'{name}: {value} points at an undefined token ({e})'); continue
    if resolved.startswith(('#', 'rgb')):  # colour aliases must parse as colours
        try:
            parse(resolved)
        except ValueError as e:
            alias_problems.append(f'{name}: {value} does not resolve to a colour ({e})')
alias_problems += [f'{n}: defined more than once' for n in duplicates]

md = '--markdown' in sys.argv
if md:
    print('| Element | Token | Foreground | Background | Ratio | Required | Result |')
    print('| --- | --- | --- | --- | --- | --- | --- |')
for name, tok, f, b, r, need, ok in rows:
    if md:
        print(f'| {name} | `{tok}` | `{f}` | `{b}` | {r:.2f}:1 | {need}:1 | {"Pass" if ok else "**Fail**"} |')
    else:
        print(f'{"PASS" if ok else "FAIL"}  {r:5.2f}  (need {need})  {name}  {f} on {b}')
print(f'\n{len(rows) - failures} of {len(rows)} pairs pass.' if not md else f'\n{len(rows) - failures} of {len(rows)} pairs pass.')
aliases = [n for n, v in tokens.items() if re.fullmatch(r'var\(--color-[\w-]+\)', v.strip())]
if not md:
    print(f'Semantic aliases resolving to audited foundation colours: {len(aliases)}; problems: {len(alias_problems)}')
for p_ in alias_problems: print('ALIAS PROBLEM', p_)
sys.exit(1 if failures or alias_problems else 0)
