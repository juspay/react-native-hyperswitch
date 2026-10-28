# @juspay-tech/react-native-hyperswitch-airborne

Optional companion library for **React Native Hyperswitch SDK** that enables Over-The-Air (OTA) bundle updates using Airborne.

## Overview

Airborne is kept as an optional dependency so apps that do not require OTA updates are not burdened with additional binary size or runtime components.

Installing `@juspay-tech/react-native-hyperswitch-airborne`:
- On **Android**, implements and links `io.hyperswitch:hyperswitch-sdk-android-airborne`.
- On **iOS**, links `hyperswitch-sdk-ios/airborne`.

The core `react-native-hyperswitch` library automatically detects the presence of Airborne on the classpath via reflection, initializes the Airborne update engine, and seamlessly boots the latest verified JavaScript bundle.

## Installation

```bash
npm install @juspay-tech/react-native-hyperswitch-airborne
# or
yarn add @juspay-tech/react-native-hyperswitch-airborne
```

For iOS:
```bash
cd ios && pod install
```

## Usage

Simply installing the package links the native dependencies. The main Hyperswitch SDK will automatically use Airborne for OTA bundle resolution.

You can also check availability or query the bundle path in JavaScript:

```typescript
import { isAvailable, getBundlePath } from '@juspay-tech/react-native-hyperswitch-airborne';

const available = await isAvailable();
const bundlePath = await getBundlePath();
```
