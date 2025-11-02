export const clickToPayWebViewHTML = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      #dcfLaunch {
        width: 100%;
        height: 100%;
        border: none;
      }
    </style>
  </head>
  <body>
    <iframe id="dcfLaunch"></iframe>
    <script>
      function sendMessage(type, data) {
        const message = {
          clickToPayResponse: {
            type: type,
            data: data,
            timestamp: Date.now(),
          },
        };

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } else {
          window.parent.postMessage(JSON.stringify(message));
        }
      }

      function addScript(data) {
        const src = data.sdkUrl;
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => sendMessage('LOAD_SUCCESS', src);
        script.onerror = () => sendMessage('LOAD_ERROR', src);
        document.head.appendChild(script);
      }

      const clickToPayServices = {
        visa: null,
        mastercard: null,
      };

      async function initializeSDK(data) {
        try {
          const initializeOptions = data.initializeOptions;

          if (data.isVISA) {
            clickToPayServices.visa = window.VSDK;
            const result = await clickToPayServices.visa.initialize(initializeOptions);
            sendMessage('INIT_SUCCESS', result);
          } else {
            clickToPayServices.mastercard = new window.MastercardCheckoutServices();
            const result = await clickToPayServices.mastercard.init(initializeOptions);
            sendMessage('INIT_SUCCESS', result);
          }
        } catch (error) {
          sendMessage('INIT_FAILED', error.message);
        }
      }

      async function getCards(data) {
        try {
          let result;
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('GET_CARDS_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.getCards(data.params);
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('GET_CARDS_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.getCards(data.params);
          }
          sendMessage('GET_CARDS_SUCCESS', result);
        } catch (error) {
          sendMessage('GET_CARDS_FAILED', error.message);
        }
      }

      async function checkout(data) {
        try {
          sendMessage('CHECKOUT_INITIATED', { isVISA: data.isVISA });
          
          let result;
          const checkoutParams = {
            ...data.params,
            windowRef: document.getElementById('dcfLaunch').contentWindow
          };
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('CHECKOUT_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.checkout(checkoutParams);
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('CHECKOUT_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.checkoutWithCard(checkoutParams);
          }
          sendMessage('CHECKOUT_SUCCESS', result);
        } catch (error) {
          sendMessage('CHECKOUT_FAILED', error.message);
        }
      }

      async function idLookup(data) {
        try {
          let result;
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('ID_LOOKUP_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.getCards(data.params);
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('ID_LOOKUP_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.idLookup(data.params);
          }
          sendMessage('ID_LOOKUP_SUCCESS', result);
        } catch (error) {
          sendMessage('ID_LOOKUP_FAILED', error.message);
        }
      }

      async function initiateValidation(data) {
        try {
          let result;
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('INITIATE_VALIDATION_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.initiateIdentityValidation(data.params);
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('INITIATE_VALIDATION_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.initiateValidation(data.params);
          }
          sendMessage('INITIATE_VALIDATION_SUCCESS', result);
        } catch (error) {
          sendMessage('INITIATE_VALIDATION_FAILED', error.message);
        }
      }

      async function validate(data) {
        try {
          let result;
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('VALIDATE_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.getCards(data.params);
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('VALIDATE_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.validate(data.params);
          }
          sendMessage('VALIDATE_SUCCESS', result);
        } catch (error) {
          sendMessage('VALIDATE_FAILED', error.message);
        }
      }

      async function signOut(data) {
        try {
          let result;
          if (data.isVISA) {
            if (!clickToPayServices.visa) {
              sendMessage('SIGN_OUT_FAILED', 'Visa service not initialized');
              return;
            }
            result = await clickToPayServices.visa.unbindAppInstance();
          } else {
            if (!clickToPayServices.mastercard) {
              sendMessage('SIGN_OUT_FAILED', 'Mastercard service not initialized');
              return;
            }
            result = await clickToPayServices.mastercard.signOut();
          }
          sendMessage('SIGN_OUT_SUCCESS', result);
        } catch (error) {
          sendMessage('SIGN_OUT_FAILED', error.message);
        }
      }

      // Card encryption functions
      const keyId = "XIXBZROKXQ0PD920SVVK13xT2-op2KI_Z5xoN9d8B8gZ7ITNY";
      const certPem = "-----BEGIN CERTIFICATE-----MIIFCzCCA/OgAwIBAgIQF1JffCUP3Q4kU2kjNvae2zANBgkqhkiG9w0BAQsFADB9MQswCQYDVQQGEwJVUzENMAsGA1UEChMEVklTQTEvMC0GA1UECxMmVmlzYSBJbnRlcm5hdGlvbmFsIFNlcnZpY2UgQXNzb2NpYXRpb24xLjAsBgNVBAMTJVZpc2EgSW5mb3JtYXRpb24gRGVsaXZlcnkgRXh0ZXJuYWwgQ0EwHhcNMjIxMjEzMDcxMTUxWhcNMjUwMzEyMDcxMTUwWjCBiTEUMBIGA1UEBwwLRm9zdGVyIENpdHkxCzAJBgNVBAgMAkNBMQswCQYDVQQGEwJVUzERMA8GA1UECgwIVmlzYSBJbmMxGDAWBgNVBAsMD091dGJvdW5kIENsaWVudDEqMCgGA1UEAwwhZW5jLTFiZGFiM2NjLnNieC5kaWdpdGFsLnZpc2EuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsZPIusDf7yQnnhBkU9mu14VOO3Crui3b7rAf2KYeobURmXA17b1JX9jg0Cd+vgpmuyTrxBUSc+4b0+UPgSwGFqPWUpx08ExqrwPDOvFojBou2wlyq8bcy0Us+BfeCzSE5lMVdSXTXXXcNqu+qb22jCCCJALpxsArsboMOXsLedh3M4XNQ5XGAtRf7b++uTY5Dr9KLYyUvZKAnY04MKJPEO54YiIFM5DTAhNOms089jdMdx+URIKJjPU2+RpHG1u8LCG028RTIpPsNbRanuS5TAY/zlxDgb1hKJ36YbZENHLg9PXTBhdOMlU90DTLlfcbLTa+D7DgljAaWCuvzLPaGwIDAQABo4IBeDCCAXQwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBQZOlJmzSkf4/rLNH0WdiEC2k+5GDBlBggrBgEFBQcBAQRZMFcwLgYIKwYBBQUHMAKGImh0dHA6Ly9lbnJvbGwudmlzYWNhLmNvbS92aWNhMy5jZXIwJQYIKwYBBQUHMAGGGWh0dHA6Ly9vY3NwLnZpc2EuY29tL29jc3AwOQYDVR0gBDIwMDAuBgVngQMCATAlMCMGCCsGAQUFBwIBFhdodHRwOi8vd3d3LnZpc2EuY29tL3BraTATBgNVHSUEDDAKBggrBgEFBQcDAjBdBgNVHR8EVjBUMCigJqAkhiJodHRwOi8vRW5yb2xsLnZpc2FjYS5jb20vVklDQTMuY3JsMCigJqAkhiJodHRwOi8vY3JsLmlub3YudmlzYS5uZXQvVklDQTMuY3JsMB0GA1UdDgQWBBQ1b8+Q1OXrLD7Wa2HP/QUqw3zOODAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQELBQADggEBADktKcAGyG46aGkZcWWXPq3zSgYlXrS27TW1xmO2nnu3mfmwFhJD3aduQU23jZy9mEVGcAxoDhIpkNDJZ2vAPSAz47Re4eBbOFq+S8NfPe59THfxldAqhWkEOK/TfdCW/BNfv+0ML0iFenEWVm/0rliOwCVUcGvNnNqTbLR2UnYs8gkQHQt5mLNIhvumMOJDodzUr74aEFICNa/fCpYbY8FXQ+MwL8atUfw/QxBaO5KqJcAYdvkD9qlIrgA+dM7vODPENpmoXsz7KmDZdrNJEn8re5BbUQ4etNTQxmbWaFTN4Q63Vnocj/dzCPL74IM8EzeLjGciK7oumxt+ljAfBzs=-----END CERTIFICATE-----";

      function base64UrlEncode(str) {
        return btoa(str).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
      }

      function arrayBufferToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return base64UrlEncode(binary);
      }

      function extractPublicKeyFromCertificate(certPem) {
        const b64 = certPem
          .replace("-----BEGIN CERTIFICATE-----", "")
          .replace("-----END CERTIFICATE-----", "")
          .replace(/\\s/g, "");

        const binary = atob(b64);

        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        for (let i = 0; i < bytes.length - 11; i++) {
          if (
            bytes[i] === 0x2a && // 42 (1.2)
            bytes[i + 1] === 0x86 && // 134 (840)
            bytes[i + 2] === 0x48 && // 72 (113549)
            bytes[i + 3] === 0x86 && // 134
            bytes[i + 4] === 0xf7 && // 247
            bytes[i + 5] === 0x0d && // 13
            bytes[i + 6] === 0x01 && // 1
            bytes[i + 7] === 0x01 && // 1
            bytes[i + 8] === 0x01
          ) {
            let pos = i - 2;
            while (pos > 0 && bytes[pos] !== 0x30) pos--;
            if (bytes[pos] !== 0x30) throw new Error("Sequence not found");

            pos++;
            let length = bytes[pos];
            if (length > 0x80) {
              const lengthBytes = length - 0x80;
              length = 0;
              for (let j = 0; j < lengthBytes; j++) {
                length = (length << 8) | bytes[pos + 1 + j];
              }
              pos += lengthBytes;
            }
            pos++;

            while (pos < bytes.length && bytes[pos] !== 0x03) pos++;
            if (bytes[pos] !== 0x03) throw new Error("Bit string not found");
            pos++;

            length = bytes[pos];
            if (length > 0x80) {
              const lengthBytes = length - 0x80;
              length = 0;
              for (let j = 0; j < lengthBytes; j++) {
                length = (length << 8) | bytes[pos + 1 + j];
              }
              pos += lengthBytes;
            }
            pos++;

            pos++;

            if (bytes[pos] !== 0x30) throw new Error("Key sequence not found");
            pos++;

            length = bytes[pos];
            if (length > 0x80) {
              const lengthBytes = length - 0x80;
              pos += lengthBytes + 1;
            } else {
              pos++;
            }

            if (bytes[pos] !== 0x02) throw new Error("Modulus not found");
            pos++;
            let modLength = bytes[pos];
            if (modLength > 0x80) {
              const lengthBytes = modLength - 0x80;
              modLength = 0;
              for (let j = 0; j < lengthBytes; j++) {
                modLength = (modLength << 8) | bytes[pos + 1 + j];
              }
              pos += lengthBytes + 1;
            } else {
              pos++;
            }

            if (bytes[pos] === 0x00) {
              pos++;
              modLength--;
            }

            const modulus = bytes.slice(pos, pos + modLength);
            pos += modLength;

            if (bytes[pos] !== 0x02) throw new Error("Exponent not found");
            pos++;
            let expLength = bytes[pos];
            pos++;
            const exponent = bytes.slice(pos, pos + expLength);

            return {
              modulus: Array.from(modulus),
              exponent: Array.from(exponent),
            };
          }
        }
        throw new Error("RSA public key not found");
      }

      async function importPublicKey(certPem) {
        try {
          const keyComponents = extractPublicKeyFromCertificate(certPem);

          // Create JWK from components
          const jwk = {
            kty: "RSA",
            n: arrayBufferToBase64Url(new Uint8Array(keyComponents.modulus)),
            e: arrayBufferToBase64Url(new Uint8Array(keyComponents.exponent)),
            alg: "RSA-OAEP-256",
            ext: true,
            key_ops: ["encrypt"],
          };

          // Import the JWK
          return await crypto.subtle.importKey(
            "jwk",
            jwk,
            {
              name: "RSA-OAEP",
              hash: { name: "SHA-256" },
            },
            false,
            ["encrypt"]
          );
        } catch (error) {
          throw error;
        }
      }

      async function encryptMessage(payload) {
        // Convert JSON object back to string for encryption
        const input = JSON.stringify(payload);

        // Generate a random Content Encryption Key (CEK)
        const cek = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt"]
        );

        // Generate random IV
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Create protected header with iat instead of cty
        const header = {
          alg: "RSA-OAEP-256",
          enc: "A256GCM",
          kid: keyId,
          iat: Math.floor(Date.now() / 1000), // Current timestamp in seconds
        };

        // Encode header
        const encodedHeader = base64UrlEncode(JSON.stringify(header));

        // Import public key and encrypt CEK
        const publicKey = await importPublicKey(certPem);
        const wrappedKey = await crypto.subtle.encrypt(
          {
            name: "RSA-OAEP",
          },
          publicKey,
          await crypto.subtle.exportKey("raw", cek)
        );

        // Encrypt the payload
        const encoder = new TextEncoder();
        const encodedPayload = encoder.encode(input);

        const encryptedData = await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv: iv,
            additionalData: encoder.encode(encodedHeader),
          },
          cek,
          encodedPayload
        );

        // Split encrypted data into ciphertext and authentication tag
        const encryptedContent = encryptedData.slice(0, -16);
        const authTag = encryptedData.slice(-16);

        // Construct JWE
        const jwe = [
          encodedHeader,
          arrayBufferToBase64Url(wrappedKey),
          arrayBufferToBase64Url(iv),
          arrayBufferToBase64Url(encryptedContent),
          arrayBufferToBase64Url(authTag),
        ].join(".");

        sendMessage('ENCRYPT_CARD_SUCCESS', jwe);
      }

      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.clickToPayRequest) {
            switch (data.clickToPayRequest.type) {
              case 'LOAD':
                addScript(data.clickToPayRequest.message);
                break;
              case 'INIT':
                initializeSDK(data.clickToPayRequest.message);
                break;
              case 'GET_CARDS':
                getCards(data.clickToPayRequest.message);
                break;
              case 'CHECKOUT':
                checkout(data.clickToPayRequest.message);
                break;
              case 'ID_LOOKUP':
                idLookup(data.clickToPayRequest.message);
                break;
              case 'INITIATE_VALIDATION':
                initiateValidation(data.clickToPayRequest.message);
                break;
              case 'VALIDATE':
                validate(data.clickToPayRequest.message);
                break;
              case 'SIGN_OUT':
                signOut(data.clickToPayRequest.message);
                break;
              case 'ENCRYPT_CARD':
                encryptMessage(data.clickToPayRequest.message.cardData);
                break;
              case 'GET_COOKIES':
                sendMessage('COOKIES_EXTRACTED', document.cookie);
                break;
              case 'SET_COOKIES':
                if (data.clickToPayRequest.message.cookies) {
                  document.cookie = data.clickToPayRequest.message.cookies;
                }
                break;
            }
          }
        } catch (ex) {}
      });
    </script>
  </body>
</html>
`;
