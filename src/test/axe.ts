import axe from 'axe-core';

/**
 * Runs axe on a rendered container. Colour contrast is skipped because jsdom has no
 * layout or computed colours; contrast is checked manually in phase 7.
 * `alsoDisable` is for documented, surface-specific exceptions only.
 */
export async function expectNoAxeViolations(container: Element, alsoDisable: string[] = []): Promise<void> {
  const rules: Record<string, { enabled: boolean }> = {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  };
  for (const id of alsoDisable) rules[id] = { enabled: false };
  const results = await axe.run(container, { rules });
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
  expect(summary).toEqual([]);
}
