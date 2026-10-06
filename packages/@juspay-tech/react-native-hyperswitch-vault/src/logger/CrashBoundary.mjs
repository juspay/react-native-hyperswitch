/* Copied from shared/logger/src by scripts/sync-logger.mjs. Do not edit: change shared/logger and run `yarn sync:logger` in the vault package. */
import * as React from 'react';

/*
 * Wraps an SDK-owned subtree (a card field), reports a render crash inside it, then rethrows so
 * the host app's own error boundary handles it exactly as it did before this boundary existed.
 *
 * The report happens in render rather than componentDidCatch: rethrowing means this boundary
 * never commits its error state, so componentDidCatch would not run.
 */
export class CrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reported = false;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error !== null) {
      if (!this.reported) {
        this.reported = true;
        try {
          if (typeof this.props.onCrash === 'function') this.props.onCrash(error);
        } catch (_) {
          /* Reporting must not replace the original error. */
        }
      }
      throw error;
    }
    return this.props.children === undefined ? null : this.props.children;
  }
}
