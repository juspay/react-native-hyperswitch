import {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
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
  const webViewRef = useRef<WebView>(null);
  const [isCheckoutActive, setIsCheckoutActive] = useState(false);

  useEffect(() => {
    if (initialCookies && webViewRef.current) {
      const setCookiesScript = `
        (function() {
          document.cookie = ${JSON.stringify(initialCookies)};
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(setCookiesScript);
    }
  }, [initialCookies]);

  const extractCookies = () => {
    if (webViewRef.current && onCookiesExtracted) {
      const extractScript = `
        (function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            clickToPayResponse: {
              type: 'COOKIES_EXTRACTED',
              data: document.cookie,
              timestamp: Date.now()
            }
          }));
        })();
        true;
      `;
      webViewRef.current.injectJavaScript(extractScript);
    }
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (type: string, data: any) => {
      if (webViewRef.current) {
        const message = {
          clickToPayRequest: {
            type: type,
            message: data,
          },
        };

        console.log(message);

        const script = `
            (function() {
              const event = new MessageEvent('message', {
                data: ${JSON.stringify(JSON.stringify(message))}
              });
              window.dispatchEvent(event);
            })();
            true;
          `;

        webViewRef.current.injectJavaScript(script);
      }
    },
  }));

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const messageData = JSON.parse(event.nativeEvent.data);
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
      console.log('Failed to parse WebView message:', error);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isCheckoutActive ? styles.fullScreen : styles.hidden,
      ]}
    >
      <WebView
        ref={webViewRef}
        source={{
          html: clickToPayWebViewHTML,
          baseUrl: 'https://sandbox.secure.checkout.visa.com',
          // baseUrl: 'https://sandbox.src.mastercard.com',
        }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        setSupportMultipleWindows={true}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        incognito={false}
        cacheEnabled={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log('WebView error:', nativeEvent.description);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  hidden: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  fullScreen: {
    width: '100%',
    height: '100%',
    opacity: 1,
    zIndex: 9999,
  },
});

export default ClickToPayComponent;
