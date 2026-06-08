# DB Recovery + Lockdown Runbook (CyberPanel / MariaDB)

Post-VM-rebuild recovery + hardening for the SetForge database box.
Context learned during the 2026-06-05 incident:
- Host **CyberPanel** server (control panel on port **8090**, which also serves
  phpMyAdmin). Firewall = **firewalld** (use it, NOT ufw).
- DB restored as **`comp_SetForge`**; `DB_CONFIG` env already updated.
- After rebuild: **`have_ssl = DISABLED`** and the app user existed only as
  **`swimapp@localhost`** (a DB restore brings app data, not the `mysql` user table).
- App connects **remotely over TLS** (`ssl: { rejectUnauthorized:false }`) and
  **hard-exits on a failed DB ping** → container crashloops → 503 on everything.
- Box is on a **public IP** → SSL is mandatory + firewall is mandatory.

Replace placeholders: `<DB_HOST>` (the box's IP), `<DB_PASSWORD>` (swimapp password
from `DB_CONFIG`), `<YOUR_IP>` (your admin machine's public IP), `<APP_IP>`
(Hyperlift egress IP, discovered in Step 5). **Never commit real secrets.**

Do the steps **in order** — each avoids locking out you or the app.

---

## Step 0 — Prep (don't lock yourself out)
1. Confirm you have a **working SSH session** to the box open right now.
2. Get **your** public IP: from your laptop, `curl ifconfig.me`. That's `<YOUR_IP>`.
3. Confirm MariaDB **root** access (you have it via phpMyAdmin).
4. Identify the MariaDB config dir (distro-dependent):
   - RHEL/Alma/CentOS (common for CyberPanel): `/etc/my.cnf.d/`
   - Debian/Ubuntu: `/etc/mysql/mariadb.conf.d/`

## Step 1 — Enable SSL on MariaDB (fixes `have_ssl = DISABLED`)
On the box:
```bash
sudo mkdir -p /etc/mysql/ssl && cd /etc/mysql/ssl
sudo openssl genrsa 2048 > ca-key.pem
sudo openssl req -new -x509 -nodes -days 3650 -key ca-key.pem -out ca-cert.pem -subj "/CN=SetForge-CA"
sudo openssl req -newkey rsa:2048 -days 3650 -nodes -keyout server-key.pem -out server-req.pem -subj "/CN=<DB_HOST>"
sudo openssl rsa -in server-key.pem -out server-key.pem
sudo openssl x509 -req -in server-req.pem -days 3650 -CA ca-cert.pem -CAkey ca-key.pem -set_serial 01 -out server-cert.pem
sudo chown -R mysql:mysql /etc/mysql/ssl
sudo chmod 600 /etc/mysql/ssl/*-key.pem
```
Create a config file in the dir from Step 0.4 (e.g. `…/conf.d/ssl.cnf` or append to
`server.cnf`) under `[mysqld]`:
```
[mysqld]
ssl-ca=/etc/mysql/ssl/ca-cert.pem
ssl-cert=/etc/mysql/ssl/server-cert.pem
ssl-key=/etc/mysql/ssl/server-key.pem
```
Restart + verify:
```bash
sudo systemctl restart mariadb
```
```sql
SHOW VARIABLES LIKE 'have_ssl';   -- must now read YES (not DISABLED)
```
> If it says `have_ssl = NO` (vs DISABLED), the server can't read the certs — check
> the paths + that the files are owned by `mysql` and the `*-key.pem` are mode 600.

## Step 2 — Create the remote app user (only `@localhost` existed)
```sql
CREATE USER 'swimapp'@'%' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON `comp_SetForge`.* TO 'swimapp'@'%' REQUIRE SSL;
FLUSH PRIVILEGES;
SELECT user, host, ssl_type FROM mysql.user WHERE user = 'swimapp';   -- expect: swimapp / % / ANY
```

## Step 3 — Sanity-check the connection locally
From the box (proves user + SSL + db before involving the app):
```bash
mysql -h <DB_HOST> -P 3306 -u swimapp -p'<DB_PASSWORD>' --ssl-mode=REQUIRED comp_SetForge \
  -e "SELECT 1, @@have_ssl, current_user();"
```
Should return a row. If `Access denied` → re-check Step 2. If SSL error → re-check Step 1.

## Step 4 — Restart the app, confirm it connects
- Restart/redeploy the app on Hyperlift so it boots onto the updated `DB_CONFIG`.
- Watch the boot log:
  - `[db] config sources — … name=blob (DB_CONFIG present)`  ← all `blob`
  - a **successful DB ping** (no more `FATAL: DB ping failed`).
- Confirm live: `https://setforge.io/` → 200, `POST /api/generate` → 401 (not 503).

## Step 5 — Discover the app's egress IP
With the app connected:
```sql
SELECT user, host FROM information_schema.processlist WHERE user = 'swimapp';
```
The `host` is Hyperlift's egress IP → `<APP_IP>`. (If it varies across checks, egress
is dynamic — keep the `%` grant + rely on SSL; firewall by range or skip Step 8.)

