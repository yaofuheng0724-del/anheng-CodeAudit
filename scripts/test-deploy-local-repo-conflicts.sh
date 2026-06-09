#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "${TMP_DIR}/bin"
LOG_FILE="${TMP_DIR}/docker.log"

cat >"${TMP_DIR}/bin/git" <<'FAKE_GIT'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  "branch --show-current") echo "V1" ;;
  "rev-parse --short HEAD") echo "abc1234" ;;
  "status --porcelain") ;;
  *) echo "unexpected git command: $*" >&2; exit 2 ;;
esac
FAKE_GIT

cat >"${TMP_DIR}/bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"${FAKE_DOCKER_LOG}"

if [ "$1" = "compose" ]; then
  shift
  if [ "$#" -ge 1 ] && [ "${!#}" = "--services" ]; then
    printf '%s\n' db db-migrate redis backend frontend adminer
    exit 0
  fi
  if [ "$#" -ge 1 ] && [ "$1" = "--project-name" ]; then
    shift 2
  fi
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -f) shift 2 ;;
      config)
        shift
        if [ "${1:-}" = "--services" ]; then
          printf '%s\n' db db-migrate redis backend frontend adminer
          exit 0
        fi
        ;;
      up)
        exit 0
        ;;
      *) shift ;;
    esac
  done
fi

if [ "$1" = "ps" ]; then
  shift
  if [ "$#" -gt 0 ] && [ "$1" = "-aq" ]; then
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--filter" ] && [ "${2:-}" = "name=^/anheng-codeaudit-frontend-1$" ]; then
        echo "conflict123"
        exit 0
      fi
      shift
    done
    exit 0
  fi
  exit 0
fi

if [ "$1" = "inspect" ]; then
  if [ "$2" = "conflict123" ]; then
    # Simulate a container with the target name but no compose labels.
    echo ""
    exit 0
  fi
fi

if [ "$1" = "rm" ]; then
  exit 0
fi

exit 0
FAKE_DOCKER

chmod +x "${TMP_DIR}/bin/git" "${TMP_DIR}/bin/docker"

FAKE_DOCKER_LOG="${LOG_FILE}" PATH="${TMP_DIR}/bin:${PATH}" \
  "${REPO_ROOT}/scripts/deploy-local-repo.sh" >/dev/null

if ! grep -q '^rm -f conflict123$' "${LOG_FILE}"; then
  echo "Expected deploy script to remove conflicting non-compose frontend container" >&2
  echo "Docker calls:" >&2
  cat "${LOG_FILE}" >&2
  exit 1
fi
