#!/usr/bin/env python3
"""
Browser accessibility audit for the Operations Dashboard (Playwright + Chromium + axe-core).
Evidence for a manual audit, not proof of WCAG conformance. Writes scripts/a11y-dashboard-results.json.
Loading and empty states use a development-only switch, so they are covered by the jsdom axe tests.
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
INC = '12 endpoints offline in Building A'
BIND = 'Bind the renewed certificate to NPS and restart the service'
R = {}

PROBE = """() => { const el = document.activeElement; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
  const s = document.getElementById('main-scroll'); const sr = s ? s.getBoundingClientRect() : {top: 0, bottom: innerHeight};
  const hidden = r.bottom <= sr.top || r.top >= sr.bottom;
  return { name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50), tag: el.tagName.toLowerCase(),
           outline: cs.outlineStyle + ' ' + cs.outlineWidth, entirelyObscured: !!(s && s.contains(el) && hidden) }; }"""

async def axe(page, label):
    await page.add_script_tag(content=AXE)
    r = await page.evaluate("""async () => { const r = await axe.run(document, { resultTypes: ['violations', 'incomplete'] });
      const f = v => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) });
      return { violations: r.violations.map(f), incomplete: r.incomplete.map(f) }; }""")
    R.setdefault('axe', {})[label] = r

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        async def open_(w, h, dsf=1, reduced=False):
            ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, reduced_motion='reduce' if reduced else 'no-preference')
            pg = await ctx.new_page(); await pg.goto(BASE + '/'); await pg.wait_for_selector('#queue-heading'); await pg.wait_for_timeout(300)
            return ctx, pg
        for w, h in [(1440, 900), (1280, 800), (1024, 768)]:
            ctx, pg = await open_(w, h); await axe(pg, f'dashboard-{w}'); await ctx.close()
        ctx, pg = await open_(1280, 800)
        await pg.get_by_role('button', name='Preview source alerts').click(); await axe(pg, 'preview-open')
        await pg.get_by_role('button', name='View all 12 source alerts').click(); await pg.wait_for_selector('[role=dialog]'); await axe(pg, 'panel-open')
        await ctx.close()

        # Keyboard
        ctx, pg = await open_(1280, 800)
        steps, stops = [], []
        async def tab_to(js, limit=40):
            for _ in range(limit):
                await pg.keyboard.press('Tab'); stops.append(await pg.evaluate(PROBE))
                if await pg.evaluate(js): return True
            return False
        steps.append(('Tab reaches INC-2041 title link', await tab_to(f"document.activeElement.textContent.trim() === '{INC}'")))
        steps.append(('Tab reaches Preview source alerts', await tab_to("document.activeElement.textContent.includes('Preview source alerts')", 3)))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        steps.append(('Enter expands preview; focus stays on the toggle', await pg.evaluate("document.activeElement.getAttribute('aria-expanded') === 'true'")))
        steps.append(('Tab reaches View all', await tab_to("document.activeElement.textContent.includes('View all 12')", 3)))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        steps.append(('Panel opens with focus inside', await pg.evaluate("!!document.activeElement.closest('[role=dialog]')")))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        steps.append(('Escape closes the panel; focus returns to View all', await pg.evaluate("document.activeElement.textContent.includes('View all 12')")))
        await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Shift+Tab'); await pg.wait_for_timeout(100)
        steps.append(('Shift+Tab back to the title link', await pg.evaluate(f"document.activeElement.textContent.trim() === '{INC}'")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        steps.append(('Enter on the title opens Incident Detail', await pg.evaluate(f"document.querySelector('h1').textContent === '{INC}'")))
        R['keyboard'] = [{'step': s, 'ok': bool(o)} for s, o in steps]
        R['focus_stops'] = stops
        await ctx.close()

        # Return after decision: live region + highlight (reduced motion and normal)
        for reduced in (False, True):
            ctx, pg = await open_(1280, 800, reduced=reduced)
            await pg.get_by_role('link', name=INC).click(); await pg.wait_for_selector('#facts-heading')
            await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
            await pg.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-01')
            await pg.get_by_role('button', name='Approve and create change request').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('link', name='Dashboard').click(); await pg.wait_for_selector('#queue-heading')
            await pg.wait_for_timeout(400)
            info = await pg.evaluate(f"""() => {{ const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes('{INC}'));
              const cell = row.querySelector('th'); return {{ status: row.textContent.includes('Decided'), highlighted: row.hasAttribute('data-changed'),
              transition: getComputedStyle(cell).transitionDuration,
              live: [...document.querySelectorAll('[aria-live=polite]')].map(e => e.textContent).filter(Boolean) }}; }}""")
            if not reduced:
                await pg.screenshot(path='/tmp/dash-return.png')
            R['return_reduced' if reduced else 'return'] = info
            await ctx.close()

        # Targets and zoom
        ctx, pg = await open_(1280, 800)
        await pg.get_by_role('button', name='Preview source alerts').click()
        R['targets_under_24'] = await pg.evaluate("""() => [...document.querySelectorAll('a[href], button')].filter(e => e.offsetParent !== null)
          .map(e => { const r = e.getBoundingClientRect(); return { name: (e.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; })
          .filter(x => x.w < 24 || x.h < 24)""")
        R['headings'] = await pg.evaluate("() => [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ' ' + h.textContent)")
        await ctx.close()
        z = []
        for w, h, label in [(1024, 576, '200% of 2048×1152'), (1280, 720, '200% of 2560×1440'), (640, 400, '200% of 1280×800 (below scope)')]:
            ctx, pg = await open_(w, h, dsf=2)
            z.append({'label': label, **await pg.evaluate("""() => ({ docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              scrollerOverflowX: (() => { const s = document.getElementById('main-scroll'); return s.scrollWidth > s.clientWidth + 1; })() })""")})
            await pg.screenshot(path=f'/tmp/dash-zoom-{w}.png'); await ctx.close()
        R['zoom'] = z
        await b.close()
    (ROOT / 'scripts/a11y-dashboard-results.json').write_text(json.dumps(R, indent=2))
    for k, v in R['axe'].items(): print('axe', k, len(v['violations']), [x['id'] for x in v['violations']], 'incomplete:', [x['id'] for x in v['incomplete']])
    for s in R['keyboard']: print('OK  ' if s['ok'] else 'FAIL', s['step'])
    print('focus stops:', len(R['focus_stops']), 'no outline:', [s['name'] for s in R['focus_stops'] if s['outline'].startswith('none')], 'obscured:', [s['name'] for s in R['focus_stops'] if s['entirelyObscured']])
    print('return:', R['return']); print('return (reduced motion):', R['return_reduced'])
    print('targets under 24:', R['targets_under_24']); print('headings:', R['headings']); print('zoom:', R['zoom'])

asyncio.run(main())