## Step 6 — Firewall the database (firewalld)
**Open 3306 only to the app:**
```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<APP_IP>" port port="3306" protocol="tcp" accept'
sudo firewall-cmd --permanent --remove-port=3306/tcp    # if 3306 was globally open
sudo firewall-cmd --reload
```

## Step 7 — Lock down the CyberPanel panel (port 8090)
8090 is full server admin + phpMyAdmin — it must NOT be world-open.
**Add your allow rule BEFORE removing the global open, or you lock yourself out:**
```bash
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="<YOUR_IP>" port port="8090" protocol="tcp" accept'
sudo firewall-cmd --permanent --remove-port=8090/tcp
# (optional, most secure) close 8090 entirely and reach it via SSH tunnel:
#   sudo firewall-cmd --permanent --remove-rich-rule='rule family="ipv4" source address="<YOUR_IP>" port port="8090" protocol="tcp" accept'
#   then from your laptop:  ssh -L 8090:localhost:8090 user@<DB_HOST>   → browse http://localhost:8090
sudo firewall-cmd --reload
```
Also confirm **SSH (22)** is allowed for `<YOUR_IP>` (it usually is by default; verify
before relying on the firewall):
```bash
sudo firewall-cmd --list-all
```

## Step 8 — Tighten the DB grant to the app IP (optional; skip if egress is dynamic)
```sql
CREATE USER 'swimapp'@'<APP_IP>' IDENTIFIED BY '<DB_PASSWORD>';
GRANT ALL PRIVILEGES ON `comp_SetForge`.* TO 'swimapp'@'<APP_IP>' REQUIRE SSL;
DROP USER 'swimapp'@'%';
FLUSH PRIVILEGES;
```
(Restart the app or let the pool reconnect; verify it still pings.)

## Step 9 — MariaDB hardening
```bash
sudo mysql_secure_installation
```
Set a strong root password, **remove anonymous users**, **disallow remote root**,
**drop the test DB**, reload privileges. Then:
```sql
SELECT user, host FROM mysql.user;   -- expect only: root@localhost, cyberpanel@localhost, swimapp@<APP_IP or %>
```
Keep MariaDB bound to all interfaces (the app is remote); the firewall is the guard.

## Step 10 — Verify the lockdown
- **App:** boots, ping ok, site 200/401.
- **3306 closed to the world:** from a machine that is NOT the app or your IP:
  `nc -zv <DB_HOST> 3306` → time out / refused.
- **8090 closed to the world:** `https://<DB_HOST>:8090/` from a non-allowlisted
  network → fails; only your IP / SSH tunnel works.
- **SSL enforced:** `SHOW VARIABLES LIKE 'have_ssl';` = YES; `swimapp` has
  `ssl_type = ANY` (REQUIRE SSL).

## Step 11 — Verify the data restore is current (do with Claude)
The restore may predate recent migrations. Confirm these exist (else re-apply
`migrations/049–052`):
```sql
SHOW COLUMNS FROM `teams` LIKE 'team_code';              -- migration 050
SHOW COLUMNS FROM `teams` LIKE 'calendar_feed_token';   -- migration 051
SHOW COLUMNS FROM `team_events` LIKE 'kind';            -- migration 052
SHOW COLUMNS FROM `users` LIKE 'calendar_feed_token';   -- 049 (DROPPED by 051 — should be ABSENT)
```

---

## Notes
- CyberPanel's **Security → Firewall** UI writes to firewalld too; pick CLI *or* UI
  and stay consistent.
- If CyberPanel ever regenerates MariaDB config, re-confirm the `ssl-*` lines persist
  (keeping them in a separate `ssl.cnf` reduces clobber risk).
- Longer term, consider putting the DB on a **private network** with the app instead
  of a public IP, removing the public 3306 surface entirely.
