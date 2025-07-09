# Deploy VoceSpace

## Prepare

1. nginx
2. pm2
3. npm
4. pnpm
5. node >= 18.2.0
6. certbot

## usage

> [!IMPORTANT]
>
> You need to have root permission!

### fontend deploy
```
// only dev/test
chmod +x auto_deploy_dev.sh
sh auto_deploy_dev.sh

// only production
chmod +x auto_deploy_prod.sh
sh auto_deploy_prod.sh
```

### nginx deploy
```
chmod +x nginx_deploy.sh
sh nginx_deploy.sh
```


```
docker buildx build --platform linux/amd64 --load -t privoce/vocespace:latest .
docker buildx build --platform linux/arm64 --load -t privoce/vocespace:latest_arm .
docker buildx build --platform linux/amd64 --load -t privoce/vocespace:preview .
docker buildx build --platform linux/amd64 --load -t privoce/vocespace:voce_stream
docker buildx build --platform linux/arm64 --load -t privoce/vocespace:voce_stream_arm
```
