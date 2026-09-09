# Noobty Tune 部署交接说明(当前状态)

本文档用于项目交接,目标是让后续维护人员快速理解当前线上结构,避免误改导致业务中断。

> **2026-09-10 重要变更**:原生产主机 `47.100.17.7` 已弃用下线。生产入口迁移至云服务器 `106.14.175.93`;后端源机为内网机 `192.168.31.35`,经 FRP 隧道接入。同日完成:CI/CD 全链路跑通(新前端已上线)、nginx 串站防护、3101/7500 公网暴露修复。

## 1. 部署现状总览

- 前端域名:`tune.noobty.top`(已指向 `106.14.175.93`)
- 后端域名:`backend.tune.noobty.top`(已指向 `106.14.175.93`)
- 云入口主机:`106.14.175.93`(Ubuntu,**同时承载 blog/tts/video/stream 等多个其他项目,改动需极度克制**)
- 后端源机:内网机 `192.168.31.35`(主机名 qwe-A7S,零公网暴露)
- 反向代理:**自编译 nginx**(`​/usr/local/nginx/sbin/nginx`,含 rtmp 模块,多项目共用)
- 证书:Let's Encrypt(certbot 托管,自动续期)
- 自动部署:GitHub Actions `Deploy To Server`(2026-09-10 已实测全绿)

## 2. 当前流量路径

```
GitHub Actions ── scp dist ──▶ 云机 /srv/noobty-tune/current(原子切换)

浏览器 ── https://tune.noobty.top ──▶ /usr/local/nginx ──▶ 静态文件
浏览器 ── https://backend.tune.noobty.top ──▶ /usr/local/nginx
        ──▶ 127.0.0.1:3101(frps 隧道口)──▶ 内网机 127.0.0.1:3101(后端)
```

- 后端进程:`noobty-tune-backend.service`(**运行于内网机**,当前为占位健康检查服务)
- 隧道:云机 `frps.service`(:7000)+ 内网机 `frpc.service`(v0.52.3)
- ⚠️ 云机上另有一个同名旧单元 `noobty-tune-backend.service`(旧拓扑遗留的占位后端),**已于 2026-09-10 stop + disable**,不要在云机重新启用它

## 3. 关键目录与配置文件

### 仓库内(版本管理)

- 工作流:`.github/workflows/deploy.yml`(node 24)
- 发布脚本:`deploy/deploy.sh`(nginx 路径指向 `/usr/local/nginx/sbin/nginx`)
- nginx 参考模板:`deploy/nginx/`(catch-all 已按其实装到云机)
- FRP 参考模板与说明:`deploy/frp/`
- 后端 systemd 模板(内网机):`deploy/systemd/noobty-tune-backend.service`
- 健康检查:`deploy/scripts/server_healthcheck.sh`(ROLE=cloud / lan)
- 部署文档:`docs/operations/deploy.md`

### 云机内(运行态,106.14.175.93)

- **生效的 nginx 是自编译版**:`/usr/local/nginx/sbin/nginx`,主配置 `/usr/local/nginx/conf/nginx.conf`,站点在 `/usr/local/nginx/conf/conf.d/*.conf`
  - 本项目:`conf.d/tune.conf`(certbot 托管)
  - **串站防护**:`conf.d/00-default-catchall.conf`(default_server → 444)
  - ⚠️ `/etc/nginx/`(发行版 nginx)在这台机上是**死配置**,systemd 单元被 mask,改它没有任何效果
- nginx pid:`/var/run/nginx-rtmp.pid`;reload 只能用 `/usr/local/nginx/sbin/nginx -s reload`
- 发布目录:`/srv/noobty-tune/releases`、`/srv/noobty-tune/current`、`/srv/noobty-tune/shared`
- frps:`/opt/frp-noobty/frps.toml` + `frps.service`
- deploy_noobty sudoers:`/etc/sudoers.d/deploy_noobty_nginx`(授权自编译 nginx 的 -t / -s reload)

### 内网机内(运行态,192.168.31.35)

