#!/usr/bin/env python3
"""smbpasswd-web is a simple web interface to smbpasswd.

The only purpose is to allow a user to change its samba password using a browser,
no user adding, no machine account, nothing, plain simple changing a password.
"""

import argparse
import enum
import logging
import os
import secrets
import subprocess
import sys
import traceback
import typing

from flask import Flask, request, Response, jsonify, render_template

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ADDRESS = '0.0.0.0'
DEFAULT_PORT = 8080
DEFAULT_PROTO = 'http'

app = Flask(__name__)
app.secret_key = secrets.token_hex()


@enum.unique
class APIResponseType(enum.IntEnum):
    """Response type"""
    SUCCESS = 0
    CLIENT_ERROR = 1
    SERVER_ERROR = 2


@enum.unique
class APIClientErrorCode(enum.IntEnum):
    """Client error code"""
    UNKNOWN_ERROR = -1
    PASSWORDS_DIFFERENT = 0


@enum.unique
class APIServerErrorCode(enum.IntEnum):
    """Server error code"""
    UNKNOWN_ERROR = -1
    TIMEOUT = 0
    SMBPASSWD_ERROR = 1
    NT_STATUS_ACCESS_DENIED = 2
    NT_STATUS_ACCOUNT_DISABLED = 3
    NT_STATUS_ACCOUNT_LOCKED_OUT = 4
    NT_STATUS_ACCOUNT_RESTRICTION = 5
    NT_STATUS_INVALID_ACCOUNT_NAME = 6
    NT_STATUS_NAME_TOO_LONG = 7
    NT_STATUS_PASSWORD_EXPIRED = 8


def api_response(data: dict, response_type: APIResponseType = APIResponseType.SUCCESS) -> Response:
    """Return a Response returning a client error"""
    return jsonify({
        'type': response_type,
        'data': data
    })


def api_client_error(error_code: APIClientErrorCode) -> Response:
    """Return a Response returning a client error"""
    return api_response(
        response_type=APIResponseType.CLIENT_ERROR,
        data={
            'error_code': error_code
        }
    )


def api_server_error(error_code: APIServerErrorCode) -> Response:
    """Return a Response returning a server error"""
    return api_response(
        response_type=APIResponseType.SERVER_ERROR,
        data={
            'error_code': error_code
        }
    )


def smbpasswd(username: str, old_password: str, new_password: str) \
        -> typing.Optional[APIServerErrorCode]:
    """Instantiate smbpasswd"""
    command = [
        "/usr/bin/smbpasswd",
        "-s",
        "-r",
        app.config['REMOTE_ADDR'],
        "-U",
        username
    ]
    input_param = [
        old_password,
        new_password,
        new_password
    ]

    try:
        logging.debug("Will execute '%s'", "' '".join(command))
        with subprocess.Popen(
            command,
            executable=command[0],
            shell=False,
            # user='nobody',
            # group='nogroup',
            umask=0o7777,

            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        ) as proc:
            stdout, stderr = proc.communicate(
                input=('\n'.join(input_param) + '\n').encode('ascii'),
                timeout=60
            )
            logging.debug("Return code for user %s = %s", username, proc.returncode)
            logging.debug("Stdout for user %s = %s", username, stdout)
            logging.debug("Stderr for user %s = %s", username, stderr)

            if proc.returncode == 0:
                logging.info("Return code for user %s = 0 ; SUCCESS!", username)
                return None

            stderr = stderr.strip()

            equivalents = {
                b'NT_STATUS_LOGON_FAILURE': APIServerErrorCode.NT_STATUS_ACCESS_DENIED,
                b'NT_STATUS_NO_SUCH_USER': APIServerErrorCode.NT_STATUS_ACCESS_DENIED,
                b'NT_STATUS_ACCESS_DENIED': APIServerErrorCode.NT_STATUS_ACCESS_DENIED,
            }

            for ex in APIServerErrorCode:
                if stderr.endswith(ex.name.encode('ascii')):
                    return ex

            for equivalent, val in equivalents.items():
                if stderr.endswith(equivalent):
                    return val

            return APIServerErrorCode.SMBPASSWD_ERROR

    except TimeoutError:
        proc.kill()
        logging.info("Timeout for user %s", username)
        logging.debug("Return code for user %s = %s", username, proc.returncode)
        return APIServerErrorCode.TIMEOUT

    except subprocess.SubprocessError:
        logging.error(
            "Unknown error during changing password for user %s : %s",
            username,
            '\n'.join(traceback.format_exc())
        )
        traceback.print_exc(file=sys.stderr)
        return APIServerErrorCode.UNKNOWN_ERROR


@app.get("/")
def index():
    """Form to change the passwd"""
    return render_template('index.html')


@app.post('/api/changepasswd')
def api():
    """Endpoint to change the passwd, in order to allow other program to use it."""
    username = request.json['username']
    oldpasswd = request.json['oldpassword']
    passwd = request.json['newpassword']
    confirmpasswd = request.json['confirmpassword']

    if passwd != confirmpasswd:
        return api_client_error(APIClientErrorCode.PASSWORDS_DIFFERENT)

    logging.info("Trying to change the password of %s", username)

    ret_code = smbpasswd(username, oldpasswd, passwd)
    if ret_code is None:
        # Success
        return api_response({})
    return api_server_error(ret_code)


def main():
    """Parse CLI arguments and start the server"""
    parser = argparse.ArgumentParser(
        description="Web interface to change samba user's password",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("remote", help="Address of the remote SMB server")
    parser.add_argument("--url", help="URI behind which the web page is available")
    parser.add_argument("-v", "--verbose", help="Log HTTP requests", action="count", default=0)

    # Parse arguments
    args = parser.parse_args()

    print(f'Verbosity: {args.verbose}')
    if args.verbose >= 2:
        logging.basicConfig(level=logging.NOTSET)
    elif args.verbose == 1:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    app.config['REMOTE_ADDR'] = args.remote

    logging.info("Listening on: %s://%s:%s/", DEFAULT_PROTO, DEFAULT_ADDRESS, DEFAULT_PORT)
    if args.url is not None:
        logging.info("If your redirection works correctly, it should be available using: %s",
                     args.url)
    app.run(
        debug=args.verbose >= 1,
        host=DEFAULT_ADDRESS,
        port=DEFAULT_PORT
    )


if __name__ == "__main__":
    main()
