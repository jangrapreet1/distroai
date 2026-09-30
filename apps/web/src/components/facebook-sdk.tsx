"use client";

import Script from "next/script";

export function FacebookSDK() {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) return null;

    return (
        <Script
            src="https://connect.facebook.net/en_US/sdk.js"
            strategy="lazyOnload"
            onLoad={() => {
                try {
                    if (typeof window !== "undefined" && (window as any).FB) {
                        (window as any).FB.init({
                            appId,
                            autoLogAppEvents: true,
                            xfbml: false,
                            version: "v19.0",
                        });
                    }
                } catch (e) {
                    console.warn("Facebook SDK init error:", e);
                }
            }}
        />
    );
}
