# Infrastructure Audit Checklist - Alpha Environment

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 1.1 - Alpha Environment Setup
**Task**: 1.1.1 - Infrastructure Audit
**Date**: 2026-03-16
**Status**: 📋 Pending Verification

---

## Server/Container Resources

### Compute Resources

| Resource | Minimum Required | Current Status | Verified |
|----------|-----------------|----------------|----------|
| CPU Cores | 2 cores | ⏳ To verify | ☐ |
| RAM | 4 GB | ⏳ To verify | ☐ |
| Disk Space | 20 GB | ⏳ To verify | ☐ |
| Network Bandwidth | 100 Mbps | ⏳ To verify | ☐ |

### Verification Commands

```bash
# Check CPU
nproc
cat /proc/cpuinfo | grep processor | wc -l

# Check RAM
free -h
cat /proc/meminfo | grep MemTotal

# Check Disk
df -h
df -h /var/lib/docker

# Check Network
ethtool eth0 | grep Speed
```

---

## Network Configuration

### Firewall Rules

| Port | Service | Required | Status | Verified |
|------|---------|----------|--------|----------|
| 22 | SSH | ✅ Yes | ⏳ To verify | ☐ |
| 7350 | Nakama API | ✅ Yes | ⏳ To verify | ☐ |
| 7351 | Nakama Console | ✅ Yes | ☐ Optional | ☐ |
| 5432 | PostgreSQL | ⚠️ Internal only | ⏳ To verify | ☐ |
| 6379 | Redis | ⚠️ Internal only | ⏳ To verify | ☐ |
| 9090 | Prometheus | ⚠️ Internal only | ⏳ To verify | ☐ |
| 3000 | Grafana | ⚠️ Internal only | ⏳ To verify | ☐ |
| 9093 | Alertmanager | ⚠️ Internal only | ⏳ To verify | ☐ |
| 9100 | Node Exporter | ⚠️ Internal only | ⏳ To verify | ☐ |

### Verification Commands

```bash
# Check firewall rules (Ubuntu/Debian)
sudo ufw status verbose
sudo iptables -L -n -v

# Check firewall rules (CentOS/RHEL)
sudo firewall-cmd --list-all

# Check listening ports
sudo netstat -tulpn | grep LISTEN
sudo ss -tulpn | grep LISTEN

# Test port accessibility
nc -zv localhost 7350
nc -zv localhost 5432
```

### Network Security Groups

- [ ] SSH (22) restricted to known IPs only
- [ ] Nakama API (7350) open to public/internet
- [ ] Nakama Console (7351) restricted to admin IPs
- [ ] Database ports NOT exposed to public internet
- [ ] Monitoring ports NOT exposed to public internet

---

## Domain/DNS Configuration

### DNS Records

| Record | Type | Value | Status | Verified |
|--------|------|-------|--------|----------|
| api.armored-archer.com | A | <server-ip> | ⏳ To configure | ☐ |
| staging.armored-archer.com | A | <server-ip> | ⏳ To configure | ☐ |
| grafana.armored-archer.com | A | <server-ip> | ⏳ To configure | ☐ |

### Verification Commands

```bash
# Check DNS resolution
dig api.armored-archer.com
dig staging.armored-archer.com
nslookup api.armored-archer.com

# Verify SSL certificate
openssl s_client -connect api.armored-archer.com:443 -servername api.armored-archer.com
```

---

## SSL/TLS Certificates

### Certificate Requirements

| Domain | Issuer | Expiry | Status | Verified |
|--------|--------|--------|--------|----------|
| api.armored-archer.com | Let's Encrypt | ⏳ To check | ⏳ To verify | ☐ |
| staging.armored-archer.com | Let's Encrypt | ⏳ To check | ⏳ To verify | ☐ |

### Verification Commands

```bash
# Check certificate with certbot
sudo certbot certificates

# Check certificate expiry
echo | openssl s_client -connect api.armored-archer.com:443 2>/dev/null | openssl x509 -noout -dates

# Auto-renewal check
sudo systemctl status certbot.timer
```

### SSL Configuration

- [ ] TLS 1.2 or higher enforced
- [ ] Strong cipher suites configured
- [ ] HTTP to HTTPS redirect configured
- [ ] HSTS header configured
- [ ] Certificate auto-renewal configured

---

## Load Balancer Configuration

### Load Balancer Status

| Component | Status | Verified |
|-----------|--------|----------|
| Load Balancer Present | ☐ Yes ☐ No | ☐ |
| Health Checks Configured | ☐ Yes ☐ No ☐ N/A | ☐ |
| SSL Termination | ☐ Yes ☐ No ☐ N/A | ☐ |
| Sticky Sessions | ☐ Yes ☐ No ☐ N/A | ☐ |

### If Using Nginx Reverse Proxy

```nginx
# Example configuration
upstream nakama_backend {
    server 127.0.0.1:7350;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.armored-archer.com;

    ssl_certificate /etc/letsencrypt/live/armored-archer.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/armored-archer.com/privkey.pem;

    location / {
        proxy_pass http://nakama_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

---

## Docker Environment Verification

### Docker Status

```bash
# Check Docker version
docker --version
docker-compose --version

# Check Docker daemon
sudo systemctl status docker

# Check available resources
docker system df
docker info | grep -E "CPUs|Memory"
```

### Container Resources

| Resource | Limit | Current | Verified |
|----------|-------|---------|----------|
| Docker CPU Limit | Not set | ⏳ To verify | ☐ |
| Docker Memory Limit | Not set | ⏳ To verify | ☐ |
| Docker Storage Driver | overlay2 | ⏳ To verify | ☐ |

---

## Infrastructure Summary

### Current Status

| Category | Status | Notes |
|----------|--------|-------|
| Compute Resources | ⏳ Pending | Awaiting server access |
| Network Configuration | ⏳ Pending | Awaiting server access |
| DNS Configuration | ⏳ Pending | Awaiting domain setup |
| SSL/TLS Certificates | ⏳ Pending | Awaiting domain setup |
| Load Balancer | ⏳ Pending | Optional for alpha |

### Action Items

1. [ ] Obtain SSH access to alpha server
2. [ ] Run resource verification commands
3. [ ] Configure firewall rules
4. [ ] Set up DNS records
5. [ ] Install SSL certificates
6. [ ] Configure reverse proxy (optional for alpha)

---

## Pre-Flight Checklist

Before proceeding to Task 1.1.2:

- [ ] Server accessible via SSH
- [ ] Docker and Docker Compose installed
- [ ] Minimum resource requirements met
- [ ] Firewall rules configured
- [ ] DNS records propagated (if using domain)
- [ ] SSL certificates installed (if using HTTPS)

---

**Next Step**: Once infrastructure is verified, proceed to Task 1.1.2 - Environment Configuration

**Created**: 2026-03-16
**Last Updated**: 2026-03-16
