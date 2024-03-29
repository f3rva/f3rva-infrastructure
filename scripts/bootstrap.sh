TAGS_BASE=https://github.com/f3rva/f3rva-infrastructure/releases/download
BRANCH_BASE=https://raw.githubusercontent.com/f3rva/f3rva-infrastructure

# create app directory
mkdir /app
chown ec2-user:apache /app

# create a working directory
mkdir /app/bootstrap
cd /app/bootstrap

# if tag is not empty, use it, otherwise check for branch name
if [[ ! -z ${TAG_NAME} ]]; then
  TAG_ARCHIVE=${TAGS_BASE}/${TAG_NAME}/dist.tar.gz
  wget ${TAG_ARCHIVE}

  # if download was unsuccessful, fail
  if [[ ${?} -gt 0 ]]; then
    >&2 echo "Unable to download tag archive"
    exit 1
  fi

  # extract the archive
  tar -xzf dist.tar.gz

elif [[ ! -z ${BRANCH_NAME} ]]; then
  mkdir conf scripts
  cd scripts

  # pull down from branch
  SCRIPTS_ROOT=${BRANCH_BASE}/${BRANCH_NAME}/scripts

  wget ${SCRIPTS_ROOT}/env.sh
  wget ${SCRIPTS_ROOT}/env-${ENV_NAME}.sh
  wget ${SCRIPTS_ROOT}/setup-bigdata.sh
  wget ${SCRIPTS_ROOT}/setup-core.sh
  wget ${SCRIPTS_ROOT}/setup-httpd.sh
  wget ${SCRIPTS_ROOT}/setup-wordpress.sh

  CONF_ROOT=${BRANCH_BASE}/${BRANCH_NAME}/conf
  cd ../conf
  wget ${CONF_ROOT}/website-${ENV_NAME}-site.f3rva.org.conf
  wget ${CONF_ROOT}/website-${ENV_NAME}-bd.f3rva.org.conf
  
  cd ..
else
  # fatal error
  >&2 echo "TAG_NAME or BRANCH_NAME is required"
  exit 1
fi

cd scripts
chmod 755 *.sh
