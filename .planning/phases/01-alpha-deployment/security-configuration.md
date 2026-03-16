# Alpha Access Control & Security Configuration

**Milestone**: v2.1.0 - Alpha Launch & Stabilization
**Phase**: 1.1 - Alpha Environment Setup
**Task**: 1.1.4 - Access Control & Security
**Date**: 2026-03-16

---

## Overview

This document outlines the security configuration for the alpha environment, including SSH access, firewall rules, API rate limiting, and general security hardening.

---

## 1. SSH Access Configuration

### SSH Key Setup

#### Generate SSH Key (if not already available)

```bash
# Generate ED25519 key (recommended)
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/armored-archer-alpha

# Or generate RSA key (4096 bits)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f ~/.ssh/armored-archer-alpha
```

#### Add SSH Key to Server

```bash
# Copy public key to server
ssh-copy-id -i ~/.ssh/armored-archer-alpha.pub user@alpha-server

# Or manually add to authorized_keys
cat ~/.ssh/armored-archer-alpha.pub | ssh user@alpha-server "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### SSH Server Hardening

Edit `/etc/ssh/sshd_config`:

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication
PasswordAuthentication no

# Enable public key authentication only
PubkeyAuthentication yes

# Disable X11 forwarding
X11Forwarding no

# Limit max authentication attempts
MaxAuthTries 3

# Set idle timeout
ClientAliveInterval 300
ClientAliveCountMax 2

# Use strong ciphers only
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com

# Use strong MACs only
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
```

Restart SSH service:

```bash
sudo systemctl restart sshd
```

### SSH Config for Team Access

Create `~/.ssh/config`:

```
Host armored-archer-alpha
    HostName <alpha-server-ip>
    User <username>
    IdentityFile ~/.ssh/armored-archer-alpha
    IdentitiesOnly yes
    AddKeysToAgent yes
    ServerAliveInterval 60
```

---

## 2. Firewall Configuration

### UFW (Ubuntu/Debian)

```bash
# Enable UFW
sudo ufw enable

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (rate limited)
sudo ufw limit ssh

# Allow Nakama API
sudo ufw allow 7350/tcp comment "Nakama API"

# Allow Nakama Console (restrict to admin IPs)
sudo ufw allow from <admin-ip> to any port 7351 proto tcp comment "Nakama Console"

# Allow HTTPS (if using reverse proxy)
sudo ufw allow https

# Deny database ports from external access
sudo ufw deny 5432/tcp comment "PostgreSQL - internal only"
sudo ufw deny 6379/tcp comment "Redis - internal only"

# Allow monitoring ports (internal only)
sudo ufw deny 9090/tcp comment "Prometheus - internal only"
sudo ufw deny 3000/tcp comment "Grafana - internal only"

# Enable UFW
sudo ufw enable

# Check status
sudo ufw status verbose
```

### iptables (Alternative)

```bash
# Flush existing rules
sudo iptables -F

# Set default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (rate limited)
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow Nakama API
sudo iptables -A INPUT -p tcp --dport 7350 -j ACCEPT

# Allow Nakama Console from admin IP only
sudo iptables -A INPUT -p tcp --dport 7351 -s <admin-ip>/32 -j ACCEPT

# Allow HTTPS
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Log dropped packets
sudo iptables -A INPUT -j LOG --log-prefix "DROPPED: " --log-level 4

# Save rules
sudo iptables-save > /etc/iptables/rules.v4
```

### Firewall Verification

```bash
# Check UFW status
sudo ufw status verbose

# Check listening ports
sudo netstat -tulpn | grep LISTEN

# Test port accessibility
nc -zv localhost 7350
nc -zv localhost 22
```

---

## 3. API Rate Limiting

### Nakama Rate Limiting Configuration

Rate limiting is configured in `.env.alpha`:

```bash
# Enable rate limiting
RATE_LIMIT_ENABLED=true

# Default rate limit
RATE_LIMIT_DEFAULT_MAX_REQUESTS=200
RATE_LIMIT_DEFAULT_WINDOW_MS=60000

# Endpoint-specific limits
RATE_LIMIT_HEALTH_CHECK_MAX=500
RATE_LIMIT_GET_PLAYER_STATS_MAX=100
RATE_LIMIT_SUBMIT_COMBAT_ACTION_MAX=20
RATE_LIMIT_VALIDATE_PURCHASE_MAX=30
```

### Rate Limiting Implementation

The backend implements rate limiting using express-rate-limit middleware.

Key endpoints and their limits:

