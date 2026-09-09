# Noobty Tune 部署交接说明(当前状态)

本文档用于项目交接,目标是让后续维护人员快速理解当前线上结构,避免误改导致业务中断。

> **2026-09-10 重要变更**:原生产主机 `47.100.17.7` 已弃用并到期下线。生产入口迁移至云服务器 `106.14.175.93`,后端回到内网机 `192.168.31.35`,通过 FRP 隧道接入。旧机上的相关配置与 DNS 记录已失效,不要再参照旧文档操作。

## 1. 部署现状总览

- 前端域名:`tune.noobty.top`
- 后端域名:`backend.tune.noobty.top`
- 云入口主机:`106.14.175.93`(Ubuntu)
- 后端源机:内网机 `192.168.31.35`(经 FRP 隧道接入,零公网暴露)
- 反向代理:`nginx`(仅云机)
- 证书:Let's Encrypt(正式证书,非自签名)
- 自动部署:GitHub Actions 工作流 `Deploy To Server`(仅覆盖前端静态产物)

## 2. 当前流量路径

- 前端:`https://tune.noobty.top` → 云机 nginx → `/srv/noobty-tune/current`(静态文件)
- 后端:`https://backend.tune.noobty.top` → 云机 nginx → `127.0.0.1:3101`
  → frps 隧道 → 内网机 `192.168.31.35` 的 `127.0.0.1:3101`
- 后端进程:`noobty-tune-backend.service`(运行于内网机,当前为占位健康检查服务)
- 隧道:`noobty-tune-frps.service`(云机)+ `noobty-tune-frpc.service`(内网机)

## 3. 关键目录与配置文件

### 仓库内(版本管理)

- 工作流:`.github/workflows/deploy.yml`
- 发布脚本:`deploy/deploy.sh`
- 前端 Nginx 模板:`deploy/nginx/noobty-tune.conf`
- 后端 Nginx 模板:`deploy/nginx/backend.tune.noobty.top.conf`
- **串站防护兜底**:`deploy/nginx/00-default-catchall.conf`
- FRP 模板:`deploy/frp/frps.toml`(云机)/ `deploy/frp/frpc.toml`(内网机)
- systemd 模板:`deploy/systemd/`(后端、frps、frpc 各一)
- 健康检查脚本:`deploy/scripts/server_healthcheck.sh`(ROLE=cloud / lan)
- 部署文档:`docs/operations/deploy.md`

### 云机内(运行态,106.14.175.93)

- 前端站点:`/etc/nginx/sites-available/noobty-tune.conf`
- 后端站点:`/etc/nginx/sites-available/backend.tune.noobty.top.conf`
- 兜底站点:`/etc/nginx/sites-enabled/00-default-catchall.conf`(必须最先加载)
- 启用链接:`/etc/nginx/sites-enabled/`
- 发布目录:`/srv/noobty-tune/releases`、`/srv/noobty-tune/current`、`/srv/noobty-tune/shared`
- frps:`/etc/noobty-tune/frps.toml` + `noobty-tune-frps.service`

### 内网机内(运行态,192.168.31.35)

- 后端:`/srv/noobty-tune-backend` + `noobty-tune-backend.service`(127.0.0.1:3101)
- frpc:`/etc/noobty-tune/frpc.toml` + `noobty-tune-frpc.service`

## 4. 端口与防火墙约束(必须遵守)

云机(106.14.175.93):

- 公网开放:`22/tcp`(SSH)、`80/tcp`、`443/tcp`、`7500/tcp`(frp 隧道通道)
- 内网本机:`3101/tcp`(frps 打开的隧道端口,**仅 127.0.0.1,不要开放公网**)

内网机(192.168.31.35):

- 后端 `3101` 仅监听 `127.0.0.1`;对外访问一律走 frp 隧道 + 云机 nginx 域名入口

> 旧主机上"3000/8080/8082/1935/1986 已被占用"的约束随旧机弃用作废;新机上的端口冲突情况需在部署时重新盘点(见 deploy.md 第 5 节 default_server 注意事项)。

## 5. GitHub Secrets(仓库级)

工作流依赖以下 Secrets(缺任意一项都会失败):

- `DEPLOY_HOST=106.14.175.93`(已更新)
- `DEPLOY_PORT=22`
- `DEPLOY_USER=deploy_noobty`
- `DEPLOY_PATH=/srv/noobty-tune`
- `DEPLOY_SSH_KEY=<云机部署用户的私钥,需按新机重新录入>`

## 6. 当前证书状态

- 证书覆盖域名:`tune.noobty.top`、`backend.tune.noobty.top`
- 类型:Let's Encrypt,webroot 方式签发,`certbot.timer` 自动续期
- 位置(云机):`/etc/letsencrypt/live/tune.noobty.top/`

常用检查(云机):

```bash
curl -I https://tune.noobty.top
curl -I https://backend.tune.noobty.top
sudo certbot certificates
```

## 7. 日常运维命令(只读/低风险)

```bash
# 一键巡检(云机,含串站检测)
sudo ROLE=cloud /srv/noobty-tune/shared/server_healthcheck.sh

# 一键巡检(内网机)
sudo ROLE=lan /srv/noobty-tune/shared/server_healthcheck.sh

# 服务状态(云机)
systemctl status nginx --no-pager
systemctl status noobty-tune-frps.service --no-pager

# 服务状态(内网机)
systemctl status noobty-tune-backend.service --no-pager
systemctl status noobty-tune-frpc.service --no-pager

# Nginx 语法检查(云机,任何改动后必须先跑)
sudo nginx -t
```

## 8. 变更红线(避免意外)

- 不要修改其他项目的 `server_name`、端口和 conf 文件。
- 不要动 `00-default-catchall.conf` 的兜底语义;`default_server` 每端口只能有一个。
- 不要删除云机 `/srv/noobty-tune/releases` 的历史版本目录。
- 不要将后端端口直接暴露公网,所有后端访问必须经 frp 隧道 + nginx 域名入口。
- 修改 nginx 前必须先 `nginx -t`,通过后再 reload。
- 所有生产改动必须先记录"改了什么、为什么、如何回滚"。

## 9. 后续接手建议

- 若后端改为真实业务服务,在内网机上替换 `/srv/noobty-tune-backend` 内容即可,保持:监听 `127.0.0.1`、systemd 守护、隧道与域名不变。
- 若内网机日后获得稳定公网入口(公网 IP/端口映射),可去掉 frp,把云机 nginx 的 `proxy_pass` 上游直接指向该地址,域名与证书不变。
- 旧主机 `47.100.17.7` 的任何残留 DNS 记录(含其他子域名)应尽快清理,避免解析到已下线机器或被他人接管。

---

最后更新:2026-09-10
维护说明:本文件用于"交接与防误操作",优先保证稳定,再考虑功能扩展。
