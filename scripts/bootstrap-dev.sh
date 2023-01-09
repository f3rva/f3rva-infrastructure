#!/bin/sh

if [[ ${BRANCH_NAME == ""}]]; then
  ${BRANCH_NAME} = "main";
fi

# for dev, pull down the latest from main
GITHUB_REPO=https://github.com/f3rva/f3rva-infrastructure
SCRIPTS_ROOT=${GITHUB_REPO}/raw/${BRANCH_NAME}/SCRIPTS_ROOT
ENV=${1}

wget env-${ENV}.sh
wget setup-core.sh
wget setup-httpd.sh