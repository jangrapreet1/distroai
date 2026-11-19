import subprocess

cmd = "ssh root@2.31.109.248 'grep OPENROUTER /home/distroai/app/infra/docker/.env.production'"
res = subprocess.run(cmd, shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
