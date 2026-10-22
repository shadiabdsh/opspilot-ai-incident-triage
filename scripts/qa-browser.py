#!/usr/bin/env python3
"""
Phase 7 browser QA for OpsPilot (Playwright + Chromium).

Covers what the accessibility scripts do not: complete end-to-end workflows (pointer and
keyboard-only from page load), a focus-not-obscured sweep of every Tab stop in every state,
responsive checks, 200% zoom equivalents, reduced motion (including Show source scrolling),
routes and refresh, assets, and console output. Run against the production build for
runtime/asset checks, and against the dev server (--dev) to catch React warnings.

Usage: python3 scripts/qa-browser.py http://localhost:4173 [--dev]
Writes scripts/qa-results[-dev].json. Evidence for QA, not proof of conformance.
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith('http')), 'http://localhost:4173')
DEV = '--dev' in sys.argv
ROOT = pathlib.Path(__file__).resolve().parent.parent
INC = '12 endpoints offline in Building A'
BIND = 'Bind the renewed certificate to NPS and restart the service'
VERIFY = 'Check the NPS event log directly on nps-bldga-01'
NOTIFY = 'Notify Building A users about the network outage'
R = {'workflows': {}, 'focus_sweep': [], 'responsive': [], 'zoom': [], 'reduced_motion': {}, 'routes': [], 'console': [], 'titles': {}}

# Probe: is the focused element visible, outlined, and not hidden by sticky UI?
PROBE = """() => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { body: true };
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  // Hit-test what is actually painted at points across the control (handles z-order and sticky UI).
  const pts = []; const inset = 2;
  for (const fx of [0.5, 0.15, 0.85]) for (const fy of [0.5, 0.2, 0.8]) pts.push([r.left + Math.max(inset, r.width * fx), r.top + Math.max(inset, r.height * fy)]);
  let hits = 0;
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit))) hits++;
  }
  // A container taller than the viewport (the tab panel) can never fit; WCAG 2.4.11 asks only that it
  // is not entirely hidden, so judge it by whether any part is inside the visible area.
  if (r.height > innerHeight * 0.8) {
    const s = document.getElementById('main-scroll'); const band = s ? s.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    hits = (r.bottom > band.top && r.top < band.bottom) ? pts.length : 0;
  }
  return { name: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 48),
           tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), tall: r.height > innerHeight * 0.8,
           outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2, fraction: +(hits / pts.length).toFixed(2) };
}"""

def watch(page, label):
    def on_console(m):
        if m.type in ('error', 'warning'):
            R['console'].append({'where': label, 'type': m.type, 'text': m.text[:300]})
    page.on('console', on_console)
    page.on('pageerror', lambda e: R['console'].append({'where': label, 'type': 'pageerror', 'text': str(e)[:300]}))
    page.on('requestfailed', lambda req: R['console'].append({'where': label, 'type': 'requestfailed', 'text': req.url}))
    page.on('response', lambda res: res.status >= 400 and R['console'].append({'where': label, 'type': f'http {res.status}', 'text': res.url}))

async def new_page(b, label, w=1280, h=800, dsf=1, reduced=False, path='/incidents/INC-2041'):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, reduced_motion='reduce' if reduced else 'no-preference')
    pg = await ctx.new_page(); watch(pg, label)
    await pg.goto(BASE + path); await pg.wait_for_load_state('networkidle'); await pg.wait_for_timeout(300)
    return ctx, pg

async def tab_to(pg, js, limit=250, back=False):
    for _ in range(limit):
        await pg.keyboard.press('Shift+Tab' if back else 'Tab')
        if await pg.evaluate(js): return True
    return False

async def sweep(pg, label, limit=200):
    """Tab through every stop; record any focus that is lost, unoutlined or obscured; detect traps."""
    seen, issues, count = [], [], 0
    first = None
    for _ in range(limit):
        await pg.keyboard.press('Tab'); count += 1
        p = await pg.evaluate(PROBE)
        key = json.dumps(p.get('name')) + str(p.get('tag'))
        if first is None: first = key
        elif key == first and count > 3: break  # wrapped around
        seen.append(key)
        if p.get('body'):  # Tab left the page after the last control: the wrap point
            if count > 3: break
            continue
        if not p['outline']: issues.append({'issue': 'no visible outline', **p})
        if p['fraction'] == 0: issues.append({'issue': 'entirely obscured', **p})
        elif p['fraction'] < 1 and not p['tall']: issues.append({'issue': 'partly obscured', **p})
    R['focus_sweep'].append({'state': label, 'stops': count, 'unique': len(set(seen)), 'issues': issues})

async def layout(pg, label):
    """Overflow, clipping, off-viewport controls and dialog fit."""
    m = await pg.evaluate("""() => {
      const out = { docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
      const s = document.getElementById('main-scroll'); out.scrollerOverflowX = s ? s.scrollWidth > s.clientWidth + 1 : false;
      out.offViewport = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=tab]')]
        .filter(e => e.offsetParent !== null).map(e => ({ n: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), r: e.getBoundingClientRect() }))
        .filter(x => x.r.right > innerWidth + 1 || x.r.left < -1).map(x => x.n);
      // Text clipped by overflow:hidden (excluding deliberate one-line truncations, which carry the full text).
      const intentional = el => el.closest('[title]') || /oneLine|impact|message|samp/i.test(el.className + ' ' + (el.parentElement?.className || ''));
      out.clipped = [...document.querySelectorAll('body *')].filter(el => {
        if (!el.offsetParent || el.children.length > 0) return false;
        const rect = el.getBoundingClientRect(); if (rect.width <= 1 || rect.height <= 1) return false; // visually hidden by design
        if (el.closest('.visually-hidden, caption')) return false;
        const cs = getComputedStyle(el); if (cs.overflow === 'visible' && cs.overflowX === 'visible') return false;
        return (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && el.textContent.trim().length > 0 && !intentional(el);
      }).map(el => el.textContent.trim().slice(0, 40));
      const d = document.querySelector('[role=dialog]');
      if (d) { const r = d.getBoundingClientRect(); out.dialog = { fits: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, scrollable: d.scrollHeight > d.clientHeight ? getComputedStyle(d).overflowY : 'not needed' }; }
      const bar = document.getElementById('decision-bar'); const scroller = document.getElementById('main-scroll');
      if (bar && scroller && getComputedStyle(scroller).overflowY !== 'visible') { out.dockOverlapsScrollArea = scroller.getBoundingClientRect().bottom > bar.getBoundingClientRect().top + 1; }
      return out;
    }""")
    R['responsive' if 'zoom' not in label else 'zoom'].append({'state': label, **m})

async def approve_bind(pg):
    await pg.get_by_role('radio', name=BIND).check()
    await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
    await pg.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-01')
    await pg.get_by_role('button', name='Approve and create change request').click(); await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ── 1A. Base workflow, pointer, from the Dashboard ─────────────────
        steps = []
        ctx, pg = await new_page(b, 'base-pointer', path='/')
        R['titles']['dashboard'] = await pg.title()
        await pg.get_by_role('link', name=INC).click(); await pg.wait_for_selector('#facts-heading')
        R['titles']['incident'] = await pg.title()
        steps.append(('Dashboard → open INC-2041', await pg.evaluate(f"document.querySelector('h1').textContent === '{INC}'")))
        steps.append(('Observed facts and AI summary present', await pg.evaluate("!!document.getElementById('facts-heading') && document.body.textContent.includes('Summary')")))
        hyp = pg.locator('article').filter(has_text='Primary hypothesis').first
        ev = hyp.locator('li').filter(has_text='06:08:50').first
        await ev.hover(); await pg.wait_for_timeout(150)
        steps.append(('Hover traces evidence → event', await pg.evaluate("document.getElementById('event-row-ev-nps-failures-12').hasAttribute('data-active')")))
        await ev.get_by_role('button', name='Show source: 06:08:50, nps-bldga-01').click(); await pg.wait_for_timeout(800)
        steps.append(('Show source focuses the event', await pg.evaluate("document.activeElement.id === 'event-row-ev-nps-failures-12'")))
        await pg.get_by_role('button', name='Back to evidence').click(); await pg.wait_for_timeout(200)
        steps.append(('Back to evidence returns focus', await pg.evaluate("document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'")))
        await approve_bind(pg)
        steps.append(('Approve with typed confirmation records', await pg.evaluate("document.querySelector('[role=status]').textContent.includes('CHG-5521')")))
        await pg.get_by_role('button', name='View in audit trail').click(); await pg.get_by_role('button', name='View analysis at decision time').click(); await pg.wait_for_timeout(200)
        steps.append(('Audit shows the decision with frozen analysis', await pg.evaluate("document.body.textContent.includes('Frozen at 06:11')")))
        await pg.get_by_role('link', name='Dashboard').click(); await pg.wait_for_selector('#queue-heading'); await pg.wait_for_timeout(400)
        steps.append(('Dashboard shows Decided and announces it', await pg.evaluate(f"""(() => {{ const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes('{INC}'));
            return row.textContent.includes('Decided') && [...document.querySelectorAll('[aria-live=polite]')].some(e => e.textContent.includes('Decided')); }})()""")))
        R['workflows']['base_pointer'] = steps; await ctx.close()

        # ── 1B. Base workflow, keyboard only, from page load ───────────────
        steps = []
        ctx, pg = await new_page(b, 'base-keyboard', path='/')
        await pg.keyboard.press('Tab')
        steps.append(('First Tab reaches "Skip to content"', await pg.evaluate("document.activeElement.textContent.trim() === 'Skip to content'")))
        steps.append(('Sidebar Dashboard link reachable', await tab_to(pg, "document.activeElement.textContent.trim() === 'Dashboard'", 5)))
        steps.append(('INC-2041 title link reachable', await tab_to(pg, f"document.activeElement.textContent.trim() === '{INC}'", 20)))
        await pg.keyboard.press('Enter'); await pg.wait_for_selector('#facts-heading'); await pg.wait_for_timeout(300)
        after_nav = await pg.evaluate("({ tag: document.activeElement.tagName, text: (document.activeElement.textContent || '').trim().slice(0, 40) })")
        R['workflows']['focus_after_route_change'] = after_nav
        steps.append(('Systems group toggle by keyboard', await tab_to(pg, "document.activeElement.tagName === 'BUTTON' && document.activeElement.textContent.includes('Building A workstations')")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(100)
        steps.append(('  …expands', await pg.evaluate("document.activeElement.getAttribute('aria-expanded') === 'true'")))
        steps.append(('Summary Inferred toggle by keyboard', await tab_to(pg, "(document.activeElement.getAttribute('aria-label') || '').startsWith('Inferred by AI')")))
        steps.append(('Show source by keyboard', await tab_to(pg, "document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
        steps.append(('  …focus on source event', await pg.evaluate("document.activeElement.id === 'event-row-ev-nps-failures-12'")))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        steps.append(('  …Escape returns to evidence', await pg.evaluate("document.activeElement.getAttribute('aria-label') === 'Show source: 06:08:50, nps-bldga-01'")))
        steps.append(('Recommendation radio by keyboard', await tab_to(pg, "document.activeElement.type === 'radio'")))
        steps.append(('Approve in the dock by keyboard', await tab_to(pg, "document.activeElement.textContent.trim() === 'Approve' && !!document.activeElement.closest('#decision-bar')")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300); await pg.keyboard.type('nps-bldga-01')
        await tab_to(pg, "document.activeElement.textContent.trim() === 'Approve and create change request'", 10)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        steps.append(('Typed confirmation recorded; focus on confirmation', await pg.evaluate("!!document.activeElement.closest('[role=status]') && document.activeElement.textContent.includes('CHG-5521')")))
        await tab_to(pg, "document.activeElement.textContent.trim() === 'View in audit trail'", 5)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        steps.append(('Audit expand by keyboard', await tab_to(pg, "document.activeElement.tagName === 'BUTTON' && document.activeElement.textContent.includes('View analysis at decision time')", 40)))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        steps.append(('Back to Dashboard by keyboard (Shift+Tab to sidebar)', await tab_to(pg, "document.activeElement.textContent.trim() === 'Dashboard' && !!document.activeElement.closest('aside')", 120, back=True)))
        await pg.keyboard.press('Enter'); await pg.wait_for_selector('#queue-heading'); await pg.wait_for_timeout(400)
        steps.append(('Decided visible on Dashboard', await pg.evaluate(f"[...document.querySelectorAll('tr')].find(r => r.textContent.includes('{INC}')).textContent.includes('Decided')")))
        R['workflows']['base_keyboard'] = steps; await ctx.close()

        # ── 2. Low confidence (keyboard where it matters) ──────────────────
        steps = []
        ctx, pg = await new_page(b, 'low')
        await pg.get_by_role('button', name='Low confidence').click(); await pg.wait_for_timeout(300)
        steps.append(('Missing NPS source stated in Observed facts', await pg.evaluate("document.querySelector('section[aria-labelledby=facts-heading]').textContent.includes('NPS event log: not retrieved')")))
        steps.append(('Unknown stated with reason', await pg.evaluate("document.body.textContent.includes('Reason: The NPS event log could not be retrieved')")))
        steps.append(('Both hypotheses Low', await pg.evaluate("[...document.querySelectorAll('[role=group][aria-label=\"Confidence: Low\"]')].length === 2")))
        await pg.get_by_role('radio', name=BIND).check()
        # force: a real click on an aria-disabled control (Playwright skips "disabled" targets by default).
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click(force=True); await pg.wait_for_timeout(200)
        steps.append(('Blocked Approve opens nothing', await pg.evaluate("!document.querySelector('[role=dialog]')")))
        steps.append(('Blocked reason visible in dock', await pg.evaluate("document.getElementById('decision-bar').textContent.includes('Confidence is Low. Verify the cause first.')")))
        await pg.get_by_role('radio', name=VERIFY).check()
        await pg.get_by_role('group', name=f'Decision on: {VERIFY}').get_by_role('button', name='Approve').click()
        await pg.get_by_role('dialog').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(300)
        await pg.get_by_role('radio', name=BIND).check()
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Dismiss').click()
        await pg.get_by_role('dialog').get_by_role('radio', name='Other').check(); await pg.get_by_label('Details (required)').fill('Waiting for the NPS check')
        await pg.get_by_role('button', name='Dismiss recommendation').click(); await pg.wait_for_timeout(300)
        await pg.get_by_role('radio', name=NOTIFY).check()
        await pg.get_by_role('group', name=f'Decision on: {NOTIFY}').get_by_role('button', name='Escalate').click()
        await pg.get_by_label('Note for the receiving team').fill('Please coordinate the user notice.')
        await pg.get_by_role('dialog').get_by_role('button', name='Escalate').click(); await pg.wait_for_timeout(300)
        tab = await pg.get_by_role('tab', name='Audit · 3 decisions').count()
        steps.append(('Verify, Dismiss, Escalate = exactly 3 decisions (blocked attempt wrote none)', tab == 1))
        await pg.get_by_role('tab', name='Audit · 3 decisions').click(); await pg.wait_for_timeout(200)
        steps.append(('Audit records Other reason and team/note', await pg.evaluate("document.body.textContent.includes('Other: Waiting for the NPS check') && document.body.textContent.includes('Escalated to Identity & Access')")))
        R['workflows']['low'] = steps; await ctx.close()

        # ── 3. Stale, twice, for determinism ───────────────────────────────
        transcripts = []
        for run_no in (1, 2):
            steps = []
            ctx, pg = await new_page(b, f'stale-run{run_no}')
            await pg.get_by_role('button', name='Stale analysis').click(); await pg.wait_for_timeout(3400)
            steps.append(('Banner after late events', await pg.evaluate("document.body.textContent.includes('3 new events since this analysis (06:11).')")))
            steps.append(('3 events marked New since analysis', await pg.evaluate("[...document.querySelectorAll('section[aria-labelledby=facts-heading] *')].filter(e => e.children.length === 0 && e.textContent === 'New since analysis').length === 3")))
            await pg.get_by_role('button', name='Acknowledge').click(); await pg.get_by_role('button', name='Acknowledge and continue').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('radio', name=BIND).check(); await pg.wait_for_timeout(150)
            steps.append(('Consequential still blocked after acknowledge', await pg.evaluate("document.getElementById('decision-bar').textContent.includes('Re-run required: consequential actions need fresh analysis.')")))
            await pg.get_by_role('radio', name=NOTIFY).check()
            await pg.get_by_role('group', name=f'Decision on: {NOTIFY}').get_by_role('button', name='Approve').click()
            await pg.get_by_role('dialog').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(300)
            await pg.get_by_role('button', name='Re-run analysis').click(); await pg.wait_for_timeout(200)
            steps.append(('Analyzing state', await pg.evaluate("document.body.textContent.includes('Re-running analysis with the 3 new events')")))
            await pg.wait_for_timeout(1700)
            # The refresh is stamped after the earlier decision by the logical clock (06:17 in this path).
            steps.append(('Refreshed', await pg.evaluate("/Analysis updated at 06:1\\d\\./.test(document.body.textContent)")))
            await approve_bind(pg)
            await pg.get_by_role('tab', name='Audit · 2 decisions').click(); await pg.wait_for_timeout(200)
            lines = await pg.evaluate("[...document.querySelectorAll('[role=tabpanel][data-state=active] ol > li')].map(li => li.innerText.replace(/\\s+/g, ' ').slice(0, 90))")
            times = await pg.evaluate("[...document.querySelectorAll('[role=tabpanel][data-state=active] ol > li time')].map(t => t.getAttribute('datetime'))")
            steps.append(('Audit times strictly decrease (newest first)', all(times[i] > times[i + 1] for i in range(len(times) - 1))))
            await pg.get_by_role('button', name='View analysis at decision time').first.click(); await pg.wait_for_timeout(200)
            steps.append(('Final snapshot is the re-run analysis', await pg.evaluate("document.body.textContent.includes('demo-fixture-v2')")))
            transcripts.append(lines)
            R['workflows'][f'stale_run{run_no}'] = steps; await ctx.close()
        R['workflows']['stale_deterministic'] = [('Two runs produce identical audit transcripts', transcripts[0] == transcripts[1])]
        R['stale_transcript'] = transcripts[0]

        # ── 4/5. Focus-not-obscured sweep in every state, at three widths ──
        for w, h in [(1024, 768), (1280, 800), (1440, 900)]:
            ctx, pg = await new_page(b, f'sweep-{w}', w, h, path='/')
            await sweep(pg, f'Dashboard {w}')
            await pg.get_by_role('button', name='Preview source alerts').click(); await pg.get_by_role('button', name='View all 12 source alerts').click(); await pg.wait_for_timeout(300)
            await sweep(pg, f'Source-alert panel {w}', 40); await layout(pg, f'Source-alert panel {w}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200); await layout(pg, f'Dashboard {w}')
            await pg.goto(BASE + '/incidents/INC-2041'); await pg.wait_for_selector('#facts-heading'); await pg.wait_for_timeout(300)
            await sweep(pg, f'Incident Base {w}'); await layout(pg, f'Incident Base {w}')
            await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(300)
            await sweep(pg, f'Confirmation dialog {w}', 30); await layout(pg, f'Confirmation dialog {w}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            await pg.get_by_role('button', name='Low confidence').click(); await pg.wait_for_timeout(300)
            await sweep(pg, f'Low confidence {w}'); await layout(pg, f'Low confidence {w}')
            await pg.get_by_role('button', name='Stale analysis').click(); await pg.wait_for_timeout(3400)
            await sweep(pg, f'Stale banner {w}'); await layout(pg, f'Stale banner {w}')
            await pg.get_by_role('button', name='Re-run analysis').click(); await pg.wait_for_timeout(1900)
            await approve_bind(pg)
            await pg.get_by_role('tab', name='Audit · 1 decision').click(); await pg.get_by_role('button', name='View analysis at decision time').click(); await pg.wait_for_timeout(200)
            await sweep(pg, f'Audit long snapshot {w}'); await layout(pg, f'Audit long snapshot {w}')
            await ctx.close()

        # ── 9. 200% zoom equivalents ───────────────────────────────────────
        for w, h, label in [(1024, 576, '2048x1152'), (1280, 720, '2560x1440'), (1440, 900, '2880x1800'), (640, 400, '1280x800 (below scope)')]:
            ctx, pg = await new_page(b, f'zoom-{label}', w, h, dsf=2)
            await sweep(pg, f'zoom {label} Incident'); await layout(pg, f'zoom {label} Incident')
            await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(300)
            await sweep(pg, f'zoom {label} dialog', 30); await layout(pg, f'zoom {label} dialog')
            await pg.keyboard.press('Escape')
            await pg.goto(BASE + '/'); await pg.wait_for_selector('#queue-heading'); await pg.wait_for_timeout(300)
            await layout(pg, f'zoom {label} Dashboard')
            await ctx.close()

        # ── 10. Reduced motion ─────────────────────────────────────────────
        ctx, pg = await new_page(b, 'reduced', reduced=True)
        await pg.evaluate("""() => { window.__scrolls = []; const o = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function (opts) { window.__scrolls.push(opts && opts.behavior); return o.call(this, opts); }; }""")
        hyp = pg.locator('article').filter(has_text='Primary hypothesis').first
        ev = hyp.locator('li').filter(has_text='06:08:50').first
        await ev.hover()
        rm = {'evidence_transition': await ev.evaluate("e => getComputedStyle(e).transitionDuration")}
        await ev.get_by_role('button', name='Show source: 06:08:50, nps-bldga-01').click(); await pg.wait_for_timeout(300)
        rm['show_source_scroll_behavior'] = await pg.evaluate("window.__scrolls")
        await pg.get_by_role('button', name='Back to evidence').click()
        await pg.get_by_role('button', name='Show details: Verify the renewed certificate chain before binding').click()
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click(); await pg.wait_for_timeout(200)
        rm['dialog_animation'] = await pg.evaluate("getComputedStyle(document.querySelector('[role=dialog]')).animationDuration")
        await pg.keyboard.press('Escape')
        await pg.get_by_role('button', name='Stale analysis').click(); await pg.wait_for_timeout(3400)
        rm['late_events_still_arrive'] = await pg.evaluate("document.body.textContent.includes('new events since this analysis')")
        await pg.get_by_role('button', name='Re-run analysis').click(); await pg.wait_for_timeout(150)
        rm['progress_animation'] = await pg.evaluate("(() => { const s = document.querySelector('[class*=progress] span'); return s && getComputedStyle(s).animationDuration; })()")
        await pg.wait_for_timeout(1700)
        rm['refresh_completes'] = await pg.evaluate("document.body.textContent.includes('Analysis updated at')")
        await pg.goto(BASE + '/'); await pg.wait_for_selector('#queue-heading')
        await pg.get_by_role('button', name='Preview source alerts').click(); await pg.get_by_role('button', name='View all 12 source alerts').click(); await pg.wait_for_timeout(200)
        rm['source_panel_animation'] = await pg.evaluate("getComputedStyle(document.querySelector('[role=dialog]')).animationDuration")
        await pg.keyboard.press('Escape')
        rm['dashboard_row_transition'] = await pg.evaluate("getComputedStyle(document.querySelector('tbody tr > th')).transitionDuration")
        R['reduced_motion'] = rm; await ctx.close()

        # ── 14. Routes, refresh, assets ────────────────────────────────────
        ctx, pg = await new_page(b, 'routes', path='/')
        for path, expect in [('/', 'Operations'), ('/incidents/INC-2041', INC), ('/incidents/INC-2041?tab=audit', INC), ('/incidents/INC-9999', 'Incident not available'), ('/no-such-page', 'Page not found')]:
            resp = await pg.goto(BASE + path); await pg.wait_for_timeout(300)
            h1 = await pg.evaluate("document.querySelector('h1')?.textContent")
            await pg.reload(); await pg.wait_for_timeout(300)
            h1_reload = await pg.evaluate("document.querySelector('h1')?.textContent")
            R['routes'].append({'path': path, 'status': resp.status if resp else None, 'h1': h1, 'h1_after_reload': h1_reload, 'ok': h1 == expect == h1_reload, 'title': await pg.title()})
        await ctx.close()

        # Timer cleanup: switch scenarios rapidly and leave the page mid-timer.
        ctx, pg = await new_page(b, 'timers')
        for s in ['Stale analysis', 'Base', 'Stale analysis', 'Low confidence', 'Stale analysis']:
            await pg.get_by_role('button', name=s).click(); await pg.wait_for_timeout(150)
        await pg.get_by_role('link', name='Dashboard').click(); await pg.wait_for_timeout(3500)
        await pg.get_by_role('link', name='Incidents').click(); await pg.wait_for_timeout(500)
        R['timers'] = {'new_since_labels (expect 3, arrived once)': await pg.evaluate("[...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent === 'New since analysis').length"),
                       'events_arrived_audit_lines (expect 1)': await pg.evaluate("0")}
        await pg.get_by_role('tab', name='Audit').click(); await pg.wait_for_timeout(200)
        R['timers']['events_arrived_audit_lines (expect 1)'] = await pg.evaluate("[...document.querySelectorAll('[data-event=events_arrived]')].length")
        await ctx.close()
        await b.close()

    out = ROOT / ('scripts/qa-results-dev.json' if DEV else 'scripts/qa-results.json')
    out.write_text(json.dumps(R, indent=2, default=str))
    for k, v in R['workflows'].items():
        if isinstance(v, list):
            for s, ok in v: print('OK  ' if ok else 'FAIL', k, '|', s)
    print('focus after route change:', R['workflows'].get('focus_after_route_change'))
    for f in R['focus_sweep']:
        if f['issues']: print('FOCUS', f['state'], f['stops'], 'stops;', f['issues'][:4])
    print('focus sweeps:', len(R['focus_sweep']), 'states;', sum(f['stops'] for f in R['focus_sweep']), 'stops; with issues:', [f['state'] for f in R['focus_sweep'] if f['issues']])
    for r in R['responsive'] + R['zoom']:
        bad = r['docOverflowX'] or r['scrollerOverflowX'] or r['offViewport'] or r['clipped'] or (r.get('dialog') and not r['dialog']['fits']) or r.get('dockOverlapsScrollArea')
        if bad: print('LAYOUT', r)
    print('layout checks:', len(R['responsive']) + len(R['zoom']))
    print('reduced motion:', R['reduced_motion'])
    for r in R['routes']: print('ROUTE', r)
    print('titles:', R['titles']); print('timers:', R['timers'])
    print('console:', len(R['console'])); [print('  ', c) for c in R['console'][:20]]

asyncio.run(main())
