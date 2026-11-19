import subprocess

res = subprocess.run("ssh root@2.31.109.248 'ps aux | grep docker'", shell=True, text=True, capture_output=True)
print("STDOUT:\n", res.stdout)