| Endpoint | Max Requests | Window (ms) | Purpose |
|----------|-------------|-------------|---------|
| /health | 500 | 60000 | Health checks |
| /api/nakama/rpc/armored_archer/get_player_stats | 100 | 60000 | Player stats |
| /api/nakama/rpc/armored_archer/submit_combat_action | 20 | 10000 | Combat actions |
| /api/nakama/rpc/armored_archer/validate_purchase | 30 | 60000 | Purchase validation |

### Rate Limit Headers

Responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1647382800
```

### Rate Limit Exceeded Response

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 45
}
```

---

## 4. DDoS Protection

### Basic DDoS Mitigation

#### Fail2Ban Configuration

Install and configure Fail2Ban:

```bash
# Install Fail2Ban
sudo apt-get install fail2ban

# Create jail configuration
sudo nano /etc/fail2ban/jail.local
```

`/etc/fail2ban/jail.local`:

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 3600
```

Start Fail2Ban:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Cloud-Based DDoS Protection

For production, consider:

- **Cloudflare**: Free DDoS protection and CDN
- **AWS Shield**: AWS DDoS protection service
- **Google Cloud Armor**: GCP DDoS protection

---

## 5. Security Groups & IAM (Cloud Environments)

### AWS Security Group Example

```json
{
  "GroupName": "armored-archer-alpha",
  "IpPermissions": [
    {
      "IpProtocol": "tcp",
      "FromPort": 22,
      "ToPort": 22,
      "IpRanges": [{"CidrIp": "<admin-ip>/32", "Description": "SSH from admin"}]
    },
    {
      "IpProtocol": "tcp",
      "FromPort": 7350,
      "ToPort": 7350,
      "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Nakama API"}]
    },
    {
      "IpProtocol": "tcp",
      "FromPort": 443,
      "ToPort": 443,
      "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTPS"}]
    }
  ],
  "IpPermissionsEgress": [
    {
      "IpProtocol": "-1",
      "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Allow all outbound"}]
    }
  ]
}
```

---

## 6. Security Checklist

### Pre-Deployment Security Audit

- [ ] SSH key-based authentication enabled
- [ ] SSH root login disabled
- [ ] SSH password authentication disabled
- [ ] Firewall configured and enabled
- [ ] Only necessary ports open
- [ ] Rate limiting enabled
- [ ] Fail2Ban installed and configured
- [ ] Database not exposed to public internet
- [ ] Monitoring ports not exposed to public internet
- [ ] HTTPS configured (if using domain)
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Default passwords changed
- [ ] Secrets rotated from development values

### Verification Commands

```bash
# Check SSH configuration
sudo sshd -T | grep -E "permitrootlogin|passwordauthentication|pubkeyauthentication"

# Check firewall status
sudo ufw status verbose

# Check listening ports
sudo netstat -tulpn | grep LISTEN

# Check Fail2Ban status
sudo systemctl status fail2ban

# Check for default passwords
grep -r "changeme" /opt/armored-archer/backend/.env* 2>/dev/null || echo "No default passwords found"
```

---

## 7. Security Monitoring

### Log Monitoring

Monitor security-related logs:

```bash
# SSH authentication logs
sudo tail -f /var/log/auth.log

# Fail2Ban logs
sudo tail -f /var/log/fail2ban.log

# Application logs
docker-compose logs -f nakama | grep -i "error\|warn\|auth"
```

### Alert Configuration

Configure alerts for:

- Multiple failed SSH login attempts
- Rate limit violations
- Authentication failures
- Unusual traffic patterns

---

## 8. Incident Response

### SSH Compromise

If SSH is compromised:

1. Revoke all SSH keys
2. Generate new SSH keys
3. Update authorized_keys on server
4. Review auth.log for unauthorized access
5. Check for unauthorized users: `cat /etc/passwd`

### API Abuse

If API is being abused:

1. Check rate limit logs
2. Identify offending IPs
3. Block IPs in firewall
4. Consider lowering rate limits
5. Review logs for successful exploits

---

## 9. Security Updates

### Regular Maintenance

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Check for npm vulnerabilities
cd backend && npm audit

# Check for Go module vulnerabilities
cd backend && go list -m -json all | grep -i vuln
```

---

## Next Steps

After security configuration:

1. Proceed to Task 1.1.5 - CI/CD Pipeline Configuration
2. Test all security measures
3. Document any custom security requirements
4. Schedule regular security audits

---

**Created**: 2026-03-16
**Status**: 📋 Ready for Execution
