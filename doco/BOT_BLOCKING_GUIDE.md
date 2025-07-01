# Bot Blocking and Security Configuration

This document explains the comprehensive bot blocking and security measures implemented for the nginx server.

## Overview

The configuration implements multiple layers of protection:

1. **User-Agent Based Blocking** - Blocks known bad bots and scrapers
2. **Rate Limiting** - Prevents abuse through request limits
3. **Security Headers** - Adds protective HTTP headers
4. **Path-Based Blocking** - Blocks access to sensitive paths
5. **Connection Limiting** - Limits concurrent connections per IP

## Configuration Files

### `/etc/nginx/conf.d/bot-blocking.conf`
- Defines user-agent patterns for blocking unwanted bots
- Uses nginx map directive for efficient pattern matching
- Includes allowlist for legitimate search engines
- Blocks 200+ common bot patterns including:
  - Generic crawlers and scrapers
  - Security scanners
  - Aggressive SEO tools
  - Automated tools (curl, wget, etc.)

### `/etc/nginx/conf.d/rate-limiting.conf`
- Sets up rate limiting zones:
  - **General**: 10 req/sec for normal pages
  - **API**: 5 req/sec for API endpoints
  - **Auth**: 1 req/sec for authentication
  - **Static**: 50 req/sec for assets
  - **Bots**: 1 req/min for identified bots

### `/etc/nginx/conf.d/security.conf`
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Blocks common exploit attempts
- Hides nginx version
- Blocks suspicious query strings and methods

### `/etc/nginx/conf.d/main-config.conf`
- Includes all configurations
- Sets up custom logging for blocked requests

## How It Works

### Bot Detection
1. Request comes in with User-Agent header
2. `$bot_ua` map checks if User-Agent matches bot patterns
3. `$allowed_bot` map checks if it's a legitimate bot to allow
4. `$block_bot` map makes final decision
5. If `$block_bot = 1`, nginx returns 444 (connection closed)

### Rate Limiting
- Uses nginx's `limit_req` module
- Different zones for different endpoint types
- Burst limits allow temporary spikes
- `nodelay` prevents queueing of excess requests

### Response Codes
- **444**: Connection closed (bot blocked)
- **429**: Too Many Requests (rate limited)
- **200**: Normal successful response

## Monitoring and Analysis

### Log Files
- `/var/log/nginx/access.log` - Standard access log
- `/var/log/nginx/error.log` - Error log
- `/var/log/nginx/blocked_requests.log` - Special log for blocked requests

### Analysis Script
Use the provided bot analysis script:

```bash
# Analyze last 24 hours
./scripts/bot-analysis.sh

# Analyze last 6 hours
./scripts/bot-analysis.sh /var/log/nginx/access.log 6

# Analyze specific log file
./scripts/bot-analysis.sh /var/log/nginx/access.log.1 24
```

The script provides:
- Top user agents
- Top IP addresses
- Bot activity summary
- Blocked request statistics
- Rate limiting statistics

### Real-time Monitoring

```bash
# Monitor bot traffic in real-time
tail -f /var/log/nginx/access.log | grep -E '(bot|spider|crawl)'

# Monitor blocked requests
tail -f /var/log/nginx/access.log | grep ' 444 '

# Monitor rate limited requests
tail -f /var/log/nginx/access.log | grep ' 429 '
```

## Customization

### Adding New Bot Patterns
Edit `/etc/nginx/conf.d/bot-blocking.conf` and add patterns to the `$bot_ua` map:

```nginx
~*newbotname 1;
```

### Allowing Specific Bots
Add patterns to the `$allowed_bot` map:

```nginx
~*legitimatebot 0;
```

### Adjusting Rate Limits
Edit `/etc/nginx/conf.d/rate-limiting.conf`:

```nginx
# More restrictive: 5 requests per second
limit_req_zone $binary_remote_addr zone=general:10m rate=5r/s;

# More permissive: 20 requests per second
limit_req_zone $binary_remote_addr zone=general:10m rate=20r/s;
```

### Whitelisting IPs
To allow specific IPs to bypass restrictions, add to your server block:

```nginx
# Allow your monitoring service
if ($remote_addr = "1.2.3.4") {
    set $block_bot 0;
}
```

## Testing

### Test Bot Blocking
```bash
# Should be blocked (returns 444 or no response)
curl -H "User-Agent: BadBot/1.0" https://littledan.com/

# Should work normally
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" https://littledan.com/
```

### Test Rate Limiting
```bash
# Rapid requests should trigger 429 after burst limit
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" https://littledan.com/api/; done
```

## Performance Impact

The bot blocking configuration has minimal performance impact:

- Map lookups are O(1) operations
- Rate limiting uses shared memory zones
- Security headers add ~1KB per response
- Connection limits prevent resource exhaustion

## Legitimate Traffic

The configuration is designed to allow legitimate traffic:

- ✅ Real browsers and users
- ✅ Major search engines (Google, Bing, etc.)
- ✅ Legitimate monitoring services (if configured)
- ✅ Your own applications and services

## Maintenance

### Regular Tasks
1. Review bot analysis reports weekly
2. Update bot patterns as new threats emerge
3. Monitor rate limiting effectiveness
4. Adjust limits based on traffic patterns

### Log Rotation
Ensure nginx logs are rotated to prevent disk space issues:

```bash
# Check current log rotation
sudo logrotate -d /etc/logrotate.d/nginx

# Force rotation if needed
sudo logrotate -f /etc/logrotate.d/nginx
```

## Troubleshooting

### Common Issues

1. **Legitimate traffic blocked**
   - Check User-Agent in logs
   - Add exception to `$allowed_bot` map

2. **Rate limits too restrictive**
   - Increase burst limits
   - Adjust rate limits in zone definitions

3. **Configuration errors**
   - Test with: `sudo nginx -t`
   - Check error logs: `sudo tail -f /var/log/nginx/error.log`

### Emergency Disable
To quickly disable bot blocking:

```bash
# Comment out the bot blocking check in your site config
sudo sed -i 's/if ($block_bot = 1)/# if ($block_bot = 1)/' /etc/nginx/sites-available/littledan.com
sudo nginx -t && sudo systemctl reload nginx
```

## Security Considerations

- Bot blocking is not a complete security solution
- Consider additional measures like fail2ban for persistent attackers
- Regularly update and review blocking patterns
- Monitor for bypass attempts
- Keep nginx and system updated

## References

- [nginx rate limiting](http://nginx.org/en/docs/http/ngx_http_limit_req_module.html)
- [nginx map module](http://nginx.org/en/docs/http/ngx_http_map_module.html)
- [nginx security headers](https://nginx.org/en/docs/http/ngx_http_headers_module.html)
