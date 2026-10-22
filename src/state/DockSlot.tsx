/**
 * The reserved dock zone at the bottom of the workspace. Screens portal their decision
 * surface into it; when nothing is portaled, the zone collapses to zero height.
 */
import { createContext, useContext } from 'react';

export const DockSlotContext = createContext<HTMLElement | null>(null);
export const useDockSlot = () => useContext(DockSlotContext);
