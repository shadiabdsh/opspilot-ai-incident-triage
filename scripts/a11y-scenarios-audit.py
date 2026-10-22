#!/usr/bin/env python3
"""
Browser accessibility audit for Phase 5 scenario states (Low confidence, Stale analysis).
Chromium + axe-core against a served build. Evidence for a manual audit, not proof of conformance.
Writes scripts/a11y-scenarios-results.json.
"""
import asyncio, json, pathlib, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4173'
URL = f'{BASE}/incidents/INC-2041'
ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
BIND = 'Bind the renewed certificate to NPS and restart the service'
VERIFY = 'Check the NPS event log directly on nps-bldga-01'
R = {'axe': {}, 'keyboard_low': [], 'keyboard_stale': [], 'focus': {}, 'reduced_motion': {}}

async def axe(pg, label):
    await pg.add_script_tag(content=AXE)
    r = await pg.evaluate("""async () => { const r = await axe.run(document, { resultTypes: ['violations', 'incomplete'] });
      const f = v => ({ id: v.id, nodes: v.nodes.length, targets: v.nodes.slice(0, 2).map(n => n.target.join(' ')) });
      return { violations: r.violations.map(f), incomplete: r.incomplete.map(f) }; }""")
    R['axe'][label] = r

async def tab_to(pg, js, limit=200, back=False):
    for _ in range(limit):
        await pg.keyboard.press('Shift+Tab' if back else 'Tab')
        if await pg.evaluate(js): return True
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        async def open_(reduced=False):
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce' if reduced else 'no-preference')
            pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_selector('#facts-heading'); await pg.wait_for_timeout(300)
            return ctx, pg

        # ── Low confidence: keyboard only ─────────────────────────────────
        ctx, pg = await open_()
        k = R['keyboard_low']
        k.append(('Reach "Low confidence" in the demo control', await tab_to(pg, "document.activeElement.textContent === 'Low confidence'")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        k.append(('Switch keeps focus on the pressed button', await pg.evaluate("document.activeElement.textContent === 'Low confidence' && document.activeElement.getAttribute('aria-pressed') === 'true'")))
        await axe(pg, 'low-default')
        k.append(('Reach the recommendation radios (Verify preselected)', await tab_to(pg, "document.activeElement.type === 'radio' && document.activeElement.checked")))
        await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(150)
        k.append(('ArrowDown selects the blocked consequential card', await pg.evaluate(f"document.activeElement.labels[0].textContent === '{BIND}'")))
        await axe(pg, 'low-blocked-card-selected')
        k.append(('Reach Approve in the dock (aria-disabled, focusable)', await tab_to(pg, "document.activeElement.textContent.trim() === 'Approve'")))
        desc = await pg.evaluate("document.getElementById(document.activeElement.getAttribute('aria-describedby')).textContent")
        k.append((f'Blocked reason is the description: "{desc}"', 'Confidence is Low' in desc))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        k.append(('Enter on blocked Approve opens nothing', await pg.evaluate("!document.querySelector('[role=dialog]')")))
        k.append(('Shift+Tab back to the radios', await tab_to(pg, "document.activeElement.type === 'radio'", back=True)))
        await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(150)
        k.append(('ArrowUp returns to Verify', await pg.evaluate(f"document.activeElement.labels[0].textContent === '{VERIFY}'")))
        await axe(pg, 'low-verify-selected')
        await tab_to(pg, "document.activeElement.textContent.trim() === 'Approve'")
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        await tab_to(pg, "document.activeElement.textContent.trim() === 'Approve' && !!document.activeElement.closest('[role=dialog]')", limit=10)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        k.append(('Verify approved by keyboard; outcome announced', await pg.evaluate("document.querySelector('[role=status]').textContent.includes('Verification task created')")))
        await tab_to(pg, "document.activeElement.textContent.trim() === 'Escalate'", limit=10, back=True)
        await pg.keyboard.press('ArrowDown')  # no-op on button; keeps state
        await pg.goto(URL); await pg.wait_for_selector('#facts-heading')
        await pg.get_by_role('button', name='Low confidence').click(); await pg.wait_for_timeout(200)
        await pg.get_by_role('radio', name=BIND).check()
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Dismiss').click(); await pg.wait_for_selector('[role=dialog]')
        await axe(pg, 'low-dismiss-dialog'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Escalate').click(); await pg.wait_for_selector('[role=dialog]')
        await axe(pg, 'low-escalate-dialog')
        await pg.get_by_label('Note for the receiving team').fill('Cannot confirm without NPS logs.')
        await pg.get_by_role('dialog').get_by_role('button', name='Escalate').click(); await pg.wait_for_timeout(300)
        await pg.get_by_role('tab', name='Audit · 1 decision').click(); await pg.get_by_role('button', name='View analysis at decision time').click()
        await axe(pg, 'low-audit-entry')
        await ctx.close()

        # ── Stale: keyboard and focus ─────────────────────────────────────
        ctx, pg = await open_()
        k = R['keyboard_stale']
        await tab_to(pg, "document.activeElement.textContent === 'Stale analysis'")
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        await axe(pg, 'stale-before-events')
        await tab_to(pg, "document.activeElement.type === 'radio'")
        before = await pg.evaluate("document.activeElement.labels[0].textContent")
        await pg.wait_for_timeout(3300)
        after = await pg.evaluate("document.activeElement.labels ? document.activeElement.labels[0].textContent : document.activeElement.tagName")
        R['focus']['events_arrival'] = {'before': before, 'after': after, 'stable': before == after}
        k.append(('Focus unchanged when events arrive', before == after))
        k.append(('Stale announced in a polite live region', await pg.evaluate("document.querySelector('[data-testid=analysis-announcer]').textContent.includes('out of date')")))
        await axe(pg, 'stale-banner')
        k.append(('Shift+Tab reaches Acknowledge in the banner', await tab_to(pg, "document.activeElement.textContent === 'Acknowledge'", back=True)))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        k.append(('Acknowledge dialog opens with focus inside', await pg.evaluate("!!document.activeElement.closest('[role=dialog]')")))
        await axe(pg, 'stale-acknowledge-dialog')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        k.append(('Escape cancels and returns focus to Acknowledge', await pg.evaluate("document.activeElement.textContent === 'Acknowledge'")))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        await tab_to(pg, "document.activeElement.textContent === 'Acknowledge and continue'", limit=10)
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        focus_ack = await pg.evaluate("({ body: document.activeElement === document.body, text: document.activeElement.textContent.slice(0, 60) })")
        R['focus']['after_acknowledge'] = focus_ack
        k.append(('After acknowledging, focus lands on the compact notice (not lost)', not focus_ack['body']))
        await axe(pg, 'stale-acknowledged')
        k.append(('Tab reaches Re-run analysis in the notice', await tab_to(pg, "document.activeElement.textContent === 'Re-run analysis'", limit=5)))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
        focus_an = await pg.evaluate("({ body: document.activeElement === document.body, text: document.activeElement.textContent.slice(0, 60) })")
        R['focus']['during_analyzing'] = focus_an
        k.append(('During re-run, focus is on the analyzing message (not lost)', not focus_an['body']))
        await axe(pg, 'stale-analyzing')
        await pg.wait_for_timeout(1700)
        focus_ref = await pg.evaluate("({ body: document.activeElement === document.body, text: document.activeElement.textContent.slice(0, 60) })")
        R['focus']['after_refresh'] = focus_ref
        k.append(('After refresh, focus is on the updated notice (not lost)', not focus_ref['body']))
        k.append(('Refresh announced', await pg.evaluate("document.querySelector('[data-testid=analysis-announcer]').textContent.includes('Analysis updated')")))
        await axe(pg, 'stale-refreshed')
        await pg.get_by_role('radio', name=BIND).check()
        k.append(('Consequential Approve available after refresh', await pg.evaluate("document.querySelector('#decision-bar button[aria-disabled=false]')?.textContent.trim() === 'Approve'")))
        await pg.get_by_role('group', name=f'Decision on: {BIND}').get_by_role('button', name='Approve').click()
        await pg.get_by_label('Type nps-bldga-01 to confirm').fill('nps-bldga-01')
        await pg.get_by_role('button', name='Approve and create change request').click(); await pg.wait_for_timeout(300)
        await pg.get_by_role('tab', name='Audit · 1 decision').click(); await pg.get_by_role('button', name='View analysis at decision time').click()
        await axe(pg, 'stale-audit')
        await ctx.close()

        # ── Reduced motion: timers still work, motion removed ─────────────
        ctx, pg = await open_(reduced=True)
        await pg.get_by_role('button', name='Stale analysis').click(); await pg.wait_for_timeout(3300)
        banner = await pg.evaluate("!!document.body.textContent.includes('new events since this analysis')")
        await pg.get_by_role('button', name='Re-run analysis').click(); await pg.wait_for_timeout(100)
        anim = await pg.evaluate("(() => { const s = document.querySelector('[class*=progress] span'); return s ? getComputedStyle(s).animationDuration : null; })()")
        dim = await pg.evaluate("(() => { const a = document.querySelector('[data-analyzing]'); return a ? getComputedStyle(a).transitionDuration : null; })()")
        await pg.wait_for_timeout(1700)
        refreshed = await pg.evaluate("!!document.body.textContent.includes('Analysis updated at')")
        R['reduced_motion'] = {'events_arrived': banner, 'progress_animation': anim, 'dim_transition': dim, 'refreshed': refreshed}
        await ctx.close(); await b.close()

    (ROOT / 'scripts/a11y-scenarios-results.json').write_text(json.dumps(R, indent=2, default=str))
    for k2, v in R['axe'].items(): print('axe', k2, len(v['violations']), [x['id'] for x in v['violations']], 'review:', sorted({x['id'] for x in v['incomplete']}))
    for name in ('keyboard_low', 'keyboard_stale'):
        for step, ok in R[name]: print('OK  ' if ok else 'FAIL', name, '|', step)
    print('focus:', R['focus']); print('reduced motion:', R['reduced_motion'])

asyncio.run(main())
