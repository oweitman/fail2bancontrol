# Installation via Local Build (GitHub)

## 1. Clone Repository

```bash
git clone https://github.com/oweitman/fail2bancontrol
cd fail2bancontrol
```

---

## 2. Build Docker Image

```bash
docker build -t fail2bancontrol .
```

---

## 3. Provide Fail2ban Socket

```yaml
volumes:
    - /path/to/directory:/var/run/fail2ban
    - ./path/to/logfile:/path/in/container/logfile
```

---

## 4. Run Container

### Docker Compose

```yaml
version: '3.9'
services:
    fail2bancontrol:
        image: fail2bancontrol:latest
        ports:
            - '9191:9000'
        volumes:
            - /path/to/directory:/var/run/fail2ban
            - ./path/to/logfile:/path/in/container/logfile
        environment:
            TZ: Europe/Berlin
        restart: unless-stopped
```

```bash
docker compose up -d
```

---

### docker run

```bash
docker run -d \
  --name fail2bancontrol \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  -v /path/to/logfile:/path/in/container/logfile \
  --restart unless-stopped \
  fail2bancontrol:latest
```

---

## 5. Access UI

```
http://<host>:9191
```
