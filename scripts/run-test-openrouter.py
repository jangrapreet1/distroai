import subprocess

# Copy test-openrouter.js to VPS
subprocess.run("scp scripts/test-openrouter.js root@2.31.109.248:/tmp/test-openrouter.js", shell=True, check=True)

# Copy into container and execute
remote_cmd = (
    "docker cp /tmp/test-openrouter.js distroai_api:/app/test-openrouter.js && "
    "docker exec distroai_api node /app/test-openrouter.js"
)
res = subprocess.run(f"ssh root@2.31.109.248 '{remote_cmd}'", shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
