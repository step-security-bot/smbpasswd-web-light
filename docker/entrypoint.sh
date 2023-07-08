#!/bin/sh
set -ex

# If we want to generate a token
if [ "$#" -gt 0 ] && [ "$1" = "gen-token" ]
then
    exec python3 /app/app.py "$@"
fi

# Let's start the serve!
set -- --address 0.0.0.0

if [ "$VERBOSE" != "" ]
then
    set -- "$@" --verbose
fi

if [ "$SSL_CERT" != "" ] || [ "$SSL_KEY" != "" ]
then
    # Error checking
    if [ "$SSL_CERT" = "" ] || [ "$SSL_KEY" = "" ]
    then
        echo "You have to use SSL_CERT and SSL_KEY together!"
        exit 1
    fi
    if [ -e "$SSL_CERT" ]
    then
        echo "The '$SSL_CERT' file is not mounted!"
        exit 1
    fi
    if [ -e "$SSL_KEY" ]
    then
        echo "The '$SSL_KEY' file is not mounted!"
        exit 1
    fi

    set -- "$@" --ssl --ssl-cert "$SSL_CERT" --ssl-key "$SSL_KEY"
fi

# shellcheck disable=SC2048,SC2086
exec python3 /app/app.py server "$@"
