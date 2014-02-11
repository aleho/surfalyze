/**
 * Facade module for messaging via UI mediator.
 *
 * Allows components to subscribe to UI events.
 *
 * Copyright © 2014 Alexander Hofbauer <alex@derhofbauer.at>
 *
 * This file is part of SurfAlyze.
 *
 * SurfAlyze is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License
 * along with this extension in the root folder called "LICENSE".
 * If not, see <http://www.gnu.org/licenses/>.
 */

SA.messaging = (function() {

	var _listeners = {};

	/**
	 * Returns a translated status text.
	 *
	 * @param status
	 */
	var getStatusText = function(status) {
		var text = chrome.i18n.getMessage('status_' + status);
		if (!text) {
			text = status;
		}
		if (!text) {
			text = '';
		}
		return text;
	};

	/**
	 * Local sendMessage implementation using chrome.runtime.
	 *
	 * @param type
	 * @param value
	 * @param response
	 * @param tabId Fake origin tab ID
	 */
	var _sendMessage = function(type, value, response, tabId) {
		var message = {
			context: 'ui',
			type: type,
			value: value
		};

		if (tabId) {
			message.value = {
				value: message.value,
				tabId: tabId
			};
		}

		// Chrome complains about a null response object
		if (typeof response == 'function') {
			chrome.runtime.sendMessage(message, response);
		} else {
			chrome.runtime.sendMessage(message);
		}
	};

	/**
	 * Subscribes to an UI event.
	 *
	 * @param type
	 * @param listener
	 * @param response Callback to be executed after sending the message. Passed
	 *        the current value as call parameter.
	 */
	var subscribe = function(type, listener, response) {
		var tabId = undefined;

		if (typeof type == 'object') {
			tabId = type.tabId;
			type = type.type;
		}

		if (!type) {
			return;
		}

		if (!_listeners[type]) {
			_listeners[type] = [];
		}

		_listeners[type].push(listener);
		_sendMessage('register', type, response, tabId);
	};

	/**
	 * Returns a value by sending a message of query type.
	 *
	 * @param type
	 * @param callback
	 * @param currentValueCallback
	 */
	var get = function(type, callback) {
		_sendMessage('query', type, callback);
	};

	/**
	 * Fires a tab event resulting in a loopback to the current tab.
	 * This helps us to break free of the iframe context.
	 *
	 * @param type
	 * @param value
	 * @param tabId Used to override the tab ID in UI (ignoring sender's tabId)
	 */
	var publish = function(type, value, tabId) {
		var message = {
			type: type,
			value: value
		};

		_sendMessage('fire-tab-event', message, undefined, tabId);
	};

	/**
	 * Local message listener. Used to multicast messages to registered
	 * subscribers.
	 *
	 * @param request
	 * @param sender
	 * @param sendResponse
	 */
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (!request
				|| !request.context || request.context != 'ui'
				|| !request.type || !_listeners[request.type]) {
			return;
		}

		var type = request.type;

		var listeners = _listeners[type].length;
		for (var l = 0; l < listeners; l++) {
			var callback = _listeners[type][l];
			var response = callback.call(callback, request, sender);
			if (response) {
				sendResponse(response);
			}
		}
	});


	// export public functions
	return {
		getStatusText: getStatusText,
		subscribe: subscribe,
		get: get,
		publish: publish
	};
})();