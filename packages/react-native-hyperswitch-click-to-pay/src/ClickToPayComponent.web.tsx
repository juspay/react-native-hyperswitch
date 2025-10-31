import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { clickToPayWebViewHTML } from './clickToPayWebView.html.ts';

export type ClickToPayComponentProps = {
  onMessage: (type: string, data: any) => void;
  onCookiesExtracted?: (cookies: string) => void;
  initialCookies?: string;
};

export type ClickToPayComponentRef = {
  sendMessage: (type: string, data: any) => void;
};

const ClickToPayComponent = forwardRef<
  ClickToPayComponentRef,
  ClickToPayComponentProps
>(({ onMessage, onCookiesExtracted, initialCookies }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isCheckoutActive, setIsCheckoutActive] = useState(false);

  useEffect(() => {
    if (!initialCookies || !iframeRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          const cookieParts = initialCookies.split(';');
          cookieParts.forEach((cookie) => {
            const trimmedCookie = cookie.trim();
            if (trimmedCookie) {
              iframeRef.current!.contentWindow!.document.cookie = trimmedCookie;
            }
          });
        } catch (e) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              clickToPayRequest: {
                type: 'SET_COOKIES',
                message: { cookies: initialCookies },
              },
            }),
            '*'
          );
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [initialCookies]);

  const extractCookies = useCallback(() => {
    if (
      iframeRef.current &&
      iframeRef.current.contentWindow &&
      onCookiesExtracted
    ) {
      try {
        const cookies = iframeRef.current.contentWindow.document.cookie;
        onCookiesExtracted(cookies);
      } catch (e) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            clickToPayRequest: {
              type: 'GET_COOKIES',
              message: {},
            },
          }),
          '*'
        );
      }
    }
  }, [onCookiesExtracted]);

  useImperativeHandle(ref, () => ({
    sendMessage: (type: string, data: any) => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        const message = {
          clickToPayRequest: {
            type: type,
            message: data,
          },
        };

        iframeRef.current.contentWindow.postMessage(
          JSON.stringify(message),
          '*'
        );
      }
    },
  }));

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let messageData;
        if (typeof event.data === 'string') {
          messageData = JSON.parse(event.data);
        } else {
          messageData = event.data;
        }

        const message = messageData.clickToPayResponse;
        if (message) {
          console.log(JSON.stringify(message));

          if (message.type === 'COOKIES_EXTRACTED') {
            if (onCookiesExtracted) {
              onCookiesExtracted(message.data);
            }
            return;
          }

          if (message.type === 'CHECKOUT_INITIATED') {
            setIsCheckoutActive(true);
          }

          if (
            message.type === 'CHECKOUT_SUCCESS' ||
            message.type === 'CHECKOUT_FAILED'
          ) {
            setIsCheckoutActive(false);
            if (message.type === 'CHECKOUT_SUCCESS') {
              extractCookies();
            }
          }

          onMessage(message.type, message.data);
        }
      } catch (error) {
        console.log('Failed to parse iframe message:', error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage, onCookiesExtracted, extractCookies]);

  const iframeStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: isCheckoutActive ? '100%' : '0',
    height: isCheckoutActive ? '100%' : '0',
    opacity: isCheckoutActive ? 1 : 0,
    border: 'none',
    zIndex: isCheckoutActive ? 9999 : -1,
  };

  return (
    <iframe
      ref={iframeRef}
      srcDoc={clickToPayWebViewHTML}
      style={iframeStyle}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      title="Click to Pay"
    />
  );
});

export default ClickToPayComponent;
