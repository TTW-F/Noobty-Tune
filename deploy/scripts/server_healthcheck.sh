#!/usr/bin/env bash
# ============================================================
# Noobty Tune 一键巡检
#
# 用法(在对应机器上执行):
#   ROLE=cloud bash server_healthcheck.sh   # 云服务器 106.14.175.93
#   ROLE=lan   bash server_healthcheck.sh   # 内网后端机 192.168.31.35
# ============================================================
set -euo pipefail

ROLE="${ROLE:-cloud}"

echo "== Noobty Tune Server Healthcheck (role: $ROLE) =="
echo

if [[ "$ROLE" == "cloud" ]]; then
  echo "[1] Nginx syntax"
  sudo /usr/local/nginx/sbin/nginx -t
  echo

  echo "[2] Services"
  pgrep -x nginx > /dev/null && echo nginx-running || echo nginx-DOWN
  systemctl is-active frps.service
  echo

  echo "[3] Port check (80/443 对外, 3101 仅本机, 7500 frps)"
  ss -lnt | awk 'NR==1 || /:80\b|:443\b|:3101\b|:7500\b/'
  echo

  echo "[4] HTTP(S) checks"
  curl -sS -o /dev/null -w "tune.noobty.top HTTPS %{http_code}\n" https://tune.noobty.top
  curl -sS -o /dev/null -w "backend.tune.noobty.top HTTPS %{http_code}\n" https://backend.tune.noobty.top
  curl -sS https://backend.tune.noobty.top/health
  echo
  echo

  echo "[5] 串站检测(未知 Host 必须拿不到响应,期望 000)"
  CODE=$(curl -s -o /dev/null -m 5 -w "%{http_code}" -H "Host: unknown.example.com" http://127.0.0.1/ || true)
  if [[ "$CODE" == "000" ]]; then
    echo "OK: unknown host rejected (444)."
  else
    echo "WARN: unknown host got HTTP $CODE — catch-all 兜底站点未生效,存在串站风险!"
  fi
  echo

  echo "[6] TLS cert summary"
  sudo certbot certificates | sed -n '1,80p'
  echo

  echo "[7] Renew dry-run status (skip lock failure)"
  set +e
  sudo certbot renew --dry-run
  RC=$?
  set -e
  if [[ "$RC" -ne 0 ]]; then
    echo "certbot dry-run exit code: $RC (possible lock if another certbot is running)"
  fi
elif [[ "$ROLE" == "lan" ]]; then
  echo "[1] Services"
  systemctl is-active noobty-tune-backend.service
  systemctl is-active noobty-tune-frpc.service
  echo

  echo "[2] Port check (3101 后端仅本机)"
  ss -lnt | awk 'NR==1 || /:3101\b/'
  echo

  echo "[3] Local backend health"
  curl -sS http://127.0.0.1:3101/health
  echo
  echo

  echo "[4] frpc connection status"
  journalctl -u noobty-tune-frpc.service -n 20 --no-pager || true
else
  echo "Unknown ROLE '$ROLE'. Use ROLE=cloud or ROLE=lan."
  exit 1
fi

echo
echo "Healthcheck done."
