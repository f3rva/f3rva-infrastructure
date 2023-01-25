#!/bin/bash

# setup wordpress CLI and make it executable
mkdir ${APP_DIR}/wp-cli
cd ${APP_DIR}/wp-cli
wget https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
chown ec2-user:apache wp-cli.phar
ln -s ${APP_DIR}/wp-cli/wp-cli.phar /usr/local/bin/wp

# download wordpress
mkdir ${BOOTSTRAP_DIR}/wordpress
cd ${BOOTSTRAP_DIR}/wordpress

wget https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
cp -p wordpress/wp-config-sample.php wordpress/wp-config.php

# replace db connection info
sed -i -e "s/'DB_NAME', 'database_name_here'/'DB_NAME', '${DB_NAME}'/g" wordpress/wp-config.php
sed -i -e "s/'DB_USER', 'username_here'/'DB_USER', '${DB_USER}'/g" wordpress/wp-config.php
sed -i -e "s/'DB_PASSWORD', 'password_here'/'DB_PASSWORD', '${DB_USER}'/g" wordpress/wp-config.php
sed -i -e "s/'DB_HOST', 'localhost'/'DB_HOST', '${DB_USER}'/g" wordpress/wp-config.php

# regenerate and replace placeholder salts
curl https://api.wordpress.org/secret-key/1.1/salt/ >> salt.txt
sed -i -e "/NONCE_SALT/r salt.txt" wordpress/wp-config.php
sed -i -e "/put your unique phrase here/d" wordpress/wp-config.php

# create base directories
mkdir /app/${WWW_HOST}
mkdir /app/${BIGDATA_HOST}

# copy and setup wordpress
cp -r wordpress/* /app/${WWW_HOST}
chown -R ec2-user:apache /app/${WWW_HOST}
chmod 2775 /app/${WWW_HOST}
find /app/${WWW_HOST} -type d -exec sudo chmod 2775 {} \;
find /app/${WWW_HOST} -type f -exec sudo chmod 0664 {} \;

# run setup
cd /app/${WWW_HOST}
#wp core install --url=${WWW_HOST} --title=${SITE_TITLE} --admin_user=${WP_ADMIN_USER} --admin_email=${WP_ADMIN_EMAIL}
