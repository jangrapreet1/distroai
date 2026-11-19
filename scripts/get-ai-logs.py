import subprocess

cmd = "ssh root@2.31.109.248 'docker logs --tail 200 distroai_api'"
output = subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.STDOUT)
lines = [l for l in output.splitlines() if "AI" in l or "Error" in l or "error" in l or "stream" in l or "llm" in l or "OpenRouter" in l or "status" in l]
for l in lines[-40:]:
    print(l)
