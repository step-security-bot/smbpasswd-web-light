'use strict';

var API = {
	ERROR_CODE: {
		SUCCESS: 0,
		CLIENT_ERROR: 1,
		SERVER_ERROR: 2,
	},
	CLIENT_ERROR_CODE: {
		UNKNOWN_ERROR: -1,
		PASSWORDS_DIFFERENT: 0,
	},
	SERVER_ERROR_CODE: {
		UNKNOWN_ERROR: -1,
		TIMEOUT: 0,
		SMBPASSWD_ERROR: 1,
		NT_STATUS_ACCESS_DENIED: 2,
		NT_STATUS_ACCOUNT_DISABLED: 3,
		NT_STATUS_ACCOUNT_LOCKED_OUT: 4,
		NT_STATUS_ACCOUNT_RESTRICTION: 5,
		NT_STATUS_INVALID_ACCOUNT_NAME: 6,
		NT_STATUS_NAME_TOO_LONG: 7,
		NT_STATUS_PASSWORD_EXPIRED: 8,
	},
	SUCCESS: {
		'changepasswd': 'You successfully changed your password!',
	},
	UNKNOWN_ERROR: 'Unfortunately, an unknown error has occurred. Verify the form and, if the problem persists, ' +
	               'contact your administrator.',
	CLIENT_ERROR: {
		UNKNOWN_ERROR: 'Unfortunately, an unknown error has occurred. Verify the form and, if the problem persists, ' +
				       'contact your administrator.',
		PASSWORDS_DIFFERENT: 'Your new password and its confirmations are different.'
	},
	SERVER_ERROR: {
		UNKNOWN_ERROR: 'Unfortunately, an unknown error has occurred. Try later and, if the problem persists, ' +
		               'contact your administrator.',
		TIMEOUT: 'A timeout occurred. Verify your username and password. If this problem ' +
		         'persists, contact your administrator. If you tried too much, your account ' +
		         'may be disabled.',
		SMBPASSWD_ERROR: 'An error occurred. Verify your username and password. If this ' +
		                 'problem persists, contact your administrator. If you tried too much, ' +
		                 'your account may be disabled.',
		NT_STATUS_ACCESS_DENIED: 'Recheck your password and username. If this problem ' +
		                         'persists, contact your administrator. If you tried too much, ' +
		                         'your account may be disabled.',
		NT_STATUS_ACCOUNT_DISABLED: 'Your account has been disabled. Contact your administrator.',
		NT_STATUS_ACCOUNT_LOCKED_OUT: 'Your account has been locked-out. Contact your ' +
		                              'administrator.',
		NT_STATUS_ACCOUNT_RESTRICTION: 'Your account is restricted. Contact your administrator.',
		NT_STATUS_INVALID_ACCOUNT_NAME: 'Recheck your username. If this problem persists, ' +
		                                'contact your administrator.',
		NT_STATUS_NAME_TOO_LONG: 'Recheck your username. If this problem persists, contact ' +
		                         'your administrator.',
		NT_STATUS_PASSWORD_EXPIRED: 'You waited too much to change your password. Thus, your ' +
		                            'password has been expired. Contact your administrator.',
	}
};

/**
 * @returns the first key corresponding to the given value, else, undefined
 */
Object.getKeyByValue = function(object, value) {
	return Object.keys(object).find(function(key) { return object[key] === value });
};
HTMLFormElement.prototype.enable = function() {
	this.querySelectorAll('[type=submit]').forEach(function(e) {
		e.removeAttribute('disabled');
	});
};
HTMLFormElement.prototype.disable = function() {
	this.querySelectorAll('[type=submit]').forEach(function(e) {
		e.setAttribute('disabled', true);
	});
};
HTMLFormElement.prototype.loading = function() {
	this.querySelectorAll('[type=submit]').forEach(function(e) {
		e.dataset.text = e.innerHTML;
		e.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="visually-hidden">Loading...</span>';
	});
	this.disable();
};
HTMLFormElement.prototype.end_loading = function() {
	this.querySelectorAll('[type=submit]').forEach(function(e) {
		e.innerHTML = e.dataset.text;
	});
	this.validate();
};


function _display_msg(form, msg_type, text) {
	if (typeof(form.msg) == 'undefined') {
		form.msg = document.createElement('p');
		form.msg.setAttribute('role', 'alert');
		form.insertBefore(form.msg, form.firstChild);
	}
	form.msg.classList.value = 'mt-3 alert alert-' + msg_type;
	form.msg.innerText = text;
	form.msg.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
}

