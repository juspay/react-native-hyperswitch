import { Alert } from "react-native";
import {
  MessageElement,
  messageContent,
  type MessageElementStyles,
  type PaymentMethodConfig,
} from "@juspay-tech/react-native-hyperswitch";

const tapped = (name: string) => () =>
  Alert.alert(name, `The merchant ${name} action ran.`);

/* Defaults for every key in a message: bold, italic, larger and purple. */
const actionDefaults: MessageElementStyles = {
  action: {
    color: "#7C3AED",
    fontSize: 16,
    fontWeight: "700",
    fontStyle: "italic",
  },
};

/* Uses the defaults as they are. */
const terms = MessageElement.action({
  label: "Terms & Conditions",
  onClick: tapped("terms"),
});
/* Overrides colour and adds an underline; keeps the default weight, size and italic. */
const privacy = MessageElement.action({
  label: "Privacy Policy",
  style: { color: "#DC2626", textDecoration: "underline" },
  onClick: tapped("privacy"),
});
const bankTerms = MessageElement.action({
  label: "debit schedule",
  style: { color: "#0891B2", textDecoration: "underline" },
  onClick: tapped("debit schedule"),
});
const sepaMandate = MessageElement.action({
  label: "SEPA mandate",
  style: {
    color: "#16A34A",
    fontSize: 18,
    fontStyle: "normal",
    textDecoration: "underline",
  },
  onClick: tapped("SEPA mandate"),
});

export const paymentMessages: PaymentMethodConfig[] = [
  /* Payment method level: applies to every card type. On a mandate intent it is also the
   saved-card terms checkbox label; remove it to see the default terms. */
  {
    paymentMethod: "card",
    message: {
      value: messageContent`Card: please review the ${terms} and ${privacy} before paying.`,
      elementStyles: actionDefaults,
    },
  },
  /* Shown once below the wallet buttons on a mandate intent, in place of the SDK's
   "Wallet details will be saved" text. Use { displayMode: "hidden" } to show nothing, or
   { displayMode: "default_sdk_message" } for the SDK text. */
  {
    paymentMethod: "wallet",
    message: {
      value: messageContent`Wallet: your wallet will be saved for later. See the ${terms}.`,
      elementStyles: actionDefaults,
    },
  },
  /* Method level for every bank debit type, overridden for SEPA and hidden for ACH. */
  {
    paymentMethod: "bank_debit",
    message: {
      value: messageContent`Bank debit (all types): see the ${bankTerms}.`,
      elementStyles: actionDefaults,
    },
    paymentMethodTypes: [
      {
        paymentMethodType: "sepa",
        message: {
          value: messageContent`SEPA only: by paying you accept the ${sepaMandate} and ${terms}.`,
          elementStyles: actionDefaults,
        },
      },
      { paymentMethodType: "ach", message: { displayMode: "hidden" } },
    ],
  },
];
