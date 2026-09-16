import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFormBinding } from './useFormBinding';
import { resolveAppearanceVariables, resolveFieldStyles } from '../core/appearance';
import { coreOf } from '../core/formRegistry';
import type { ElementType, FieldChange, FieldHandle } from '../core/types';
import { Placeholder } from './Placeholder';
import type { FieldProps } from './types';

export function createCardField(elementType: ElementType, displayName: string) {
  const CardField = forwardRef<FieldHandle, FieldProps>((props, ref) => {
    const fieldRef = useRef<FieldHandle | null>(null);
    const {
      form,
      onChange,
      onReady,
      onFocus,
      onBlur,
      options,
      styles: ownStyles,
      ...rest
    } = props;
    const ctx = useFormBinding(form);
    const core = form ? coreOf(form) : undefined;

    const onCollectorReady = useCallback(
      (next: unknown) => {
        if (!core) return;
        core.collector = next;
        core.session.attachCollector(next);
        core.status = 'ready';
        core.notify();
      },
      [core]
    );

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

    const savedCard = options?.savedCard;
    const savedToken = savedCard?.paymentMethodToken;
    const savedBrand = savedCard?.paymentMethodData?.card?.cardNetwork;
    const registerField = ctx?.registerField;
    const forgetField = ctx?.forgetField;
    useEffect(() => {
      registerField?.(
        elementType,
        savedToken === undefined
          ? undefined
          : {
              savedCard: {
                paymentMethodToken: savedToken,
                ...(savedBrand
                  ? { paymentMethodData: { card: { cardNetwork: savedBrand } } }
                  : {}),
              },
            }
      );
      return () => forgetField?.(elementType);
    }, [registerField, forgetField, savedToken, savedBrand]);

    const styles = useMemo(
      () => resolveFieldStyles(ctx?.appearances, elementType, ownStyles),
      [ctx?.appearances, ownStyles]
    );
    const appearanceVariables = useMemo(
      () => resolveAppearanceVariables(ctx?.appearances),
      [ctx?.appearances]
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
        elementType={elementType}
        collector={ctx.collector}
        fieldRef={fieldRef}
        styles={styles}
        options={options}
        appearanceVariables={appearanceVariables}
        savedCard={savedCard}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onCollectorReady={onCollectorReady}
        {...rest}
      />
    );
  });

  CardField.displayName = displayName;
  return CardField;
}
