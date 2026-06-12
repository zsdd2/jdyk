# 飞牛 Docker Compose 部署

## 部署内容

- 后端：`ghcr.io/zsdd2/jdyk-backend:latest`
- 管理端：`ghcr.io/zsdd2/jdyk-admin:latest`
- 管理后台：`http://<飞牛IP>:5200`
- 后端 API：`http://<飞牛IP>:3999/api`
- Android 更新检查：
  `http://<飞牛IP>:3999/api/device/app-update/latest`
- Android APK：
  `http://<飞牛IP>:3999/releases/wangri-tv-1.0.apk`

GHCR 镜像为公开镜像，飞牛拉取时不需要 GitHub Token。
Compose 固定跟随 `latest`，以后升级不需要修改版本号。

## 首次安装

将以下文件放在飞牛同一目录：

- `docker-compose.feiniu.yml`
- `.env.feiniu.example`

执行：

```sh
cp .env.feiniu.example .env.feiniu
mkdir -p data/backend data/media-cache data/releases
```

编辑 `.env.feiniu`：

- 一般不需要填写飞牛 IP；后台地址与 APK 地址会根据访问请求自动生成。
- 填写飞牛相册端口、用户名和密码。
- 飞牛相册通过 Docker 的 `host.docker.internal` 自动访问当前宿主机。
- 从 GitHub Release `tv-v1.0` 的 `latest.json` 复制 APK 的 SHA256、大小和发布时间。

下载 Android TV 1.0 APK：

```sh
curl -fL \
  -o data/releases/wangri-tv-1.0.apk \
  https://github.com/zsdd2/jdyk/releases/download/tv-v1.0/wangri-tv-1.0.apk
```

拉取并启动：

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml ps
```

## 验证

```sh
curl -f http://127.0.0.1:3999/api/health
curl -f http://127.0.0.1:5200/healthz
curl -f http://127.0.0.1:5200/api/health
curl -f http://127.0.0.1:3999/api/device/app-update/latest
curl -I http://127.0.0.1:3999/releases/wangri-tv-1.0.apk
```

电视端后台地址填写：

```text
http://<飞牛IP>:3999
```

## 更新

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d
```

`data/` 下的数据库、缓存和 APK 不会因镜像更新而删除。

## 日志与回滚

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml logs -f backend
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml logs -f admin
```

如需回滚，临时将 Compose 中两个镜像的 `latest` 改为已发布的旧版本标签，再执行：

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d
```
