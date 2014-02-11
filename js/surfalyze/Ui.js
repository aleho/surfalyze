/**
 * Module for UI manipulations as message bus (mediator).
 *
 * Implements various UI manipulations. Also acts as a proxy for messages sent
 * by content scripts or tabs.
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

SA.ui = (function() {

	var _tabs = {};
	var _icons = {};
	var _blocked = {};
	var _blockedUrls = {};

	// List of colors to set for status icon.
	var COLORS = {
		off:      [120, 120, 120, 150],
		on:       [1, 255, 1, 150],
		learning: [1, 1, 255, 150],
		warning:  [255, 255, 1, 150],
		armed:    [1, 255, 1, 150]
	};

	var ICON_DEFAULT = {
		'19': '/res/icons/surfalyze-19.png',
		'38': '/res/icons/surfalyze-38.png'
	};

	var ICON_WARNING = {
		'19': '/res/icons/warning-19.png',
		'38': '/res/icons/warning-38.png'
	};

	// setting "mode" (status)
	var _status = 'off';
	SA.settings.get('mode', _status, function(value) {
		_status = SA.messaging.getStatusText(value);
	});

	// setting "showtoolbar"
	var _showToolbar = true;
	SA.settings.observe('showtoolbar', _showToolbar, function(value) {
		_showToolbar = value;
	});

	/**
	 * Dispatches a message.
	 *
	 * @param type Type (domain) of the message
	 * @param value
	 * @param tabsBroadcast
	 */
	var _sendMessage = function(type, value, tabsBroadcast) {
		var message = {
			context: 'ui',
			type: type,
			value: value
		};

		if (value.tabId > 0) {
			chrome.tabs.sendMessage(value.tabId, message);
		} else {
			chrome.runtime.sendMessage(message);
			if (tabsBroadcast === true) {
				for (var id in _tabs) {
					chrome.tabs.sendMessage(parseInt(id), message);
				}
			}
		}
	};

	/**
	 * Handler for query messages.
	 *
	 * @param type
	 * @param tab
	 * @param sendResponse
	 */
	var _handleQueryMsgs = function(type, tab, sendResponse) {
		switch (type) {
			case 'status':
				sendResponse({status: _status});
				break;

			case 'showtoolbar':
				sendResponse({showtoolbar: _showToolbar});
				break;

			case 'blocked':
				if (tab && tab.id) {
					sendResponse(_blocked[tab.id]);
				}
				break;

			case 'whitelist':
				if (tab && tab.id) {
					sendResponse(SA.engine.getWhitelist());
				}
				break;

			case 'blockedurl':
				if (tab && tab.id) {
					sendResponse(_blockedUrls[tab.id]);
				}
				break;
		}
	};

	/**
	 * Handler for register messages.
	 *
	 * @param type
	 * @param tab
	 * @param sendResponse
	 */
	var _handleRegisterMsgs = function(type, tab, sendResponse) {
		if (tab) {
			_tabs[tab.id] = tab;
		}

		switch (type) {
			case 'status':
			case 'showtoolbar':
			case 'blocked':
				_handleQueryMsgs(type, tab, sendResponse);
				break;
		}
	};

	/**
	 * Handler for tab event messages.
	 * Provides a loopback to tabs and content scripts via messaging.
	 *
	 * @param type
	 * @param tab
	 */
	var _handleTabEventMsgs = function(tab, type, value) {
		if (!tab || !tab.id || !type) {
			return;
		}
		chrome.tabs.sendMessage(tab.id, {context: 'ui', type: type, value: value});
	};

	/**
	 * Sets the icons for the browser action for a specific tab.
	 *
	 * @param icon path-object for chrome.browserAction.setIcon
	 * @param tabId
	 */
	var _setIcon = function(icon, tabId) {
		chrome.browserAction.setIcon({path: icon});

		if (!tabId) {
			return;
		}
		_icons[tabId] = icon;
	};

	/**
	 * Sets the default icon for a request.
	 */
	var setDefault = function(request) {
		var tabId = request && request.tabId ? request.tabId : undefined;
		_setIcon(ICON_DEFAULT, tabId);
	};

	/**
	 * Sets the warning icon for a request.
	 */
	var setWarning = function(request) {
		var tabId = request && request.tabId ? request.tabId : undefined;
		_setIcon(ICON_WARNING, tabId);
	};

	/**
	 * Sets the operation status of SurfAlyze.
	 *
	 * Every status
	 */
	var setStatus = function(status) {
		_status = status;
		var text = SA.messaging.getStatusText(status);
		var color;

		if (COLORS[status]) {
			color = COLORS[status];
		} else {
			color = COLORS.off;
		}

		chrome.browserAction.setBadgeBackgroundColor({color: color});
		chrome.browserAction.setBadgeText({text: text});

		_sendMessage('status', {status: status}, true);

		if (status == 'off') {
			setDefault();
		}
	};

	/**
	 * Registers a new main frame navigation in a tab.
	 *
	 * @param request
	 */
	var registerMainframe = function(request) {
		if (!request.tabId) {
			SA.Log.e('Request did not contain a valid tabId', request);
			return;
		}

		_blocked[request.tabId] = {};
	};

	/**
	 * Adds a request to a list of disallowed or unknown content counts to be able
	 * to show detailed info to the user.
	 *
	 * @param request
	 */
	var registerDisallowedOrUnknown = function(request) {
		if (!request.tabId) {
			SA.Log.e('Request did not contain a valid tabId', request);
			return;
		}

		if (!_blocked[request.tabId]) {
			SA.Log.w('Blocked a request before the corresponding tab was recorded', request);
			_blocked[request.tabId] = {};
		}

		var info = {
			id: request.requestId,
			type: request.type,
			timeStamp: request.timeStamp
		};

		// no need to send the message again (we have a response for that)
		if (!_blocked[request.tabId][request.url]) {
			_sendMessage('blocked', {
				tabId: request.tabId,
				url: request.url,
				content: info
			});
		}

		// update or set or local tracking of blocked content
		_blocked[request.tabId][request.url] = info;
	};

	/**
	 * Adds a request to a list of blocked URLs by tabId to allow blocked.html
	 * to show which URL was blocked.
	 *
	 * @param request
	 */
	var registerBlocked = function(request) {
		_blockedUrls[request.tabId] = request.url;
	};

	/**
	 * Local message listener for "ui" context.
	 * Handles register and query events.
	 * @param request
	 * @param sender
	 * @param sendResponse
	 */
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		if (!request || !request.context || !request.value
				|| request.context != 'ui'
				|| (
					request.type != 'register'
						&& request.type != 'query'
						&& request.type != 'fire-tab-event'
				)) {
			return;
		}

		var tab = null;
		var msgType = request.value;

		// fake tab ID, replace type with value content
		if (typeof request.value == 'object' && request.value.tabId) {
			tab = {id: request.value.tabId};
			msgType = request.value.value;

		} else if (sender) {
			tab = sender.tab;
		}

		switch (request.type) {
			case 'register':
				_handleRegisterMsgs(msgType, tab, sendResponse);
				break;

			case 'query':
				_handleQueryMsgs(msgType, tab, sendResponse);
				break;

			case 'fire-tab-event':
				_handleTabEventMsgs(tab, msgType.type, msgType.value);
				break;
		}
	});

	/**
	 * Listener for tab change events to set their action icon.
	 *
	 * @param activeInfo
	 */
	chrome.tabs.onActivated.addListener(function(activeInfo) {
		var icon = _icons[activeInfo.tabId];
		if (!icon) {
			// fallback to the default icon
			setDefault();
		} else {
			_setIcon(icon);
		}
	});


	// export public functions
	return {
		registerMainframe: registerMainframe,
		registerDisallowedOrUnknown: registerDisallowedOrUnknown,
		registerBlocked: registerBlocked,
		setStatus: setStatus,
		setDefault: setDefault,
		setWarning: setWarning
	};
})();