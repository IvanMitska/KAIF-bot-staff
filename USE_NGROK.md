# Быстрый запуск Web App с ngrok

## Вариант 1: Используйте ngrok в Docker (без регистрации)

```bash
docker run -it -p 4040:4040 --rm --link webapp ngrok/ngrok http host.docker.internal:3001
```

## Вариант 2: Зарегистрируйтесь на ngrok (бесплатно)

1. Зайдите на https://dashboard.ngrok.com/signup
2. Получите authtoken
3. Установите токен:
```bash
ngrok config add-authtoken YOUR_TOKEN
```
4. Запустите туннель:
```bash
ngrok http 3001
```

## Вариант 3: Используйте bore.pub (без регистрации)

```bash
# Установите bore
cargo install bore-cli

# Или скачайте готовый бинарник
wget https://github.com/ekzhang/bore/releases/download/v0.5.0/bore-x86_64-apple-darwin
chmod +x bore-x86_64-apple-darwin
sudo mv bore-x86_64-apple-darwin /usr/local/bin/bore

# Запустите туннель
bore local 3001 --to bore.pub
```

## Вариант 4: Используйте localhost.run (без регистрации)

```bash
ssh -R 80:localhost:3001 nokey@localhost.run
```

## Вариант 5: Используйте CloudFlare Tunnel

```bash
# Установка для macOS
brew install cloudflare/cloudflare/cloudflared

# Запуск туннеля
cloudflared tunnel --url http://localhost:3001
```