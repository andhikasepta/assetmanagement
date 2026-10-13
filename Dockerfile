FROM php:8.3-apache

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    curl \
    unzip \
    git \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo \
        pdo_pgsql \
        pgsql \
        zip \
        gd \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && a2enmod rewrite headers remoteip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure Apache & PHP for production
RUN { \
    echo 'upload_max_filesize = 64M'; \
    echo 'post_max_size = 64M'; \
    echo 'memory_limit = 512M'; \
    echo 'max_execution_time = 300'; \
    echo 'date.timezone = Asia/Jakarta'; \
    echo 'session.gc_maxlifetime = 900'; \
    echo 'display_errors = Off'; \
    echo 'log_errors = On'; \
} > /usr/local/etc/php/conf.d/custom.ini

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy composer definitions first for layer caching
COPY composer.json composer.lock* ./

# Install dependencies (cached unless composer.json or composer.lock changes)
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# Copy application files (vendor is excluded by .dockerignore)
COPY . /var/www/html/

# Optimize Composer autoloader
RUN composer dump-autoload --optimize --no-dev

# Create and set permissions for uploads directory
RUN mkdir -p /var/www/html/uploads \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/uploads

# Expose HTTP port
EXPOSE 80

CMD ["apache2-foreground"]
