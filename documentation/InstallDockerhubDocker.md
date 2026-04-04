# Installation via Docker Hub

## 1. Provide Fail2ban Socket

You must mount the Fail2ban socket directory:

```yaml
volumes:
    - /path/to/directory:/var/run/fail2ban
    - ./path/to/logfile:/path/in/container/logfile
```

---

## 2. Run Container

### Option A – Docker Compose

```yaml
version: '3.9'
services:
    fail2bancontrol:
        image: oweitman/fail2bancontrol
        ports:
            - '9191:9000'
        volumes:
            - /path/to/directory:/var/run/fail2ban
            - ./path/to/logfile:/path/in/container/logfile
        environment:
            TZ: Europe/Berlin
        restart: unless-stopped
```

Start:

```bash
docker compose up -d
```

---

### Option B – docker run

```bash
docker run -d \
  --name fail2bancontrol \
  -p 9191:9000 \
  -e TZ=Europe/Berlin \
  -v /path/to/directory:/var/run/fail2ban \
  -v /path/to/logfile:/path/in/container/logfile \
  --restart unless-stopped \
  oweitman/fail2bancontrol
```

---

## 3. Access UI

```
http://<host>:9191
```
