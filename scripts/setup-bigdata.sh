#!/bin/bash

# create base directories
echo "creating required bigdata directories"
mkdir -p /app/${BIGDATA_HOST}/web
mkdir -p /app/${BIGDATA_HOST}/api

echo "changing ownership of bigdata directories"
chown -R ec2-user:apache /app/${BIGDATA_HOST}
chmod 2775 /app/${BIGDATA_HOST}

# restart after all the config is complete
systemctl restart httpd

echo "setup bigdata complete"