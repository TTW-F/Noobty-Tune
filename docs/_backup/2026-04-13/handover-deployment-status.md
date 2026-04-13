# Noobty Tune 部署交接说明（当前状态）

本文档用于项目交接，目标是让后续维护人员快速理解当前线上结构，避免误改导致业务中断。

## 1. 部署现状总览

- 前端域名：`tune.noobty.top`
- 后端域名：`backend.tune.noobty.top`
- 部署主机：`47.100.17.7`（Ubuntu 24.04）
- 反向代理：`nginx`
- 证书：Let’s Encrypt（正式证书，非自签名）
- 自动部署：GitHub Actions 工作流 `Deploy To Server`

## 2. 当前流量路径

- 前端：`https://tune.noobty.top` -> `nginx` -> `/srv/noobty-tune/current`（静态文件）
- 后端：`https://backend.tune.noobty.top` -> `nginx` -> `127.0.0.1:3101`
- 后端进程：`noobty-tune-backend.service`（当前为占位健康检查服务）

## 3. 关键目录与配置文件

### 仓库内（版本管理）

- 工作流：`.github/workflows/deploy.yml`
- 发布脚本：`deploy/deploy.sh`
- 前端 Nginx 模板：`deploy/nginx/noobty-tune.conf`
- 后端 Nginx 模板：`deploy/nginx/backend.tune.noobty.top.conf`
- 后端 systemd 模板：`deploy/systemd/noobty-tune-backend.service`
- 健康检查脚本：`deploy/scripts/server_healthcheck.sh`
- 部署文档：`docs/deploy.md`

### 服务器内（运行态）

- 前端站点：`/etc/nginx/sites-available/noobty-tune.conf`
- 后端站点：`/etc/nginx/sites-available/backend.tune.noobty.top.conf`
- 启用链接：`/etc/nginx/sites-enabled/`
- 发布目录：
  - `/srv/noobty-tune/releases`
  - `/srv/noobty-tune/current`
  - `/srv/noobty-tune/shared`
- 后端服务：`/etc/systemd/system/noobty-tune-backend.service`

## 4. 端口与防火墙约束（必须遵守）

- 公网开放：
  - `22/tcp`（SSH）
  - `80/tcp`（HTTP，证书校验与跳转）
  - `443/tcp`（HTTPS）
- 内网本机：
  - `3101/tcp`（后端服务，仅 `127.0.0.1`，不要开放公网）

禁止把 `3101` 暴露到公网，所有后端访问必须经 `nginx` 域名入口。

## 5. GitHub Secrets（仓库级）

工作流依赖以下 Secrets（缺任意一项都会失败）：

- `DEPLOY_HOST=47.100.17.7`
- `DEPLOY_PORT=22`
- `DEPLOY_USER=deploy_noobty`
- `DEPLOY_PATH=/srv/noobty-tune`
- `DEPLOY_SSH_KEY=<部署私钥>`

## 6. 当前证书状态

- 证书覆盖域名：
  - `tune.noobty.top`
  - `backend.tune.noobty.top`
- 类型：Let’s Encrypt ECDSA 证书
- 自动续期：`certbot.timer` 已启用

常用检查：

```bash
curl -I https://tune.noobty.top
curl -I https://backend.tune.noobty.top
sudo certbot certificates
```

## 7. 日常运维命令（只读/低风险）

```bash
# 一键巡检
/srv/noobty-tune/shared/server_healthcheck.sh

# 服务状态
systemctl status nginx --no-pager
systemctl status noobty-tune-backend.service --no-pager

# Nginx 语法检查
sudo nginx -t
```

## 8. 变更红线（避免意外）

- 不要修改其他历史项目的 `server_name`、端口和 conf 文件。
- 不要删除 `/srv/noobty-tune/releases` 的历史版本目录。
- 不要将后端端口改为已占用端口（如 `3000`、`8080`、`8082`、`1935`、`1986` 等）。
- 修改前必须先 `nginx -t`，通过后再 reload。
- 所有生产改动必须先记录“改了什么、为什么、如何回滚”。

## 9. 后续接手建议

- 若后端改为真实业务服务，优先保持：
  - 监听 `127.0.0.1`
  - 仅通过 `nginx` 暴露域名
  - 保留 systemd 自启动与重启策略
- 若后期改为 FRP 内网穿透，仅修改后端 `proxy_pass` 上游，域名与证书不变。

---

最后更新：2026-04-13  
维护说明：本文件用于“交接与防误操作”，优先保证稳定，再考虑功能扩展。
