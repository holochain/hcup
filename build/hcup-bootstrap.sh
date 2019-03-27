#!/bin/sh

die() {
  echo "$1"
  exit 1
}

__data_dir="${XDG_DATA_DIR-x}"

if [ "${__data_dir}" = "x" ]; then
  __data_dir="${HOME-x}"
fi

if [ "${__data_dir}" = "x" ]; then
  die "Failed to locate home directory"
fi

__data_dir="${__data_dir}/.local/share/hcup"

__arch=`uname -m`
case "${__arch}" in
  "x86_64")
    __arch="x64"
    ;;
  *)
    die "unsupported arch ${__arch}"
    ;;
esac

__node_url=""
__node_file=""
__node_hash=""
__node_dir=""

case "${__arch}" in
  "x64")
    __node_url="https://nodejs.org/dist/v8.15.1/node-v8.15.1-linux-x64.tar.gz"
    __node_file="node-v8.15.1-linux-x64.tar.gz"
    __node_hash="16e203f2440cffe90522f1e1855d5d7e2e658e759057db070a3dafda445d6d1f"
    __node_dir="node-v8.15.1-linux-x64"
    ;;
esac


__node_dir="${__data_dir}/${__node_dir}"
__node_bin="${__node_dir}/bin/node"

echo "data dir: ${__data_dir}"
echo "    arch: ${__arch}"
echo "node_bin: ${__node_bin}"

mkdir -p "${__data_dir}"

if [ ! -f "${__node_bin}" ]; then
  if [ ! -f "${__data_dir}/${__node_file}" ]; then
    (cd "${__data_dir}" && curl -L -O "${__node_url}")
    if [ $? -ne 0 ]; then
      die "failed to download ${__node_url}"
    fi
  fi

  (cd "${__data_dir}" && echo "${__node_hash}  ${__node_file}" | shasum -a 256 --check)
  if [ $? -ne 0 ]; then
    echo "sha256 mismatch, expected ${__node_hash} got:"
    (cd "${__data_dir}" && shasum -a 256 "${__node_file}")
    die "sha256 mismatch"
  fi

  if [ ! -d "${__node_dir}" ]; then
    (cd "${__data_dir}" && tar xf "${__node_file}")
    if [ $? -ne 0 ]; then
      die "failed to untar ${__data_dir}/${__node_file}"
    fi
  fi
fi

__node_test_ver=`${__node_bin} --version`
if [ $? -ne 0 ]; then
  die "could not execute ${__node_bin}"
fi

cat > "${__data_dir}/bootstrap.js" <<'EOF'
{{{src}}}
EOF

exec "${__node_bin}" "${__data_dir}/bootstrap.js"
