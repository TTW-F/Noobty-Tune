#!/usr/bin/env bash
set -euo pipefail

echo "== Noobty Tune Server Healthcheck =="
echo

echo "[1] Nginx syntax"
sudo /usr/sbin/nginx -t
echo

echo "[2] Services"
systemctl is-active nginx
systemctl is-active noobty-tune-backend.service
echo

echo "[3] Port check"
ss -lnt | awk 'NR==1 || /:80\\b|:443\\b|:3101\\b/'
echo

echo "[4] HTTP(S) checks"
curl -sS -o /dev/null -w "tune.noobty.top HTTP %{http_code}\\n" http://tune.noobty.top
curl -sS -o /dev/null -w "tune.noobty.top HTTPS %{http_code}\\n" https://tune.noobty.top
curl -sS -o /dev/null -w "backend.tune.noobty.top HTTPS %{http_code}\\n" https://backend.tune.noobty.top
curl -sS https://backend.tune.noobty.top/health
echo

echo "[5] TLS cert summary"
sudo certbot certificates | sed -n '1,80p'
echo

echo "[6] Renew dry-run status (skip lock failure)"
set +e
sudo certbot renew --dry-run
RC=$?
set -e
if [[ "$RC" -ne 0 ]]; then
  echo "certbot dry-run exit code: $RC (possible lock if another certbot is running)"
fi
echo

echo "Healthcheck done."
