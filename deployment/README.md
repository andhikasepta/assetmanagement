# Panduan Deployment Production AMORA (Asset Management)

Panduan deployment arsitektur multi-VM:
- **VM 103.123.100.11**: Apache Reverse Proxy (`wmsdev.my.id/amora`) + Redis Session Control Server
- **VM 103.123.100.12**: Docker Host (`amora-app` di Port 8082 pada `wms-network`)
- **VM 103.123.100.14**: PostgreSQL Server (`dashboardasset_db`)
- **VM 103.123.100.15**: Background Worker Node (Systemd Daemon)

---

## 1. VM Docker (103.123.100.12)

### A. Build Image Docker (dari repositori lokal atau di server)
```bash
# Build image
docker build -t andhikasepta/amora:latest .

# (Opsional) Push ke Docker Hub
docker push andhikasepta/amora:latest
```

### B. Menjalankan Container
Salin file [docker-compose.yml](file:///c:/laragon/www/assetmanagement/docker-compose.yml) ke direktori proyek di VM `103.123.100.12` (misalnya `/home/deutsch/amora/docker-compose.yml`):

```bash
cd /home/deutsch/amora
docker compose up -d
```

Verifikasi container berjalan normal:
```bash
docker ps | grep amora-app
docker logs -f amora-app
curl -I http://localhost:8082/
```

---

## 2. VM Apache & Redis (103.123.100.11)

### A. Konfigurasi Redis Session Control
Buka konfigurasi Redis:
```bash
sudo nano /etc/redis/redis.conf
```

Pastikan konfigurasi berikut aktif:
```conf
bind 127.0.0.1 103.123.100.11
protected-mode no
port 6379
requirepass password_redis_rahasia
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Restart Redis dan verifikasi:
```bash
sudo systemctl restart redis-server
sudo systemctl status redis-server

# Test login Redis lokal
redis-cli -a password_redis_rahasia ping
# Harus return: PONG
```

Buka firewall agar VM Docker (`103.123.100.12`) dan Worker (`103.123.100.15`) bisa mengakses Redis:
```bash
sudo ufw allow from 103.123.100.12 to any port 6379 proto tcp
sudo ufw allow from 103.123.100.15 to any port 6379 proto tcp
sudo ufw status
```

### B. Konfigurasi Apache Reverse Proxy Subpath `/amora`
Edit file virtual host `/etc/apache2/sites-available/wmsdev.conf`:
```bash
sudo nano /etc/apache2/sites-available/wmsdev.conf
```

Tambahkan blok reverse proxy untuk `/amora` mengarah ke `http://103.123.100.12:8082`:
```apache
    # =========================================================================
    # 2. Forward ke Container AMORA / Asset Management (Port 8082 VM-Docker)
    # =========================================================================
    RewriteEngine On
    RewriteRule ^/amora$ /amora/ [R=301,L]

    ProxyPass /amora/ http://103.123.100.12:8082/ retry=0 timeout=300
    ProxyPassReverse /amora/ http://103.123.100.12:8082/
    ProxyPass /amora http://103.123.100.12:8082 retry=0 timeout=300
    ProxyPassReverse /amora http://103.123.100.12:8082
    ProxyPassReverse /amora https://wmsdev.my.id/amora
```

*(Lihat template lengkap di [deployment/wmsdev.conf](file:///c:/laragon/www/assetmanagement/deployment/wmsdev.conf))*.

Test sintaks dan reload Apache:
```bash
sudo a2enmod rewrite proxy proxy_http headers remoteip
sudo apache2ctl configtest
# Syntax OK
sudo systemctl reload apache2
```

---

## 3. VM Worker (103.123.100.15)

### A. Install Prasyarat PHP CLI & Ekstensi
```bash
sudo apt update
sudo apt install -y php-cli php-pgsql php-redis php-zip php-gd php-curl git
```

### B. Siapkan Folder Aplikasi Worker
```bash
sudo mkdir -p /var/www/amora-worker
sudo chown -R deutsch:deutsch /var/www/amora-worker

# Clone atau rsync repository ini ke /var/www/amora-worker
# Contoh:
# git clone https://github.com/andhikasepta/assetmanagement.git /var/www/amora-worker
```

### C. Pasang Systemd Service
Salin file service dari `deployment/amora-worker.service`:
```bash
sudo cp /var/www/amora-worker/deployment/amora-worker.service /etc/systemd/system/amora-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now amora-worker.service
```

Cek status dan log worker:
```bash
sudo systemctl status amora-worker.service
sudo journalctl -u amora-worker.service -f
```

---

## 4. Pengujian Akhir
1. Buka browser: `https://wmsdev.my.id/amora/`
2. Pastikan halaman terbuka dengan styling lengkap dan aset termuat.
3. Login ke sistem.
4. Cek session di Redis VM `103.123.100.11`:
   ```bash
   redis-cli -a password_redis_rahasia keys "AMORA_SESSION:*"
   ```
5. Cek worker heartbeat di Redis:
   ```bash
   redis-cli -a password_redis_rahasia get "amora:worker:last_heartbeat"
   ```
