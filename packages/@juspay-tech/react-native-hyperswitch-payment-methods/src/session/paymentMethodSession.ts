import { createFormCore } from '../core/formCore';
import { attachCore } from '../core/formRegistry';
import { isMissingSdkError, resolveAdapter } from '../providers/registry';
import { fetchVaultDetails } from './fetchVaultDetails';
import { createFormLog } from '../logging/formLog';
import type { FormLog } from '../logging/formLog';
import {
  createLogger,
  logSessionStart,
  vaultDetailsAuthorization,
} from '../logging/logger';
import type { Logger } from '../logging/logger';
import { loggingUrl } from '../logging/loggingUrl';
import type { HyperswitchConfiguration } from './config';
import type {
  Appearance,
  CardFormInstance,
  FormStatus,
  TokenizeResult,
  VaultDetails,
} from '../core/types';

export interface PaymentMethodSessionOptions {
  sdkAuthorization?: string;
  vaultDetails?: VaultDetails;
}

export interface CreateCardFormOptions {
  appearance?: Appearance;
  readyTimeoutMs?: number;
}

export interface PaymentMethodSession {
  readonly vaultDetails: VaultDetails;
  createCardForm(options?: CreateCardFormOptions): CardFormInstance;
}

/* Logs why a detached form could not be made, then throws what was thrown, unchanged. */
function failing<T>(
  log: FormLog,
  problem: (error: unknown) => Parameters<FormLog['failed']>[0],
  make: () => T
): T {
  try {
    return make();
  } catch (error) {
    log.failed(problem(error));
    throw error;
  }
}

function createCardForm(
  vaultDetails: VaultDetails,
  logger: Logger,
  options: CreateCardFormOptions = {}
): CardFormInstance {
  const log = createFormLog(logger);
  log.created();

  const adapter = failing(
    log,
    (error) =>
      isMissingSdkError(error) ? 'missing_provider_package' : 'no_adapter',
    () => resolveAdapter(vaultDetails.vaultType)
  );

  if (!adapter.createCollector) {
    log.failed('detached_unsupported');
    throw new Error(
      `The ${vaultDetails.vaultType} SDK builds its client from a React provider, so its ` +
        'fields cannot be mounted detached. Use <HyperPaymentMethodSession> with <CardForm> ' +
        'for this vault.'
    );
  }

  const data = failing(
    log,
    () => 'invalid_vault_data',
    () => adapter.validateVaultData(vaultDetails.vaultData)
  );
  const core = createFormCore(
    adapter,
    options.appearance ? [options.appearance] : [],
    options.readyTimeoutMs,
    log
  );

  log.providerStarting(options.readyTimeoutMs);
  adapter.createCollector(data).then(
    (collector) => {
      core.collector = collector;
      core.session.attachCollector(collector);
      core.status = 'ready';
      log.ready(collector, core.vaultType);
      core.notify();
    },
    (error: unknown) => {
      core.session.fail(error);
      core.status = 'error';
      log.failed('provider_failed');
      core.notify();
    }
  );

  const instance: CardFormInstance = {
    tokenize: (providerData?: unknown): Promise<TokenizeResult> =>
      core.tokenize(providerData),
    get status(): FormStatus {
      return core.status;
    },
  };

  attachCore(instance, core);
  return instance;
}

/* The session's logger, as HyperPaymentMethodSession makes one: the merchant and session named,
   then web's PAYMENT_METHOD_SESSION_INITIATED, or the parameter that is missing. A configuration
   too malformed to read gets a logger that sends nothing, so logging never stops the session. */
function sessionLogger(
  config: HyperswitchConfiguration,
  options: PaymentMethodSessionOptions
): Logger {
  try {
    const logger = createLogger(
      loggingUrl(config.environment, config.customEndpoints)
    );
    logger.identify(
      options.sdkAuthorization ||
        vaultDetailsAuthorization(options.vaultDetails),
      config.publishableKey
    );
    logSessionStart(
      logger,
      'initPaymentMethodSession',
      Boolean(options.sdkAuthorization || options.vaultDetails)
    );
    return logger;
  } catch {
    return createLogger(undefined);
  }
}

export async function initPaymentMethodSession(
  config: HyperswitchConfiguration,
  options: PaymentMethodSessionOptions
): Promise<PaymentMethodSession> {
  const logger = sessionLogger(config, options);
  const resolved = options.vaultDetails
    ? { ok: true as const, vaultDetails: options.vaultDetails }
    : options.sdkAuthorization
      ? await fetchVaultDetails({
          sdkAuthorization: options.sdkAuthorization,
          environment: config.environment,
          customEndpoints: config.customEndpoints,
          log: logger,
        })
      : {
          ok: false as const,
          message:
            'initPaymentMethodSession needs sdkAuthorization or vaultDetails.',
        };

  if (!resolved.ok) throw new Error(resolved.message);

  const vaultDetails = resolved.vaultDetails;
  return {
    vaultDetails,
    createCardForm: (formOptions?: CreateCardFormOptions) =>
      createCardForm(vaultDetails, logger, formOptions),
  };
}
