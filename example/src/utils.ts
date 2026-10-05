import { Platform } from "react-native";

export const initialBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:5252" : "http://localhost:5252";

export const publishableKey =
  process.env.HYPERSWITCH_PUBLISHABLE_KEY ??
  "";
export const profileId = process.env.PROFILE_ID ?? "";
export const secretKey =
  process.env.HYPERSWITCH_SECRET_KEY ?? "";

export const serverURL = process.env.SERVER_URL ?? "";
export const getStatus = (paymentStatus: string | undefined): string => {
  const status = paymentStatus ?? "Unknown";
  return status.length > 1
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : status;
};

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return JSON.stringify(error);
};


export const intentData = {
  amount: 6500,
  order_details: [
    { product_name: "Apple iphone 15", quantity: 1, amount: 6500 },
  ],
  currency: "USD",
  confirm: false,
  capture_method: "automatic",
  authentication_type: "three_ds",
  setup_future_usage: "on_session",
  request_external_three_ds_authentication: false,
  description: "Hello this is description",
  profile_id: profileId,
  shipping: {
    address: {
      state: "California",
      city: "Banglore",
      country: "US",
      line1: "sdsdfsdf",
      line2: "hsgdbhd",
      line3: "alsksoe",
      zip: "571201",
      first_name: "John",
      last_name: "Doe",
    },
    phone: { number: "1234567890", country_code: "+1" },
  },
  connector_metadata: { noon: { order_category: "applepay" } },
  metadata: {
    udf1: "value1",
    new_customer: "true",
    login_date: "2019-09-10T10:11:12Z",
  },
  billing: {
    address: {
      line1: "1467",
      line2: "Harrison Street",
      line3: "Harrison Street",
      city: "San Francisco",
      state: "California",
      zip: "94122",
      country: "US",
      first_name: "joseph",
      last_name: "Doe",
    },
  phone: { number: "1234567890", country_code: "+91" },
  },
  customer_id: "hyperswitch_sdk_demo_id",
};