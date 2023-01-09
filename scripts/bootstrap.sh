if [[ -z ${BRANCH_NAME} ]]; then
  BRANCH_NAME=main;
fi

# for dev, pull down the latest from main
GITHUB_RAW=https://raw.githubusercontent.com/f3rva/f3rva-infrastructure
SCRIPTS_ROOT=${GITHUB_RAW}/${BRANCH_NAME}/scripts

mkdir -p /app/bootstrap
cd /app/bootstrap

wget ${SCRIPTS_ROOT}/env-${ENV}.sh
wget ${SCRIPTS_ROOT}setup-core.sh
wget ${SCRIPTS_ROOT}setup-httpd.sh