import subprocess

cmd = """ssh root@2.31.109.248 "grep -q 'OPENROUTER_MODEL=' /home/distroai/app/infra/docker/.env.production && sed -i 's|^OPENROUTER_MODEL=.*|OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free|' /home/distroai/app/infra/docker/.env.production || echo 'OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free' >> /home/distroai/app/infra/docker/.env.production" """
res = subprocess.run(cmd, shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
