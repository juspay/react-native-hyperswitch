/*
 * Logs a crash inside one of the vault's own components, then throws the same error on, so the app
 * sees exactly what it would without this boundary: the merchant's error boundary, or React Native's
 * own crash handling, takes it from here. Logging never replaces, hides or recovers from the error.
 * It logs while rendering, not in componentDidCatch (React's usual place, called once), so that the
 * error passes on unchanged: logging there means handling the error and throwing it again, which the
 * app would notice. The cost: when React renders a crashing form again before it first appears, the
 * crash is logged twice, each time with its own session_id.
 */
import * as React from 'react';

export class VaultCrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, thrown: undefined };
  }

  static getDerivedStateFromError(thrown) {
    return { crashed: true, thrown };
  }

  render() {
    if (this.state.crashed) {
      const { thrown } = this.state;
      try {
        this.props.onCrash(thrown);
      } catch (_) {
        // A failure to log must not change what is thrown.
      }
      throw thrown;
    }
    return this.props.children;
  }
}
