#!/bin/bash

# create base directories
mkdir -p /app/${BIGDATA_HOST}/web
mkdir -p /app/${BIGDATA_HOST}/api

chown -R ec2-user:apache /app/${BIGDATA_HOST}
chmod 2775 /app/${BIGDATA_HOST}

# restart after all the config is complete
systemctl restart httpd
