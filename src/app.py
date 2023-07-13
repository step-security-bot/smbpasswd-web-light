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

remote_addr: typing.Optional[str] = None

app = Flask(__name__)
app.secret_key = secrets.token_hex()


# TODO Document the API


class APIResponse:
	@enum.unique
	class ResponseType(enum.IntEnum):
		SUCCESS = 0
		CLIENT_ERROR = 1
		SERVER_ERROR = 2

	def __new__(cls, data: dict, response_type: ResponseType = ResponseType.SUCCESS) -> Response:
		return jsonify({
			'type': response_type,
			'data': data
		})


class APIClientError(APIResponse):
	@enum.unique
	class ErrorCode(enum.IntEnum):
		UNKNOWN_ERROR = -1
		PASSWORDS_DIFFERENT = 0

	def __new__(cls, error_code: ErrorCode) -> Response:
		return APIResponse(
			response_type=APIResponse.ResponseType.CLIENT_ERROR,
			data={
				'error_code': error_code
			}
		)


class APIServerError(APIResponse):
	@enum.unique
	class ErrorCode(enum.IntEnum):
		UNKNOWN_ERROR = -1
		TIMEOUT = 0
		SMBPASSWD_ERROR = 1
		NT_STATUS_ACCESS_DENIED = 2
		NT_STATUS_ACCOUNT_DISABLED = 3
		NT_STATUS_ACCOUNT_LOCKED_OUT = 4
		NT_STATUS_ACCOUNT_RESTRICTION = 5
		NT_STATUS_INVALID_ACCOUNT_NAME = 6
		NT_STATUS_NAME_TOO_LONG = 7
		NT_STATUS_PASSWORD_EXPIRED = 8  # TODO Fix this possibility

	def __new__(cls, error_code: ErrorCode) -> Response:
		return APIResponse(
			response_type=APIResponse.ResponseType.SERVER_ERROR,
			data={
				'error_code': error_code
			}
		)


def smbpasswd(username: str, old_password: str, new_password: str) -> typing.Optional[APIServerError.ErrorCode]:
	command = [
		"/usr/bin/smbpasswd",
		"-s",
		"-r",
		remote_addr,
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
		proc = subprocess.Popen(
			command,
			executable=command[0],
			shell=False,
			# user='nobody',
			# group='nogroup',
			umask=0o7777,

			stdin=subprocess.PIPE,
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE
		)
		try:
			stdout, stderr = proc.communicate(input=('\n'.join(input_param) + '\n').encode('ascii'), timeout=60)
			logging.debug("Return code for user %s = %s", username, proc.returncode)
			logging.debug("Stdout for user %s = %s", username, stdout)
			logging.debug("Stderr for user %s = %s", username, stderr)
		except TimeoutError:
			proc.kill()
			logging.info("Timeout for user %s", username)
			logging.debug("Return code for user %s = %s", username, proc.returncode)
			return APIServerError.ErrorCode.TIMEOUT

		if proc.returncode == 0:
			logging.info("Return code for user %s = 0 ; SUCCESS!", username)
			return None
		else:
			logging.info("Return code for user %s = %s ; ERROR!", username, proc.returncode)
			logging.debug("Stdout for user %s = %s", username, stdout)
			logging.debug("Stderr for user %s = %s", username, stderr)

			stderr = stderr.strip()

			equivalents = {
				b'NT_STATUS_LOGON_FAILURE': APIServerError.ErrorCode.NT_STATUS_ACCESS_DENIED,
				b'NT_STATUS_NO_SUCH_USER': APIServerError.ErrorCode.NT_STATUS_ACCESS_DENIED,
				b'NT_STATUS_ACCESS_DENIED': APIServerError.ErrorCode.NT_STATUS_ACCESS_DENIED,
			}

			for ex in APIServerError.ErrorCode:
				if stderr.endswith(ex.name.encode('ascii')):
					return ex

			for eq, val in equivalents.items():
				if stderr.endswith(eq):
					return val

			return APIServerError.ErrorCode.SMBPASSWD_ERROR
	except Exception as e:  # noqa=E722
		logging.error(
			"Unknown error during changing password for user %s : %s",
			username,
			'\n'.join(traceback.format_exception(e))
		)
		traceback.print_exc(file=sys.stderr)
		return APIServerError.ErrorCode.UNKNOWN_ERROR


@app.get("/")
def index():
	# TODO cache the result
	return render_template('index.html')


@app.post('/api/changepasswd')
def api():
	username = request.json['username']
	oldpasswd = request.json['oldpassword']
	passwd = request.json['newpassword']
	confirmpasswd = request.json['confirmpassword']

	if passwd != confirmpasswd:
		return APIClientError(APIClientError.ErrorCode.PASSWORDS_DIFFERENT)

	logging.info("Trying to change the password of %s", username)

	ret_code = smbpasswd(username, oldpasswd, passwd)
	if ret_code is None:
		# Success
		return APIResponse({})
	return APIServerError(ret_code)


# TODO Add support of Dashlane auto renew password API

def main():
	global remote_addr
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

	remote_addr = args.remote

	logging.info(f"Listening on: {DEFAULT_PROTO}://{DEFAULT_ADDRESS}:{DEFAULT_PORT}/")
	if args.url is not None:
		logging.info(f"If your redirection works correctly, it should be available using: {args.url}")
	app.run(
		debug=args.verbose >= 1,
		host=DEFAULT_ADDRESS,
		port=DEFAULT_PORT
	)  # TODO migrate to a WSGI server before going live.


if __name__ == "__main__":
	main()
