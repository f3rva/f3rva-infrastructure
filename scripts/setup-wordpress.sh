#!/bin/bash

# setup wordpress CLI and make it executable
mkdir ${APP_DIR}/wp-cli
cd ${APP_DIR}/wp-cli
wget https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
chown ec2-user:apache wp-cli.phar
ln -s ${APP_DIR}/wp-cli/wp-cli.phar /usr/local/bin/wp

# create mount point and mount the EFS filesystem
mkdir -p /app/${WWW_HOST}
chown -R ec2-user:apache /app/${WWW_HOST}
mount -t efs ${WP_EFS_FS_ID} /app/${WWW_HOST}

# rebuild wordpress in EFS filesystem if it's empty
if [ ! -f /app/${WWW_HOST}/wp-config.php ]; then

    # download wordpress
    mkdir ${BOOTSTRAP_DIR}/wordpress
    cd ${BOOTSTRAP_DIR}/wordpress

    wget https://wordpress.org/latest.tar.gz
    tar -xzf latest.tar.gz
    cp -p wordpress/wp-config-sample.php wordpress/wp-config.php

    # replace db connection info
    echo "Getting secrets for region: ${AWS_REGION}"
    DB_NAME=`aws secretsmanager get-secret-value --secret-id ${DB_SECRET_KEY} --region ${AWS_REGION} | jq -r '[.SecretString][0]' | jq -r '.dbname'`
    DB_USER=`aws secretsmanager get-secret-value --secret-id ${DB_SECRET_KEY} --region ${AWS_REGION} | jq -r '[.SecretString][0]' | jq -r '.username'`
    DB_PASSWORD=`aws secretsmanager get-secret-value --secret-id ${DB_SECRET_KEY} --region ${AWS_REGION} | jq -r '[.SecretString][0]' | jq -r '.password'`
    DB_HOST=`aws secretsmanager get-secret-value --secret-id ${DB_SECRET_KEY} --region ${AWS_REGION} | jq -r '[.SecretString][0]' | jq -r '.host'`

    sed -i -e "s/'DB_NAME', 'database_name_here'/'DB_NAME', '${DB_NAME}'/g" wordpress/wp-config.php
    sed -i -e "s/'DB_USER', 'username_here'/'DB_USER', '${DB_USER}'/g" wordpress/wp-config.php
    sed -i -e "s/'DB_PASSWORD', 'password_here'/'DB_PASSWORD', '${DB_PASSWORD}'/g" wordpress/wp-config.php
    sed -i -e "s/'DB_HOST', 'localhost'/'DB_HOST', '${DB_HOST}'/g" wordpress/wp-config.php

    # regenerate and replace placeholder salts
    curl https://api.wordpress.org/secret-key/1.1/salt/ >> salt.txt
    sed -i -e "/NONCE_SALT/r salt.txt" wordpress/wp-config.php
    sed -i -e "/put your unique phrase here/d" wordpress/wp-config.php

    # fix FTP prompts on plugin uploads
    echo "" >> wordpress/wp-config.php
    echo "# fix FTP prompts on plugin uploads" >> wordpress/wp-config.php
    echo "define('FS_METHOD','direct');" >> wordpress/wp-config.php
    echo "" >> wordpress/wp-config.php

    # copy and setup wordpress - UNCOMMENT IF YOU NEED TO REBUILD WHAT IS IN EFS
    cp -r wordpress/* /app/${WWW_HOST}
    chown -R ec2-user:apache /app/${WWW_HOST}
    chmod 2775 /app/${WWW_HOST}
    find /app/${WWW_HOST} -type d -exec sudo chmod 2775 {} \;
    find /app/${WWW_HOST} -type f -exec sudo chmod 0664 {} \;

    # run setup
    cd /app/${WWW_HOST}

    # configure wordpress
    su - ec2-user
    wp plugin delete hello
    exit
fi

# restart after all the config is complete
systemctl restart httpd
