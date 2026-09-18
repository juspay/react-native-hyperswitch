import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFormBinding } from './useFormBinding';
import { resolveFieldStyles } from '../core/appearance';
import {
  CARD_BRAND_ICONS,
  CVC_ICONS,
  pickAllowed,
  pickString,
  pickStringArray,
} from '../core/validate';
import type {
  CvcIconDisplay,
  ElementType,
  FieldChange,
  FieldHandle,
  FieldOptions,
} from '../core/types';
import { Placeholder } from './Placeholder';
import type { FieldProps } from './types';

type AliasProps = FieldProps & { cvcIcon?: CvcIconDisplay };

export function createCardField<P extends FieldProps = FieldProps>(
  elementType: ElementType,
  displayName: string
) {
  const CardField = forwardRef<FieldHandle, P>((props, ref) => {
    const fieldRef = useRef<FieldHandle | null>(null);
    const {
      form,
      onChange,
      onReady,
      onFocus,
      onBlur,
      options,
      styles: ownStyles,
      placeholder: ownPlaceholder,
      cvcIcon: ownCvcIcon,
      ...rest
    } = props as AliasProps;
    const ctx = useFormBinding(form);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useImperativeHandle(
      ref,
      () => ({
        focus: () => fieldRef.current?.focus(),
        blur: () => fieldRef.current?.blur(),
        clear: () => fieldRef.current?.clear(),
      }),
      []
    );

    const reportChange = ctx?.reportChange;
    const handleChange = useCallback(
      (change: FieldChange) => {
        reportChange?.(change);
        onChangeRef.current?.(change);
      },
      [reportChange]
    );

    // The web SDK reads every field option from `options`, applies a
    // placeholder only when it is a string, and warns on an icon value it
    // does not know, keeping the default. The top-level `placeholder` and
    // `cvcIcon` props predate the nesting and stay as aliases; an explicit
    // top-level prop wins over the nested one.
    const placeholder =
      pickString(ownPlaceholder) ?? pickString(options?.placeholder);
    const cvcIcon =
      elementType === 'cardCvc'
        ? (pickAllowed(ownCvcIcon, CVC_ICONS, 'cvcIcon') ??
          pickAllowed(options?.cvcIcon, CVC_ICONS, 'options.cvcIcon'))
        : undefined;
    const cardBrandIcon =
      elementType === 'cardNumber'
        ? pickAllowed(
            options?.cardBrandIcon,
            CARD_BRAND_ICONS,
            'options.cardBrandIcon'
          )
        : undefined;
    const appearance =
      options?.appearance && typeof options.appearance === 'object'
        ? options.appearance
        : undefined;

    const savedCard = options?.savedCard;
    const savedToken = savedCard?.paymentMethodToken;
    const savedBrand = savedCard?.paymentMethodData?.card?.cardNetwork;
    const subscriptionEvents = pickStringArray(
      options?.subscriptionEvents,
      'options.subscriptionEvents'
    );
    const subscriptionKey = subscriptionEvents?.join(' ') ?? '';
    const subscriptionRef = useRef(subscriptionEvents);
    subscriptionRef.current = subscriptionEvents;
    const registerField = ctx?.registerField;
    const forgetField = ctx?.forgetField;
    useEffect(() => {
      const registration: FieldOptions = {};
      if (savedToken !== undefined) {
        registration.savedCard = {
          paymentMethodToken: savedToken,
          ...(savedBrand
            ? { paymentMethodData: { card: { cardNetwork: savedBrand } } }
            : {}),
        };
      }
      if (subscriptionRef.current?.length) {
        registration.subscriptionEvents = subscriptionRef.current;
      }
      registerField?.(
        elementType,
        Object.keys(registration).length ? registration : undefined
      );
      return () => forgetField?.(elementType);
    }, [registerField, forgetField, savedToken, savedBrand, subscriptionKey]);

    const styles = useMemo(
      () => resolveFieldStyles(ctx?.appearances, elementType, ownStyles),
      [ctx?.appearances, ownStyles]
    );

    const mounted = ctx !== null && ctx.collector !== undefined;
    useEffect(() => {
      if (mounted) onReadyRef.current?.({ elementType });
    }, [mounted]);

    if (!ctx) {
      throw new Error(
        `${displayName} needs a form: render it inside <CardForm>, or pass form={cardForm}.`
      );
    }

    if (ctx.adapter === null || ctx.collector === undefined) {
      return (
        <Placeholder elementType={elementType} styles={styles} {...rest} />
      );
    }

    const Field = ctx.adapter.Field;
    return (
      <Field
        {...rest}
        elementType={elementType}
        collector={ctx.collector}
        fieldRef={fieldRef}
        styles={styles}
        placeholder={placeholder}
        cvcIcon={cvcIcon}
        cardBrandIcon={cardBrandIcon}
        appearance={appearance}
        savedCard={savedCard}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
  });

  CardField.displayName = displayName;
  return CardField;
}
