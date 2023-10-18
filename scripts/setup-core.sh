#/bin/bash

timedatectl set-timezone America/New_York
yum update -y

# setup latest awscli v2
yum remove awscli

cd /app/bootstrap
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# setup efs utilities
yum install -y amazon-efs-utils

# install pip & botocore
wget https://bootstrap.pypa.io/pip/3.6/get-pip.py -O /tmp/get-pip.py
python3 /tmp/get-pip.py
/usr/local/bin/pip3 install botocore
/usr/bin/python3 -m pip install --upgrade pip

cd scripts

# source environment specific variables.  env passed in from user data
. ./env.sh
. ./env-${ENV_NAME}.sh

# setup application stack
./setup-httpd.sh  >> ${BOOTSTRAP_LOG} 2>&1

# setup wordpress
./setup-wordpress.sh >> ${BOOTSTRAP_LOG} 2>&1

# setup bigdata
./setup-bigdata.sh >> ${BOOTSTRAP_LOG} 2>&1
