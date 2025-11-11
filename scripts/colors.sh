#!/usr/bin/env bash
# Colors - respects NO_COLOR environment variable

if [[ -n "$NO_COLOR" ]]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
else
    RED=$'\e[0;31m'
    GREEN=$'\e[0;32m'
    YELLOW=$'\e[1;33m'
    BLUE=$'\e[0;34m'
    NC=$'\e[0m'
fi