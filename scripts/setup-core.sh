#/bin/bash

TZ=America/New_York
echo "setting timezone to ${TZ}" >> ${BOOTSTRAP_LOG} 2>&1
timedatectl set-timezone ${TZ}

echo "updating yum packages" >> ${BOOTSTRAP_LOG} 2>&1
yum update -y

# setup latest awscli v2
echo "removing previous awscli" >> ${BOOTSTRAP_LOG} 2>&1
yum remove awscli

echo "downloading and setting up latest awscli" >> ${BOOTSTRAP_LOG} 2>&1
cd /app/bootstrap
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# setup efs utilities
echo "installing aws efs utilities" >> ${BOOTSTRAP_LOG} 2>&1
yum install -y amazon-efs-utils

# install pip & botocore
echo "installing pip" >> ${BOOTSTRAP_LOG} 2>&1
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

echo "setup core complete" >> ${BOOTSTRAP_LOG} 2>&1
