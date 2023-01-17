#/bin/bash
yum update -y

# source environment specific variables.  env passed in from user data
. ./env.sh >> ${LOG} 2>&1
. ./env-${1}.sh >> ${LOG} 2>&1

# setup application stack
./setup-httpd.sh  >> ${LOG} 2>&1
