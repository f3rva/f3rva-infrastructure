#/bin/bash

yum update -y

# source environment specific variables.  env passed in from user data
. ./env-${1}.sh

# setup application stack
./setup-httpd.sh
