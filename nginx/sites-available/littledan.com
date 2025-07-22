server {
    server_name littledan.com www.littledan.com;

    root /var/www/littledan.com;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    # Tightened CSP policy - no CDN dependencies
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Block suspicious query strings
    if ($query_string ~* "(\<|%3C).*script.*(\>|%3E)") {
        return 444;
    }
    if ($query_string ~* "GLOBALS(=|\[|\%[0-9A-Z]{0,2})") {
        return 444;
    }
    if ($query_string ~* "_REQUEST(=|\[|\%[0-9A-Z]{0,2})") {
        return 444;
    }
    if ($query_string ~* "proc/self/environ") {
        return 444;
    }
    if ($query_string ~* "mosConfig_[a-zA-Z_]{1,21}(=|\%3D)") {
        return 444;
    }
    if ($query_string ~* "base64_(en|de)code\(.*\)") {
        return 444;
    }

    # Block suspicious request methods
    if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$ ) {
        return 444;
    }

    # Connection limiting
    limit_conn perip 10;

    # Block bots
    if ($block_bot = 1) {
        return 444;
    }

    gzip on;
    gzip_static on;
    gzip_types text/plain text/css application/javascript application/json;

    # Frontend - serve static files
    location / {
        # Rate limiting for general requests - increased burst for page loads
        limit_req zone=general burst=50 nodelay;

        try_files $uri $uri/ /index.html;
    }

    # API backend - proxy to FastAPI
    location /api/ {
        # API rate limiting
        limit_req zone=api burst=10 nodelay;
        limit_conn api_conn 5;

        # Additional bot blocking for API endpoints
        if ($block_bot = 1) {
            return 444;
        }

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Special: /api/v1/highlight/syntax - allow very large request and burst
    location = /api/v1/highlight/syntax {
        limit_req zone=highlight burst=5000 nodelay;
        limit_conn highlight_conn 1000;

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    # Authentication endpoints (if you add them later)
    location ~* /api/(auth|login|register|password) {
        limit_req zone=auth burst=5 nodelay;
        limit_conn api_conn 2;

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets with caching and higher rate limits
    location ~* \.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg)$ {
        limit_req zone=static burst=100 nodelay;

        expires 30d;
        access_log off;
        add_header Cache-Control "public";
    }

    # Block access to sensitive files
    location ~* \.(env|git|svn|htaccess|htpasswd|ini|log|sh|sql|bak|backup|old|tmp|temp)$ {
        return 444;
    }

    # Block access to hidden files
    location ~ /\. {
        return 444;
    }

    # Robots.txt - allow but rate limit
    location = /robots.txt {
        limit_req zone=general burst=5 nodelay;
        access_log off;
    }

    # Sitemap - allow but rate limit
    location = /sitemap.xml {
        limit_req zone=general burst=5 nodelay;
        access_log off;
    }

    # Block common bot targets
    location ~* /(wp-|admin|phpmyadmin|mysql|sql|database) {
        return 444;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/littledan.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/littledan.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.littledan.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = littledan.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name littledan.com www.littledan.com;
    return 404; # managed by Certbot
}
