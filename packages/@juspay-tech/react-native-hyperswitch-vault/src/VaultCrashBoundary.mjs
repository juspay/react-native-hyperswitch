/*
 * Logs a crash inside one of the vault's own components, then throws the same error on, so the app
 * sees exactly what it would without this boundary: the merchant's error boundary, or React Native's
 * own crash handling, takes it from here. Logging never replaces, hides or recovers from the error.
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
