/**
 * Routes: "/" is the Operations Dashboard, "/incidents/:id" is Incident Detail.
 * Development-only routes: /dev/gallery (signature components) and /dev/foundation.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/supporting/AppShell/AppShell';
import { DashboardScreen } from './screens/DashboardScreen';
import { DashboardMemoryProvider } from './state/DashboardMemory';
import { RouteEffects } from './state/RouteEffects';
import { IncidentDetailScreen } from './screens/IncidentDetailScreen';
import { StoreProvider } from './state/StoreProvider';

const Gallery = import.meta.env.DEV ? lazy(() => import('./dev/Gallery')) : null;
const FoundationCheck = import.meta.env.DEV
  ? lazy(() => import('./dev/FoundationCheck').then((m) => ({ default: m.FoundationCheck })))
  : null;

export function AppRoutes() {
  return (
    <StoreProvider>
      <DashboardMemoryProvider>
        <RouteEffects />
        <Routes>
          <Route path="/" element={<AppShell><DashboardScreen /></AppShell>} />
          <Route path="/incidents/:incidentId" element={<AppShell><IncidentDetailScreen /></AppShell>} />
          {Gallery && (
            <Route path="/dev/gallery" element={<Suspense fallback={<p>Loading gallery…</p>}><Gallery /></Suspense>} />
          )}
          {FoundationCheck && (
            <Route path="/dev/foundation" element={<Suspense fallback={null}><FoundationCheck /></Suspense>} />
          )}
          <Route
            path="*"
            element={
              <AppShell>
                <div style={{ padding: 'var(--space-8) var(--space-6)' }}>
                  <h1>Page not found</h1>
                  <p>
                    <Link to="/">Back to Operations</Link>
                  </p>
                </div>
              </AppShell>
            }
          />
        </Routes>
      </DashboardMemoryProvider>
    </StoreProvider>
  );
}

/** Opt in to React Router v7 behaviour now (removes its runtime deprecation warnings). */
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

export function App() {
  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <AppRoutes />
    </BrowserRouter>
  );
}
