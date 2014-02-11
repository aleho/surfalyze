/**
 * Implementation of chrome.storage.
 *
 * Allows for easier listening to storage events.
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

/**
 * @param backend "sync" or "local"
 */
SA.ChromeStorage = function(backend) {
	if (!backend) {
		return;
	}

	this._backend = chrome.storage[backend];
	chrome.storage.onChanged.addListener(this._changeListener.bind(this));
};

SA.ChromeStorage.prototype._backend = null;
SA.ChromeStorage.prototype._observers = {};

/**
 * Sets the value of a setting.
 *
 * @param setting
 * @param value
 * @param callback
 */
SA.ChromeStorage.prototype.set = function(setting, value, callback) {
	if (!setting) {
		return;
	}

	var set = {};
	set[setting] = value;

	if (callback) {
		this._backend.set(set, function() {
			callback.apply(callback, set);
		});
	} else {
		this._backend.set(set);
	}
};

/**
 * Retrieves the value of a setting.
 *
 * @param setting
 * @param def
 * @param callback
 */
SA.ChromeStorage.prototype.get = function(setting, def, callback) {
	if (!setting) {
		return;
	}

	var get = {};
	get[setting] = def;
	this._backend.get(get, function(item) {
		callback.call(callback, item[setting]);
	});
};

/**
 * Registers a change listener for a setting.
 * If def and callback are passed the initial value is retrieved.
 *
 * @param setting
 * @param def Default value (for initial retrieval)
 * @param callback
 */
SA.ChromeStorage.prototype.observe = function(setting, def, callback) {
	if (typeof def == 'function') {
		callback = def;
		def = undefined;
	}

	if (!this._observers[setting]) {
		this._observers[setting] = [];
	}
	this._observers[setting].push(callback);

	if (def !== undefined && typeof callback == 'function') {
		this.get(setting, def, callback);
	}
};

/**
 * Notifies all listeners of changes made to a settings value.
 * Doesn't call if values didn't change.
 */
SA.ChromeStorage.prototype._changeListener = function(changes, namespace) {
	for (setting in changes) {
		if (!this._observers[setting]) {
			continue;
		}

		var change = changes[setting];
		if (change.oldValue === change.newValue) {
			continue;
		}

		var listeners = this._observers[setting].length;

		for (var l = 0; l < listeners; l++) {
			var observer = this._observers[setting][l];
			observer.apply(observer, [change.newValue, change.oldValue]);
		}
	}
};