// Export types
export type {
  ClickToPayConfig,
  ClickToPayCard,
  ClickToPayError,
  PaymentRequest,
  PaymentResult,
} from './types';

// Export Provider and hook
export { ClickToPayProvider, useClickToPay } from './ClickToPayProvider';

// Export Component (for advanced use cases)
export { default as ClickToPayComponent } from './ClickToPayComponent';
export type {
  ClickToPayComponentRef,
  ClickToPayComponentProps,
} from './ClickToPayComponent';
