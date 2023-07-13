#!/bin/sh
set -e

# If we want to generate a token
if [ "$#" -gt 0 ]
then
	if [ "$1" = "sh" ]
	then
		exec /bin/ash
	elif [ "$1" = "python" ]
	then
		exec poetry run python
	fi
fi

# Let's start the serve!
set --

if [ "$VERBOSE" != "" ]
then
    set -- "$@" -v

    if [ "$VERBOSE" -gt 1 ]
    then
        set -- "$@" -v
    fi
    if [ "$VERBOSE" -gt 2 ]
    then
        set -- "$@" -v
    fi
fi

# shellcheck disable=SC2039
if [ "$REMOTE" = "" ]
then
    echo "To run this in a docker container, you have to provide a remote server."
    exit 1
fi
ping -c 1 "$REMOTE"
set -- "$@" "$REMOTE"

# shellcheck disable=SC2048,SC2086
exec poetry run python /app/app.py "$@"
