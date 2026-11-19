import subprocess

subprocess.run("scp scripts/test-langchain-tools.js root@2.31.109.248:/tmp/test-langchain-tools.js", shell=True, check=True)
remote_cmd = (
    "docker cp /tmp/test-langchain-tools.js distroai_api:/app/test-langchain-tools.js && "
    "docker exec distroai_api node /app/test-langchain-tools.js"
)
res = subprocess.run(f"ssh root@2.31.109.248 '{remote_cmd}'", shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
