const SUCCESS = {
	'title': 'Congrats!',
	'message': 'You successfully changed your password!'
};

const UNKNOWN_ERROR = {
	'title': 'Error!',
	'message': 'Unfortunately, an unknown error has occurred. Verify your username, your password and, if the problem ' +
	           'persists, contact your administrator.'
};
const UNKNOWN_CLIENT_ERROR = {
	'title': 'Unknown error on your side!',
	'message': 'Unfortunately, an unknown error has occurred. Verify your username, your password and, if the problem ' +
	           'persists, contact your administrator.'
};
const UNKNOWN_SERVER_ERROR = {
	'title': 'Unknown error on our side!',
	'message': 'Unfortunately, an unknown error has occurred. Try later and, if the problem persists, contact your ' +
			   'administrator.'
};
const CLIENT_ERROR_CODE = {
	0: {  // PASSWORDS_DIFFERENT
		'title': 'Different passwords',
		'message': 'Your new password and its confirmations are different.'
	}
};
const SERVER_ERROR_CODE = {
	0: {  // TIMEOUT
		'title': 'Timeout!',
		'message': 'A timeout occurred. Verify your username and password. If this problem persists, contact your ' +
		           'administrator. If you tried too much, your account may be disabled.'
	},
	1: {  // SMBPASSWD_ERROR
		'title': 'Internal error!',
		'message': 'An error occurred. Verify your username and password. If this problem persists, contact your ' +
		           'administrator. If you tried too much, your account may be disabled.'
	},
	2: {  // NT_STATUS_ACCESS_DENIED
		'title': 'Login Failure',
		'message': 'Recheck your password and username. If this problem persists, contact your administrator. If you ' +
		           'tried too much, your account may be disabled.'
	},
	3: {  // NT_STATUS_ACCOUNT_DISABLED
		'title': 'Disabled Account',
		'message': 'Your account has been disabled. Contact your administrator.'
	},
	4: {  // NT_STATUS_ACCOUNT_LOCKED_OUT
		'title': 'Locked-Out Account',
		'message': 'Your account has been locked-out. Contact your administrator.'
	},
	5: {  // NT_STATUS_ACCOUNT_RESTRICTION
		'title': 'Restricted Account',
		'message': 'Your account is restricted. Contact your administrator.'
	},
	6: {  // NT_STATUS_INVALID_ACCOUNT_NAME
		'title': 'Invalid username',
		'message': 'Recheck your username. If this problem persists, contact your administrator.'
	},
	7: {  // NT_STATUS_NAME_TOO_LONG
		'title': 'Name too long',
		'message': 'Recheck your username. If this problem persists, contact your administrator.'
	},
	8: {  // NT_STATUS_PASSWORD_EXPIRED
		'title': 'Password expired',
		'message': 'You waited too much to change your password. Thus, your password has been expired. Contact your ' +
		           'administrator.'
	},
};

SUCCESS_ERROR_CODE = 0
CLIENT_ERROR = 1
SERVER_ERROR = 2


function check_confirmpassword() {
	var newpassword = document.getElementById('newpassword').value;
	var confirmpassword = document.getElementById('confirmpassword').value;
	return newpassword == confirmpassword;
}

function is_form_valid() {
	var form = document.getElementById('form');
	var inputs = form.getElementsByTagName('input');
	for (var i = 0, c = inputs.length; i < c; ++i) {
		if (!inputs[i].validity.valid) {
			return false;
		}
	}
	return true;
}

function confirmpassword_handler() {
	if (!check_confirmpassword()) {
		disable_submit();
		document.getElementById('confirmpasswd_error').style.display = 'block';
	} else {
		review_submit_status();
		document.getElementById('confirmpasswd_error').style.display = 'none';
	}
}

function disable_submit() {
	document.getElementById('submit').disabled = true;
}
function review_submit_status() {
	if (check_confirmpassword() && is_form_valid()) {
		document.getElementById('submit').disabled = false;
	} else {
		disable_submit();
	}
}

function _display_msg(msg_type, msg_data) {
	var form_result = document.getElementById('form_result');
	var title = form_result.getElementsByTagName('h2')[0];
	var msg = form_result.getElementsByTagName('p')[0];
	title.innerText = msg_data.title;
	msg.innerText = msg_data.message;
	form_result.className = msg_type + '-msg';
}

function display_failure(error_data) {
	return _display_msg('error', error_data);
}

function display_success() {
	return _display_msg('success', SUCCESS);
}

function loading() {
	disable_submit();
	var submit = document.getElementById('submit');
	submit.type = "image";
	submit.disabled = true;
}
function end_loading() {
	review_submit_status();
	var submit = document.getElementById('submit');
	submit.type = "submit";
	submit.disabled = false;
}

function submit(event) {
	event.preventDefault();
	loading();
	var endpoint = './api/changepasswd';
	var data = {
		'username': document.getElementById('username').value,
		'oldpassword': document.getElementById('password').value,
		'newpassword': document.getElementById('newpassword').value,
		'confirmpassword': document.getElementById('confirmpassword').value,
	};

	fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	}).then(function(response) {
		if (!response.ok) {
			display_failure(UNKNOWN_ERROR);
			return false;
		}
		return response.json();
	}).then(function(json) {
		if (json === false) {
			return;
		}

		if (json.type == SUCCESS_ERROR_CODE) {
			display_success();
		}
		else if (json.type == CLIENT_ERROR) {
			if (json.data.error_code in CLIENT_ERROR_CODE) {
				display_failure(CLIENT_ERROR_CODE[json.data.error_code])
			}
			else {
				display_failure(UNKNOWN_CLIENT_ERROR)
			}
		}
		else if (json.type == SERVER_ERROR) {
			if (json.data.error_code in SERVER_ERROR_CODE) {
				display_failure(SERVER_ERROR_CODE[json.data.error_code])
			}
			else {
				display_failure(UNKNOWN_SERVER_ERROR)
			}
		}
		else {
			display_failure(UNKNOWN_ERROR);
		}
	}).catch(function() {
		display_failure(UNKNOWN_ERROR);
	}).finally(function() {
		end_loading();
	});
}

(function(window, document) {
	var newpassword_fields = [
		document.getElementById('newpassword'),
		document.getElementById('confirmpassword')
	];
	var other_fields = [
		document.getElementById('username'),
		document.getElementById('password')
	];
	var events_input_changed = [
		"change",
		"keypress",
		"keyup",
		"keydown"
	];
	for (var i = 0, c = newpassword_fields.length; i < c; ++i) {
		for (var j = 0, d = events_input_changed.length; j < d; ++j) {
			newpassword_fields[i].addEventListener(events_input_changed[j], confirmpassword_handler);
		}
	}
	for (var i = 0, c = other_fields.length; i < c; ++i) {
		for (var j = 0, d = events_input_changed.length; j < d; ++j) {
			other_fields[i].addEventListener(events_input_changed[j], review_submit_status);
		}
	}

	document.getElementById('form').addEventListener("submit", submit);
})(window, document);
