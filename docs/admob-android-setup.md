# AdMob rewarded ads — phone app setup

AdMob rewarded ads only run inside an installed Android/iOS app that contains the
Google Mobile Ads SDK. They never load in a web browser (desktop or phone), so
the web app shows the "no SDK" diagnosis there. This project is the web app; the
phone app is a Capacitor wrapper built outside Lovable (Android Studio / Xcode).

## 1. Wrap the app with Capacitor

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor-community/admob
npx cap init "شات عالمي" com.yourcompany.chat --web-dir dist/client
npx cap add android
npx vite build && npx cap sync android
```

The web code already talks to `window.Capacitor.Plugins.AdMob` (src/lib/rewarded-ad.ts):
`initialize` → `prepareRewardVideoAd({ adId, isTesting, ssv: { userId, customData } })` →
`showRewardVideoAd`, and records `onRewardedVideoAdFailedToLoad` / `FailedToShow` errors.

## 2. android/app/src/main/AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />

    <application ...>
        <!-- AdMob APP id (contains "~"), NOT the ad unit id (contains "/") -->
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="ca-app-pub-8449241346087567~XXXXXXXXXX" />
    </application>
</manifest>
```

Missing APPLICATION_ID crashes the app or returns LoadAdError 8; a mismatched one returns 1.

## 3. Test vs real ads

- Development builds (`import.meta.env.DEV`) use Google's public test unit and `isTesting: true`.
  Test ads never credit the wallet (the SSV route only credits the owner's configured unit).
- Production builds use the ad unit saved by the owner in the ads dashboard.

## 4. Rewards

The wallet is credited only by the server after Google's signed SSV callback reaches
`/api/public/ads/ssv`. Nothing in the app grants a reward on the device.
