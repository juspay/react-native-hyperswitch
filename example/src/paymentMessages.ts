import { Alert } from "react-native";
import {
  MessageElement,
  messageContent,
  type PaymentMethodConfig,
} from "@juspay-tech/react-native-hyperswitch";

// These demo callbacks are static. The wrapper creates keys and subscriptions.
const terms = MessageElement.action({
  label: "Terms & Conditions",
  style: { textDecoration: "underline" },
  onClick: () =>
    Alert.alert("Terms & Conditions", "This is the merchant terms action."),
});
const privacy = MessageElement.action({
  label: "Privacy Policy",
  style: { color: "#0570DE", textDecoration: "underline" },
  onClick: () =>
    Alert.alert("Privacy Policy", "This is the merchant privacy action."),
});

export const paymentMessages: PaymentMethodConfig[] = [
  {
    paymentMethod: "card",
    message: {
      displayMode: "custom_message",
      value: messageContent`Please review the ${terms} and ${privacy}.
Please review before paying.`,
    },
  },
  {
    paymentMethod: "bank_debit",
    message: { value: `Review your bank debit details before paying.` },
  },
];
