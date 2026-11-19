import subprocess

sql = 'SELECT id, name, "contactPerson", phone, "altPhone", "whatsappNumber", "createdAt", "updatedAt" FROM "Customer" ORDER BY "updatedAt" DESC LIMIT 5;'
proc = subprocess.Popen(["ssh", "root@2.31.109.248", "docker exec -i distroai_postgres psql -U distroai -d distroai"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
stdout, stderr = proc.communicate(input=sql)
print("STDOUT:\n", stdout)
print("STDERR:\n", stderr)
