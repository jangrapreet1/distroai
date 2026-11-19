import os
import subprocess

ssh_cmd = "ssh root@2.31.109.248 'cat /home/distroai/app/infra/docker/.env.production 2>/dev/null || cat /home/distroai/app/.env 2>/dev/null'"
raw_env = subprocess.check_output(ssh_cmd, shell=True, text=True)

loaded = {}
for line in raw_env.splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip("'").strip('"')
        if v:
            loaded[k] = len(v)

docker_env = subprocess.check_output("ssh root@2.31.109.248 'docker exec distroai_api env'", shell=True, text=True)
for line in docker_env.splitlines():
    if "=" in line:
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if v and k not in loaded:
            loaded[k] = len(v)

keys_to_check = [
    ("Core Infrastructure", ["DATABASE_URL", "REDIS_URL", "ENCRYPTION_KEY", "JWT_SECRET", "PORT"]),
    ("AI & Copilot", ["OPENROUTER_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENAI_API_KEY", "AI_SERVICE_URL"]),
    ("Meta & Ads", ["META_APP_ID", "META_APP_SECRET", "NEXT_PUBLIC_META_APP_ID", "NEXT_PUBLIC_META_CONFIG_ID"]),
    ("WhatsApp Cloud API", ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID"]),
    ("Payments & Billing (Razorpay)", ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]),
    ("Google Sign-In OAuth", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"]),
    ("Cloud Object Storage / Wal-G PITR Backup", ["AWS_ACCESS_KEY_ID_B2", "AWS_SECRET_ACCESS_KEY_B2", "AWS_ENDPOINT_B2", "WALG_S3_PREFIX"]),
    ("Push Notifications (Web VAPID)", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"])
]

print("=== DISTROAI LIVE PRODUCTION KEY AUDIT ===")
for category, keys in keys_to_check:
    print(f"\n[{category}]")
    for k in keys:
        if k in loaded and loaded[k] > 0:
            print(f"  ✓ {k}: CONFIGURED")
        else:
            print(f"  ✗ {k}: NOT CONFIGURED / MISSING")
