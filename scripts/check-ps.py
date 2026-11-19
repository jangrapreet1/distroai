import subprocess

res = subprocess.run("ssh root@2.31.109.248 'docker ps --format \"table {{.Names}}\\t{{.Status}}\"'", shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