- 后端:`/srv/noobty-tune-backend/` + `noobty-tune-backend.service`(127.0.0.1:3101,用户 noobty)
- frpc:`/home/qwe/frp_0.52.3_linux_amd64/frpc.ini`(多服务共用,本项目段为 `[noobty-tune-backend]`)

## 4. 端口与防火墙约束(必须遵守)

云机:

- 公网开放:`22`、`80`、`443`、`7000`(frp 隧道通道)
- **已被 iptables 阻断外网(2026-09-10,规则已持久化)**:`3101`(后端隧道口)、`7500`(frps 管理面板)——仅限本机访问;修复前 3101/7500 曾对公网裸奔
- `8080` 为 frps vhost 口,承载 tts 等其他项目的 http 型代理,**不要动**

内网机:

- 后端 `3101` 仅监听 `127.0.0.1`;对外访问一律走 frp 隧道 + 云机 nginx 域名入口

## 5. GitHub Secrets(仓库级)

- `DEPLOY_HOST=106.14.175.93`(2026-09-10 已更新)
- `DEPLOY_PORT=22`
- `DEPLOY_USER=deploy_noobty`
- `DEPLOY_PATH=/srv/noobty-tune`
- `DEPLOY_SSH_KEY=<ed25519 私钥,2026-09-10 轮换,公钥已装入云机 deploy_noobty>`

## 6. 串站问题(已根治,备查)

**现象**:其他项目的域名被导到本项目。

**根因**:这台机承载多个项目,但 nginx 没有任何 `default_server` 兜底站点。nginx 对每个端口都有"隐式默认站点"——Host 匹配不到任何 `server_name` 的请求(域名解析到本机但本机无对应 server 块、直接用 IP 访问等)会交给加载顺序最前的 conf,本项目 conf 排序靠前于是成了接盘侠。

**修复**:在**生效的**配置树 `/usr/local/nginx/conf/conf.d/` 安装 `00-default-catchall.conf`(`default_server` + `return 444`)。已验证:未知域名/IP 一律断开,其他项目与本项目均正常。仓库内 `deploy/nginx/00-default-catchall.conf` 为同内容的版本管理副本。

## 7. 日常运维命令

```bash
# 云机巡检(nginx/frps/域名/证书/串站检测)
sudo ROLE=cloud bash /srv/noobty-tune/shared/server_healthcheck.sh

# 内网机巡检(后端/frpc/隧道日志)
sudo ROLE=lan bash deploy/scripts/server_healthcheck.sh

# 云机 nginx(注意:必须用自编译二进制)
/usr/local/nginx/sbin/nginx -t
/usr/local/nginx/sbin/nginx -s reload

# 服务状态
systemctl status frps --no-pager            # 云机
systemctl status noobty-tune-backend frpc   # 内网机

# 回滚前端
ln -sfn <old_release> /srv/noobty-tune/current && /usr/local/nginx/sbin/nginx -s reload
```

## 8. 变更红线(避免意外)

- 云机是多项目共用机:不要动 `/usr/local/nginx/conf/conf.d/` 里其他项目的 conf,不要全局开 ufw(会误伤其他服务端口)。
- 不要动 `00-default-catchall.conf` 的兜底语义;`default_server` 每端口只能有一个。
- 不要删除 `/srv/noobty-tune/releases` 历史版本;不要在云机重新启用旧的后端占位单元。
- reload nginx 只能用 `/usr/local/nginx/sbin/nginx`;`/etc/nginx` 与 `/usr/sbin/nginx` 在该机是死路径。
- frpc.ini 被内网机多个服务共用;改动前备份,重启 frpc 会瞬断全部隧道。
- 所有生产改动必须先记录"改了什么、为什么、如何回滚"。

## 9. 遗留事项

- frps 管理面板口令仍为弱口令(admin/moss2026,外网已无法访问,但建议尽快更换)。
- 旧机 `47.100.17.7` 的历史 DNS 记录应清理。
- 后端目前仍是占位服务;真实后端就绪后替换内网机 `/srv/noobty-tune-backend` 内容即可,隧道与域名不变。

---

最后更新:2026-09-10
维护说明:本文件用于"交接与防误操作",优先保证稳定,再考虑功能扩展。
