#!/usr/bin/env python3
"""
Browser accessibility audit for the Incident Detail screen (Playwright + Chromium + axe-core).

Runs against a served build (default http://localhost:4173). Checks: axe (including colour
contrast, which jsdom cannot compute) in several states; a keyboard-only walkthrough with
focus-visible and focus-not-obscured checks at every stop; target sizes; heading/landmark
structure; 200% zoom equivalents; reduced motion. Writes JSON to scripts/a11y-results.json.

This is evidence for a manual audit, not proof of WCAG conformance.
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
URL = f'{BASE}/incidents/INC-2041'
ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
BIND = 'Bind the renewed certificate to NPS and restart the service'
results = {}

FOCUS_PROBE = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body' };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const header = document.querySelector('header[class*="header"]');
  const hb = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
  const scroller = document.getElementById('main-scroll');
  const inScroller = scroller && scroller.contains(el);
  const dock = document.getElementById('decision-bar');
  const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight;
  const dialog = document.querySelector('[role=dialog]');
  const inStickyHeader = header && header.contains(el) && getComputedStyle(header).position === 'sticky';
  let obscured = 'none';
  if (inScroller && !dialog && !inStickyHeader) {
    // A sticky header only covers content when it is actually sticky.
    const sb = scroller.getBoundingClientRect().bottom;
    const visTop = Math.max(r.top, hb), visBottom = Math.min(r.bottom, sb, dockTop);
    if (visBottom <= visTop) obscured = 'entirely';
    else if (r.top < hb - 0.5 || r.bottom > Math.min(sb, dockTop) + 0.5) obscured = 'partly';
  }
  const name = el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 60) || el.id;
  return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), name,
           outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor,
           boxShadow: cs.boxShadow !== 'none', obscured, w: Math.round(r.width), h: Math.round(r.height) };
}"""

async def axe(page, label, disable=()):
    await page.add_script_tag(content=AXE)
    res = await page.evaluate("""async (dis) => {
      const rules = {}; for (const id of dis) rules[id] = { enabled: false };
      const r = await axe.run(document, { rules, resultTypes: ['violations', 'incomplete'] });
      const s = (v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(' ')) });
      return { violations: r.violations.map(s), incomplete: r.incomplete.map(s) };
    }""", list(disable))
    results.setdefault('axe', {})[label] = res
    return res

async def tab_until(page, predicate_js, limit=160, back=False):
    stops = []
    for _ in range(limit):
        await page.keyboard.press('Shift+Tab' if back else 'Tab')
        info = await page.evaluate(FOCUS_PROBE)
        stops.append(info)
        if await page.evaluate(predicate_js):
            return info, stops
    raise RuntimeError(f'focus target not reached: {predicate_js}')