function display_failure(form, text) {
	return _display_msg(form, 'danger', text);
}

function display_success(form) {
	return _display_msg(form, 'success', API.SUCCESS[document.body.dataset.pageid]);
}


function changePasswdValidate(currentElement) {
	const passwd_field = document.getElementById('newpassword')
	const confirm_field = document.getElementById('confirmpassword')
	var is_valid = true;

	if (passwd_field.value != confirm_field.value) {
		is_valid = false;
	}
	if (currentElement == null || currentElement == passwd_field || currentElement == confirm_field) {
		confirm_field.classList.add(is_valid ? 'is-valid' : 'is-invalid');
		confirm_field.classList.remove(is_valid ? 'is-invalid' : 'is-valid');
	}
	if (currentElement == null || currentElement == confirm_field) {
		confirm_field.parentElement.classList.remove('was-validated');
	}

	return is_valid;
}

function send_json(form) {
	return fetch(
		form.action,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(gen_json_from_form(form))
		}
	).then(function(response){
		if (!response.ok) {
			throw new Error("Not a JSON response");
		}
		return response.json();
	});
}

function gen_json_from_form(form) {
	var i, input,
		res = {};

	for (i = 0; i < form.elements.length; ++i) {
		input = form.elements[i];
		res[input.id] = input.value;
	}
	return JSON.stringify(res);
}

function gen_submit_fnc(validator) {
	function submit(event) {
		const form = event.currentTarget;
		event.preventDefault();
		form.classList.add('was-validated');

		if (validator()) {
			form.loading()
			send_json(
				form
			).then(function(json) {
				if (json.type == API.ERROR_CODE.SUCCESS) {
					return display_success(form);
				}

				var error_code_obj, error_code_idx;
				if (json.type == API.ERROR_CODE.CLIENT_ERROR) {
					error_code_obj = API.CLIENT_ERROR;
					error_code_idx = Object.getKeyByValue(API.CLIENT_ERROR_CODE, json.data.error_code);
				}
				else if (json.type == API.ERROR_CODE.SERVER_ERROR) {
					error_code_obj = API.SERVER_ERROR;
					error_code_idx = Object.getKeyByValue(API.SERVER_ERROR_CODE, json.data.error_code);
				}
				else {
					throw new Error('Unknown error code');
				}

				if (typeof(error_code_idx) == 'undefined') {
					// No key is corresponding
					display_failure(form, error_code_obj.UNKNOWN_ERROR);
					return;
				}
				display_failure(form, error_code_obj[error_code_idx]);
			}).catch(function() {
				display_failure(form, API.UNKNOWN_ERROR);
			}).finally(function() {
				form.end_loading();
			});
		}
	}
	return submit;
}

function gen_validate_fnc(form, callback_form_validation) {
	function validate_form(event) {
		const trigger_element = typeof(event) == 'undefined' ? null : event.currentTarget;
		var input, i, c;
		var is_form_valid = true;
		var inputs = form.elements;

		for (i = 0, c = inputs.length; i < c; ++i) {
			var input = inputs[i];
			if (!input.validity.valid) {
				is_form_valid = false;
			}
			if (input == trigger_element) {
				input.parentElement.classList.add('was-validated');
			}
		}

		if (!callback_form_validation(trigger_element)) {
			is_form_valid = false;
		}

		if (is_form_valid) {
			form.enable()
		}
		else {
			form.disable()
		}
		return is_form_valid;
	}

	return validate_form;
}

function bind_form_validation(callback_form_validation) {
	var form = document.getElementById('form'),
		i = 0,
		j = 0,
		c = 0,
		d = 0;

	var events_input_change_content = [
		'change',
		'keypress',
		'keyup',
		'keydown'
	];

	var validator = gen_validate_fnc(form, callback_form_validation);
	var inputs = form.elements;
	for (i = 0, c = inputs.length; i < c; ++i) {
		for (j = 0, d = events_input_change_content.length; j < d; ++j) {
			inputs[i].addEventListener(events_input_change_content[j], validator);
		}
	}
	form.addEventListener('submit', gen_submit_fnc(validator));
	form.validate = validator;
}

(function(window, document) {
	switch (document.body.dataset.pageid) {
		case 'changepasswd':
			bind_form_validation(
				changePasswdValidate
			);
			break;

		default:
	}
})(window, document);
