#!/bin/sh
set -e

CERT_DIR="${DEEPAUDIT_HTTPS_CERT_DIR:-/etc/nginx/certs}"
CERT_FILE="${CERT_DIR}/deepaudit.crt"
KEY_FILE="${CERT_DIR}/deepaudit.key"
CERT_DAYS="${DEEPAUDIT_HTTPS_CERT_DAYS:-3650}"
CERT_CN="${DEEPAUDIT_HTTPS_CERT_CN:-TopSec Audit Local HTTPS}"

is_ipv4() {
  case "$1" in
    *[!0-9.]* | "" | *.*.*.*.*)
      return 1
      ;;
    *.*.*.*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

generate_self_signed_cert() {
  echo "Generating self-signed HTTPS certificate: ${CERT_FILE}"

  mkdir -p "${CERT_DIR}"

  OPENSSL_CONFIG="$(mktemp)"
  {
    echo "[req]"
    echo "default_bits = 2048"
    echo "prompt = no"
    echo "default_md = sha256"
    echo "distinguished_name = dn"
    echo "x509_extensions = v3_req"
    echo ""
    echo "[dn]"
    echo "CN = ${CERT_CN}"
    echo ""
    echo "[v3_req]"
    echo "subjectAltName = @alt_names"
    echo ""
    echo "[alt_names]"
    echo "DNS.1 = localhost"
    echo "IP.1 = 127.0.0.1"

    dns_index=2
    ip_index=2

    if [ -n "${DEEPAUDIT_HTTPS_HOST:-}" ]; then
      echo "DNS.${dns_index} = ${DEEPAUDIT_HTTPS_HOST}"
      dns_index=$((dns_index + 1))

      if is_ipv4 "${DEEPAUDIT_HTTPS_HOST}"; then
        echo "IP.${ip_index} = ${DEEPAUDIT_HTTPS_HOST}"
        ip_index=$((ip_index + 1))
      fi
    fi

    for container_ip in $(hostname -i 2>/dev/null || true); do
      if is_ipv4 "${container_ip}" && [ "${container_ip}" != "127.0.0.1" ]; then
        echo "IP.${ip_index} = ${container_ip}"
        ip_index=$((ip_index + 1))
      fi
    done
  } > "${OPENSSL_CONFIG}"

  openssl req \
    -x509 \
    -nodes \
    -days "${CERT_DAYS}" \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -config "${OPENSSL_CONFIG}"

  rm -f "${OPENSSL_CONFIG}"
  chmod 600 "${KEY_FILE}"
}

if [ ! -s "${CERT_FILE}" ] || [ ! -s "${KEY_FILE}" ]; then
  generate_self_signed_cert
else
  echo "Using existing HTTPS certificate: ${CERT_FILE}"
fi

# 替换 API 地址占位符
# 默认为 /api/v1，这样即使用户不传参，也能配合默认的 nginx 代理工作
API_URL="${VITE_API_BASE_URL:-/api/v1}"

echo "Injecting API URL: $API_URL"

# 在所有 JS 文件中替换占位符
# 注意：这里路径必须是 nginx 实际存放文件的路径
if [ -d /usr/share/nginx/html ]; then
  ESCAPED_API_URL=$(echo "${API_URL}" | sed 's/[&/|]/\\&/g')
  find /usr/share/nginx/html -name '*.js' -exec sed -i "s|__API_BASE_URL__|${ESCAPED_API_URL}|g" {} \;
fi

# 执行原始命令
exec "$@"