async def open_page(b, w, h, dsf=1, reduced=False):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf,
                              reduced_motion='reduce' if reduced else 'no-preference')
    page = await ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.goto(URL)
    await page.wait_for_selector('#facts-heading')
    await page.wait_for_timeout(400)
    return ctx, page, errors

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ── axe in several states ────────────────────────────────────────────
        for w, h in [(1440, 900), (1280, 800), (1024, 768)]:
            ctx, page, _ = await open_page(b, w, h)
            await axe(page, f'overview-{w}')
            await ctx.close()
        ctx, page, _ = await open_page(b, 1280, 800)
        hyp = page.locator('article').filter(has_text='Primary hypothesis').first
        await hyp.locator('li').filter(has_text='06:01:04').first.hover()
        await axe(page, 'trace-hover')
        await page.get_by_role('button', name='Show details: Verify the renewed certificate chain before binding').click()
        await axe(page, 'recommendation-expanded')
        await page.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
        await page.wait_for_selector('[role=dialog]')
        await axe(page, 'dialog-typed-confirmation')
        await page.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-01')
        await page.get_by_role('button', name='Approve and create change request').click()
        await page.wait_for_timeout(300)
        await axe(page, 'recorded')
        await page.get_by_role('button', name='View in audit trail').click()
        await page.get_by_role('button', name='View analysis at decision time').click()
        await axe(page, 'audit-expanded')
        await ctx.close()

        # ── Keyboard-only base workflow with focus checks at every stop ───────
        ctx, page, errors = await open_page(b, 1280, 800)
        kb = {'steps': [], 'stops': []}
        def step(name, ok, detail=''):
            kb['steps'].append({'step': name, 'ok': bool(ok), 'detail': detail})
        info, stops = await tab_until(page, "document.activeElement.textContent.trim() === 'Overview'")
        kb['stops'] += stops; step('Reach tabs from page start', True, f'{len(stops)} Tab presses')
        info, stops = await tab_until(page, "document.activeElement.id === 'facts-heading' || (document.activeElement.getAttribute('aria-controls')||'').length>0 && document.activeElement.textContent.includes('Building A workstations')")
        kb['stops'] += stops; step('Reach Observed facts (systems group toggle)', True)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(100)
        step('Expand systems group with Enter', await page.evaluate("document.activeElement.getAttribute('aria-expanded') === 'true'"))
        await page.keyboard.press('Enter')
        info, stops = await tab_until(page, "(document.activeElement.getAttribute('aria-label')||'').startsWith('Inferred by AI') ")
        kb['stops'] += stops; step('Reach AI analysis (summary Inferred toggle)', True)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(100)
        step('Expand summary evidence with Enter', await page.evaluate("document.activeElement.getAttribute('aria-expanded') === 'true'"))
        info, stops = await tab_until(page, "document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'")
        kb['stops'] += stops; step('Reach evidence Show source in primary hypothesis', True)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(700)
        focused = await page.evaluate("document.activeElement.id")
        probe = await page.evaluate(FOCUS_PROBE)
        step('Show source moves focus to source event row', focused == 'event-row-ev-nps-failures-12', f'focused={focused}, obscured={probe["obscured"]}, outline={probe["outlineStyle"]} {probe["outlineWidth"]}')
        await page.keyboard.press('Tab')
        step('Tab reaches Back to evidence', await page.evaluate("document.activeElement.textContent.trim() === 'Back to evidence'"))
        await page.keyboard.press('Enter'); await page.wait_for_timeout(200)
        step('Back to evidence returns focus to the evidence item', await page.evaluate("document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'"))
        # Escape variant
        await page.keyboard.press('Enter'); await page.wait_for_timeout(700)
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        step('Escape in source row returns focus to the evidence item', await page.evaluate("document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'"))
        info, stops = await tab_until(page, "document.activeElement.type === 'radio'")
        kb['stops'] += stops; step('Reach recommendation radio group', True, info['name'])
        await page.keyboard.press('ArrowDown'); await page.wait_for_timeout(150)
        sel = await page.evaluate("document.activeElement.checked && document.activeElement.labels[0].textContent")
        step('ArrowDown selects next recommendation', bool(sel), str(sel))
        await page.keyboard.press('ArrowUp'); await page.wait_for_timeout(150)
        sel = await page.evaluate("document.activeElement.checked && document.activeElement.labels[0].textContent")
        step('ArrowUp returns to consequential recommendation', sel == BIND, str(sel))
        info, stops = await tab_until(page, "document.activeElement.textContent.trim() === 'Approve'")
        kb['stops'] += stops; step('Reach Approve in the dock', True)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(300)
        step('Approve opens dialog; focus inside dialog', await page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
        await page.keyboard.press('Escape'); await page.wait_for_timeout(200)
        step('Escape closes dialog and returns focus to Approve', await page.evaluate("document.activeElement.textContent.trim() === 'Approve'"))
        await page.keyboard.press('Enter'); await page.wait_for_timeout(300)
        await page.keyboard.type('nps-bldga-01')
        info, stops = await tab_until(page, "document.activeElement.textContent.trim() === 'Approve and create change request'")
        await page.keyboard.press('Enter'); await page.wait_for_timeout(400)
        step('Typed confirmation records the decision', await page.evaluate("document.querySelector('[role=status]').textContent.includes('CHG-5521')"))
        step('Focus moves to the recorded confirmation', await page.evaluate("!!document.activeElement.closest('[role=status]')"))
        info, stops = await tab_until(page, "document.activeElement.textContent.trim() === 'View in audit trail'", limit=10)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(300)
        step('View in audit trail opens Audit tab', await page.evaluate("document.querySelector('[role=tab][aria-selected=true]').textContent.startsWith('Audit · 1 decision')"))
        info, stops = await tab_until(page, "document.activeElement.tagName === 'BUTTON' && document.activeElement.textContent.includes('View analysis at decision time')", limit=40)
        await page.keyboard.press('Enter'); await page.wait_for_timeout(200)
        step('Expand frozen analysis by keyboard', await page.evaluate("document.activeElement.getAttribute('aria-expanded') === 'true'"))
        kb['errors'] = errors
        results['keyboard_base'] = kb
        await ctx.close()

        # ── Modify / Dismiss / Escalate by keyboard ───────────────────────────
        other = []
        for action in ['Modify', 'Dismiss', 'Escalate']:
            ctx, page, _ = await open_page(b, 1280, 800)
            await tab_until(page, f"document.activeElement.textContent.trim() === '{action}'", limit=200)
            await page.keyboard.press('Enter'); await page.wait_for_timeout(300)
            in_dialog = await page.evaluate("!!document.activeElement.closest('[role=dialog]')")
            if action == 'Modify':
                await tab_until(page, "document.activeElement.labels && document.activeElement.labels[0] && document.activeElement.labels[0].textContent === 'Restart window'", limit=10)
                await page.keyboard.press('Control+A'); await page.keyboard.type('06:30')
                await tab_until(page, "document.activeElement.labels && document.activeElement.labels[0] && document.activeElement.labels[0].textContent.startsWith('Type')", limit=10)
                await page.keyboard.type('nps-bldga-01')
                await tab_until(page, "document.activeElement.textContent.trim() === 'Approve with changes'", limit=10)
            elif action == 'Dismiss':
                await page.keyboard.press('Space')  # first preset is focused
                await tab_until(page, "document.activeElement.textContent.trim() === 'Dismiss recommendation'", limit=10)
            else:
                await page.keyboard.press('ArrowDown')  # first field is the team select
                await page.keyboard.press('Tab'); await page.keyboard.type('Please confirm and bind.')
                await tab_until(page, "document.activeElement.textContent.trim() === 'Escalate' && !!document.activeElement.closest('[role=dialog]')", limit=10)
            await page.keyboard.press('Enter'); await page.wait_for_timeout(400)
            status = await page.evaluate("document.querySelector('[role=status]').textContent")
            other.append({'action': action, 'focus_in_dialog_on_open': in_dialog, 'recorded': status})
            await ctx.close()
        results['keyboard_other'] = other

        # ── Target size sweep ────────────────────────────────────────────────
        ctx, page, _ = await open_page(b, 1280, 800)
        await page.get_by_role('button', name='Show details: Verify the renewed certificate chain before binding').click()
        small = await page.evaluate("""() => {
          const els = [...document.querySelectorAll('a[href], button, input, select, textarea, [role=tab]')]
            .filter(e => e.offsetParent !== null);
          return els.map(e => { const r = e.getBoundingClientRect();
              return { name: (e.getAttribute('aria-label') || e.textContent || e.type || '').trim().slice(0, 50), tag: e.tagName.toLowerCase(), type: e.type || '', w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                       inline: getComputedStyle(e).display === 'inline' && !!e.closest('p') }; })
            .filter(x => x.w < 24 || x.h < 24);
        }""")
        results['targets_under_24'] = small
        # Spacing exception (2.5.8): a 24px circle centred on each small target must not
        # intersect another target. Measure distance from each radio's centre to the nearest
        # other interactive element (its own label activates the same radio, so it is excluded).
        results['radio_spacing'] = await page.evaluate("""() => {
          const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [role=tab]')].filter(e => e.offsetParent !== null);
          return [...document.querySelectorAll('input[type=radio]')].filter(r => r.offsetParent !== null).map(r => {
            r.scrollIntoView({ block: 'center' }); // measure what is actually visible together
            const rr = r.getBoundingClientRect(); const cx = rr.x + rr.width / 2, cy = rr.y + rr.height / 2;
            let min = Infinity;
            const scroller = document.getElementById('main-scroll'); const sr = scroller.getBoundingClientRect();
            // Targets inside the scroll area count only where they are visible (not clipped).
            const targets = all.filter(t => { if (!scroller.contains(t)) return true; const b = t.getBoundingClientRect(); return b.bottom > sr.top && b.top < sr.bottom; });
            for (const t of targets) { if (t === r) continue;
              const b = t.getBoundingClientRect();
              const dx = Math.max(b.left - cx, 0, cx - b.right), dy = Math.max(b.top - cy, 0, cy - b.bottom);
              min = Math.min(min, Math.hypot(dx, dy)); }
            return { name: r.labels[0]?.textContent.slice(0, 40), nearestOtherTargetPx: +min.toFixed(1), passesSpacingException: min >= 12 };
          });
        }""")
        # ── Structure ───────────────────────────────────────────────────────
        results['headings'] = await page.evaluate("""() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
            .filter(h => h.offsetParent !== null).map(h => h.tagName + ' ' + h.textContent.trim().slice(0, 70))""")
        results['landmarks'] = await page.evaluate("""() => [...document.querySelectorAll('main,nav,aside,header,footer,section[aria-labelledby],[role=region]')]
            .map(e => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? ' "' + e.getAttribute('aria-label') + '"' : '') +
                 (e.getAttribute('aria-labelledby') ? ' "' + (document.getElementById(e.getAttribute('aria-labelledby'))?.textContent.trim().slice(0, 50) || '') + '"' : ''))""")
        results['live_regions'] = await page.evaluate("""() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map(e => (e.getAttribute('role') || '') + ' ' + (e.getAttribute('aria-live') || ''))""")
        await ctx.close()

        # ── Zoom 200% equivalents and layout integrity ───────────────────────
        zoom = []
        for (w, h, label) in [(1024, 576, '200% of 2048×1152'), (1280, 720, '200% of 2560×1440'), (1440, 900, '200% of 2880×1800'), (640, 400, '200% of 1280×800 (below supported width)')]:
            ctx, page, errs = await open_page(b, w, h, dsf=2)
            m = await page.evaluate("""() => {
              const s = document.getElementById('main-scroll');
              const dock = document.getElementById('decision-bar');
              const header = document.querySelector('header[class*="header"]');
              return { docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                       scrollerOverflowX: s.scrollWidth > s.clientWidth + 1,
                       scrollerHeight: s.clientHeight,
                       headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
                       dockHeight: dock ? Math.round(dock.getBoundingClientRect().height) : 0,
                       headerSticky: header ? getComputedStyle(header).position === 'sticky' : false,
                       scrollContainer: getComputedStyle(s).overflowY,
                       readableBand: (getComputedStyle(s).overflowY === 'visible' ? window.innerHeight : s.clientHeight) - (header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0) };
            }""")
            # tab through 60 stops checking obscured
            ob = []
            for _ in range(60):
                await page.keyboard.press('Tab')
                pr = await page.evaluate(FOCUS_PROBE)
                if pr.get('obscured') not in (None, 'none'): ob.append(pr)
            m['focus_obscured_stops'] = ob
            m['focus_entirely_obscured'] = [o for o in ob if o['obscured'] == 'entirely']
            m['label'] = label; m['errors'] = errs
            await page.screenshot(path=f'/tmp/zoom-{w}.png')
            zoom.append(m)
            await ctx.close()
        results['zoom'] = zoom

        # ── Reduced motion ───────────────────────────────────────────────────
        ctx, page, _ = await open_page(b, 1280, 800, reduced=True)
        rm = await page.evaluate("""() => {
          const btn = document.querySelector('[class*="showSource"]');
          const row = document.querySelector('[id^=event-row-]');
          return { matchMedia: matchMedia('(prefers-reduced-motion: reduce)').matches,
                   showSourceTransition: btn ? getComputedStyle(btn).transitionDuration : null,
                   rowTransition: row ? getComputedStyle(row).transitionDuration : null };
        }""")
        await page.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
        await page.wait_for_selector('[role=dialog]')
        rm['dialogAnimation'] = await page.evaluate("getComputedStyle(document.querySelector('[role=dialog]')).animationDuration")
        results['reduced_motion'] = rm
        await ctx.close()
        await b.close()

    (ROOT / 'scripts/a11y-results.json').write_text(json.dumps(results, indent=2))
    # Summary
    for k, v in results['axe'].items():
        print(f"axe {k}: {len(v['violations'])} violations {[x['id'] for x in v['violations']]}, {len(v['incomplete'])} incomplete")
    for s in results['keyboard_base']['steps']:
        print(('OK  ' if s['ok'] else 'FAIL') + ' ' + s['step'] + ('  [' + s['detail'] + ']' if s['detail'] else ''))
    stops = results['keyboard_base']['stops']
    print('focus stops checked:', len(stops), 'without outline:', [s['name'] for s in stops if s.get('outlineStyle') in (None, 'none') and not s.get('boxShadow') and s['tag'] != 'body'])
    print('focus stops obscured:', [(s['tag'], s['role'], s['name'][:30], s['obscured'], s['h']) for s in stops if s.get('obscured') not in (None, 'none')])
    for o in results['keyboard_other']: print('keyboard', o['action'], 'dialog focus:', o['focus_in_dialog_on_open'], '|', o['recorded'][:70])
    print('targets under 24px:', json.dumps(results['targets_under_24']))
    print('radio spacing:', json.dumps(results['radio_spacing']))
    for z in results['zoom']: print('zoom', z['label'], {k: z[k] for k in ('docOverflowX','scrollerOverflowX','scrollContainer','headerSticky','dockHeight','readableBand')}, 'partly:', [(o['role'] or o['tag'], o['h']) for o in z['focus_obscured_stops'] if o['obscured']=='partly'], 'entirely:', len(z['focus_entirely_obscured']))
    print('reduced motion:', results['reduced_motion'])
    print('headings:', results['headings'])
    print('landmarks:', results['landmarks'])
    print('live regions:', results['live_regions'])

asyncio.run(main())
