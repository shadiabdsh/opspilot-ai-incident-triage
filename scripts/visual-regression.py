#!/usr/bin/env python3
"""
Pixel-level visual regression for OpsPilot.

  capture:  python3 scripts/visual-regression.py capture <out_dir> <base_url> [--gallery]
  compare:  python3 scripts/visual-regression.py compare <before_dir> <after_dir>

Captures every screen and state with reduced motion (so animation cannot add noise), then
compares two captures pixel by pixel. Used to prove that a refactor (for example the
semantic-token layer) changes no rendered pixel. --gallery captures the development
Gallery (all signature component states), which needs the dev server.
"""
import asyncio, pathlib, sys

STATES = []

def state(name):
    def wrap(fn):
        STATES.append((name, fn)); return fn
    return wrap

BIND = 'Bind the renewed certificate to NPS and restart the service'
NOTIFY = 'Notify Building A users about the network outage'
INC = '12 endpoints offline in Building A'

async def goto(pg, base, path, wait='#facts-heading'):
    await pg.goto(base + path); await pg.wait_for_selector(wait); await pg.wait_for_timeout(400)

async def scroll(pg, y):
    await pg.evaluate(f"document.getElementById('main-scroll').scrollTop = {y}"); await pg.wait_for_timeout(150)

@state('dashboard')
async def _(pg, base): await goto(pg, base, '/', '#queue-heading')
@state('dashboard-preview')
async def _(pg, base):
    await goto(pg, base, '/', '#queue-heading'); await pg.get_by_role('button', name='Preview source alerts').click(); await pg.wait_for_timeout(150)
@state('dashboard-source-panel')
async def _(pg, base):
    await goto(pg, base, '/', '#queue-heading'); await pg.get_by_role('button', name='Preview source alerts').click()
    await pg.get_by_role('button', name='View all 12 source alerts').click(); await pg.wait_for_timeout(300)
@state('incident-top')
async def _(pg, base): await goto(pg, base, '/incidents/INC-2041')
@state('incident-mid')
async def _(pg, base): await goto(pg, base, '/incidents/INC-2041'); await scroll(pg, 700)
@state('incident-recommendations')
async def _(pg, base): await goto(pg, base, '/incidents/INC-2041'); await scroll(pg, 1600)
@state('trace-hover')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041'); await scroll(pg, 380)
    await pg.locator('article').filter(has_text='Primary hypothesis').first.locator('li').filter(has_text='06:01:04').first.hover(); await pg.wait_for_timeout(150)
@state('show-source')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041')
    ev = pg.locator('article').filter(has_text='Primary hypothesis').first.locator('li').filter(has_text='06:08:50').first
    await ev.get_by_role('button', name='Show source: 06:08:50, nps-bldga-01').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(400)
@state('focus-show-source-keyboard')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041')
    for _ in range(120):
        await pg.keyboard.press('Tab')
        if await pg.evaluate("document.activeElement.getAttribute('aria-label') === 'Show source: 06:00:00, nps-bldga-01'"): break
    await pg.wait_for_timeout(200)
@state('focus-approve-dock')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041')
    for _ in range(200):
        await pg.keyboard.press('Tab')
        if await pg.evaluate("document.activeElement.textContent.trim() === 'Approve' && !!document.activeElement.closest('#decision-bar')"): break
    await pg.wait_for_timeout(200)
@state('approve-dialog')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041')
    await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
    await pg.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-0'); await pg.wait_for_timeout(200)
@state('recorded')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041')
    await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
    await pg.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-01')
    await pg.get_by_role('button', name='Approve and create change request').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(400)
@state('audit-expanded')
async def _(pg, base):
    await STATES_BY_NAME['recorded'](pg, base)
    await pg.get_by_role('button', name='View in audit trail').click()
    await pg.get_by_role('button', name='View analysis at decision time').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(300)
@state('dashboard-decided-return')
async def _(pg, base):
    await STATES_BY_NAME['recorded'](pg, base)
    await pg.get_by_role('link', name='Dashboard').click(); await pg.wait_for_selector('#queue-heading'); await pg.mouse.move(1, 1); await pg.wait_for_timeout(300)
