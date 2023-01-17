TAGS_BASE=https://github.com/f3rva/f3rva-infrastructure/releases/download
BRANCH_BASE=https://raw.githubusercontent.com/f3rva/f3rva-infrastructure

# create a working directory
mkdir -p /app/bootstrap
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

elif [[ ! -z ${BRANCH_NAME} ]; then
  # pull down from branch
  SCRIPTS_ROOT=${BRANCH_BASE}/${BRANCH_NAME}/scripts

  wget ${SCRIPTS_ROOT}/env.sh
  wget ${SCRIPTS_ROOT}/env-${ENV_NAME}.sh
  wget ${SCRIPTS_ROOT}/setup-core.sh
  wget ${SCRIPTS_ROOT}/setup-httpd.sh
  wget ${SCRIPTS_ROOT}/setup-wordpress.sh
else
  # fatal error
  >&2 echo "TAG_NAME or BRANCH_NAME is required"
  exit 1
fi

chmod 755 *.sh
