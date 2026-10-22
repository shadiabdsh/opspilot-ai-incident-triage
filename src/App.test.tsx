import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from './App';

describe('App routes', () => {
  it('"/" shows the Operations Dashboard with a link to the scripted incident', () => {
    render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '12 endpoints offline in Building A' })).toHaveAttribute('href', '/incidents/INC-2041');
  });

  it('an unknown incident explains that only INC-2041 is scripted', () => {
    render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-9999']}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Incident not available' })).toBeInTheDocument();
  });
});

describe('Route accessibility (Phase 7)', () => {
  it('gives every route a descriptive page title (WCAG 2.4.2)', async () => {
    const { unmount } = render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/']}><AppRoutes /></MemoryRouter>);
    await waitFor(() => expect(document.title).toBe('Operations – OpsPilot'));
    unmount();
    render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/incidents/INC-2041']}><AppRoutes /></MemoryRouter>);
    await waitFor(() => expect(document.title).toBe('12 endpoints offline in Building A (INC-2041) – OpsPilot'));
  });

  it('moves focus to the new page heading after navigation, but not on first load or tab changes', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={ROUTER_FUTURE} initialEntries={['/']}><AppRoutes /></MemoryRouter>);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(document.body); // first load: untouched

    await user.click(screen.getByRole('link', { name: '12 endpoints offline in Building A' }));
    const h1 = screen.getByRole('heading', { level: 1, name: '12 endpoints offline in Building A' });
    await waitFor(() => expect(h1).toHaveFocus());

    await user.click(screen.getByRole('tab', { name: 'Audit' })); // search-param change only
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(screen.getByRole('tab', { name: 'Audit' })).toHaveFocus();

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Operations' })).toHaveFocus());
  });

  it('does not move focus on first load under StrictMode (effects run twice in development)', async () => {
    render(
      <StrictMode>
        <MemoryRouter future={ROUTER_FUTURE} initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </StrictMode>,
    );
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement).toBe(document.body);
  });
});