@state('low-top')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041'); await pg.get_by_role('button', name='Low confidence').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(300)
@state('low-hypotheses')
async def _(pg, base): await STATES_BY_NAME['low-top'](pg, base); await scroll(pg, 500)
@state('low-blocked-selected')
async def _(pg, base):
    await STATES_BY_NAME['low-top'](pg, base); await pg.get_by_role('radio', name=BIND).check(); await scroll(pg, 2200)
@state('low-escalate-dialog')
async def _(pg, base):
    await STATES_BY_NAME['low-top'](pg, base); await pg.get_by_role('radio', name=BIND).check()
    await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Escalate').click(); await pg.wait_for_timeout(300)
@state('stale-banner')
async def _(pg, base):
    await goto(pg, base, '/incidents/INC-2041'); await pg.get_by_role('button', name='Stale analysis').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(3500)
@state('stale-new-events')
async def _(pg, base): await STATES_BY_NAME['stale-banner'](pg, base); await scroll(pg, 99999)
@state('stale-ack-dialog')
async def _(pg, base):
    await STATES_BY_NAME['stale-banner'](pg, base); await pg.get_by_role('button', name='Acknowledge').click(); await pg.wait_for_timeout(300)
@state('stale-acknowledged')
async def _(pg, base):
    await STATES_BY_NAME['stale-ack-dialog'](pg, base); await pg.get_by_role('button', name='Acknowledge and continue').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(400)
@state('stale-analyzing')
async def _(pg, base):
    await STATES_BY_NAME['stale-banner'](pg, base); await pg.get_by_role('button', name='Re-run analysis').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(300)
@state('stale-refreshed')
async def _(pg, base):
    await STATES_BY_NAME['stale-analyzing'](pg, base); await pg.wait_for_timeout(1800)
@state('stale-audit')
async def _(pg, base):
    await STATES_BY_NAME['stale-acknowledged'](pg, base)
    await pg.get_by_role('radio', name=NOTIFY).check()
    await pg.get_by_role('group', name=f'Decision on: {NOTIFY}').get_by_role('button', name='Approve').click()
    await pg.get_by_role('dialog').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(300)
    await pg.get_by_role('tab', name='Audit · 1 decision').click(); await pg.mouse.move(1, 1); await pg.wait_for_timeout(300)

STATES_BY_NAME = {n: f for n, f in STATES}

async def capture(out, base, gallery):
    from playwright.async_api import async_playwright
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if gallery:
            ctx = await b.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce'); pg = await ctx.new_page()
            await pg.goto(base + '/dev/gallery'); await pg.wait_for_selector('#g-audit'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=str(out / 'gallery-full.png'), full_page=True); await ctx.close()
        else:
            for w, h in [(1280, 800), (1024, 768)]:
                for name, fn in STATES:
                    if w == 1024 and name not in ('dashboard', 'incident-top', 'incident-mid', 'low-top', 'stale-banner', 'audit-expanded', 'approve-dialog'):
                        continue
                    ctx = await b.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce'); pg = await ctx.new_page()
                    await fn(pg, base)
                    await pg.screenshot(path=str(out / f'{name}-{w}.png')); await ctx.close()
        await b.close()
    print('captured', len(list(out.glob('*.png'))), 'images in', out)

def compare(a, b):
    from PIL import Image, ImageChops
    a, b = pathlib.Path(a), pathlib.Path(b)
    names = sorted(p.name for p in a.glob('*.png'))
    diffs = []
    for n in names:
        if not (b / n).exists():
            diffs.append((n, 'missing in after')); continue
        ia, ib = Image.open(a / n).convert('RGB'), Image.open(b / n).convert('RGB')
        if ia.size != ib.size:
            diffs.append((n, f'size {ia.size} vs {ib.size}')); continue
        d = ImageChops.difference(ia, ib)
        box = d.getbbox()
        if box:
            changed = sum(1 for px in d.getdata() if px != (0, 0, 0))
            diffs.append((n, f'{changed} pixels differ in {box}'))
    print(f'compared {len(names)} images: {len(names) - len(diffs)} identical, {len(diffs)} different')
    for n, why in diffs: print('  DIFF', n, why)
    return 1 if diffs else 0

if __name__ == '__main__':
    if sys.argv[1] == 'capture':
        base_url = next(a for a in sys.argv[3:] if a.startswith('http'))
        asyncio.run(capture(sys.argv[2], base_url, '--gallery' in sys.argv))
    else:
        sys.exit(compare(sys.argv[2], sys.argv[3]))
