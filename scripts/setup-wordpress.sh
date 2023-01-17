#!/bin/bash

wget https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
cp -p wordpress/wp-config-sample.php wordpress/wp-config.php

sed -i -e "s/'DB_NAME', 'database_name_here'/'DB_NAME', '${DB_NAME}'/g" wordpress/wp-config.php
sed -i -e "s/'DB_USER', 'username_here'/'DB_USER', '${DB_USER}'/g" wordpress/wp-config.php
sed -i -e "s/'DB_PASSWORD', 'password_here'/'DB_PASSWORD', 'A5FYGnH1ZTlY'/g" wordpress/wp-config.php
sed -i -e "s/'DB_HOST', 'localhost'/'DB_HOST', '107.180.58.52'/g" wordpress/wp-config.php

# regenerate and replace placeholder salts
curl https://api.wordpress.org/secret-key/1.1/salt/ >> salt.txt 2>${LOG}
sed -i -e "/NONCE_SALT/r salt.txt" wordpress/wp-config.php
sed -i -e "/put your unique phrase here/d" wordpress/wp-config.php
