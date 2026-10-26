/**
 * HYDRO MATRIX: Modal Dismissal Accessibility Hook
 *
 * Command center overlays (scenario comparison, evacuation advisory, SitRep,
 * GMDA narrative, relief camp planner, emergency helpline) were previously
 * dismissable only by locating their close control. This hook registers a
 * window-level Escape listener for as long as an overlay is open, matching the
 * keyboard affordance the OnboardingTour already provided.
 */

'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Dismiss the active overlay when Escape is pressed.
 *
 * @param onDismiss Invoked when Escape is pressed while `enabled` is true.
 * @param enabled   Pass the overlay open test so only the mounted overlay listens.
 */
export function useEscapeDismiss(onDismiss: () => void, enabled: boolean): void {
  // Held in a ref so an inline arrow callback does not re-register the listener
  // on every render.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

/**
 * Build a backdrop click handler that dismisses only on a genuine backdrop
 * press, never on a click that bubbled up from the panel content.
 */
export function useBackdropDismiss(
  onDismiss: () => void,
): (event: React.MouseEvent<HTMLElement>) => void {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  return (event: React.MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) {
      dismissRef.current();
    }
  };
}
