#!/bin/sh
# The former combined Next/LiveKit entrypoint is intentionally retired.
printf '%s\n' 'Use the web or api Dockerfile target and docker-compose.yml; see docs/independent-deployment.md.' >&2
exit 1
