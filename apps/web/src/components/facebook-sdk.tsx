"use client";

import Script from "next/script";

export function FacebookSDK() {
    return (
        <Script
            src="https://connect.facebook.net/en_US/sdk.js"
            strategy="lazyOnload"
            onLoad={() => {
                if (typeof window !== "undefined" && (window as any).FB) {
                    (window as any).FB.init({
                        appId: process.env.NEXT_PUBLIC_META_APP_ID,
                        autoLogAppEvents: true,
                        xfbml: false,
                        version: "v19.0",
                    });
                }
            }}
        />
    );
}
