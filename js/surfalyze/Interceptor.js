/**
 * Interceptor.
 *
 * Blocks requests.
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

SA.Interceptor = function() {
	// we have to cache our bound listeners so we can remove them later
	this._listeners = {
		page: this._pageListener.bind(this),
		content: this._contentListener.bind(this)
	};


	// load & observe settings
	this._observePolicy('sub_frame', 'request-iframes');
	this._observePolicy('image', 'request-images');
	this._observePolicy('object', 'request-objects');
	this._observePolicy('other', 'request-other');
	this._observePolicy('script', 'request-scripts');
	this._observePolicy('xmlhttprequest', 'request-ajax');

	SA.Utils.checkForDevMode(function(dev) {
		// add development URLs
		//if (dev) {
		//	SA.Log.d('Dev: Adding file:// and chrome-extension:// protocols to tracked URLs');
		//	this._urls.push('file://*/*', 'chrome-extension://*/*');
		//}

		// now setup
		SA.settings.observe('mode', this._mode, function(value) {
			this._mode = value;
			if (value == 'off') {
				this.enable(false);
			} else {
				this.enable(true);
			}
		}.bind(this));
	}.bind(this));

	SA.settings.observe('blockmainframes', this._blockMainframes, function(value) {
		this._blockMainframes = value;
	}.bind(this));
};


/**
 * Base64-encoded transparent png image used to replace content, shamelessly
 * stolen from Adblock Plus.
 */
SA.Interceptor.TRANSPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';


/**
 * Tracks the status of this engine.
 * A disabled engine means we'll always allow any kind of resource to be loaded.
 */
SA.Interceptor.prototype._isEnabled = false;
SA.Interceptor.prototype._mode = 'off';

/**
 * Object holding all our listeners.
 */
SA.Interceptor.prototype._listeners = null;

/**
 * Setting that allows us to redirect main_frames if they're unknown.
 */
SA.Interceptor.prototype._blockMainframes = false;

/**
 * Array of schemes to be passed to chrome.webRequest.onBeforeRequest.addListener.
 * Will be extended with debugging schemes if in development mode.
 */
SA.Interceptor.prototype._urls = ['http://*/*', 'https://*/*'];

/**
 * Array of types of resources to decide upon.
 *
 * Stylesheets are ignored.
 * Images by default won't be tracked unless enabled in options.
 *
 * @see https://developer.chrome.com/extensions/webRequest.html#type-RequestFilter
 */
SA.Interceptor.prototype._requestTypes = [
	'image',
	'object',
	'other',
	'script',
	'xmlhttprequest'
];

/**
 * Default policies to apply to requests.
 */
SA.Interceptor.prototype._trackingPolicies = {
	'main_frame': true,
	'sub_frame': true,
	'image': false,
	'object': true,
	'other': true,
	'script': true,
	'xmlhttprequest': true
};

/**
 * Array of in-page content types to block when loading main_frame or sub_frame
 * requests.
 *
 * @see https://developer.chrome.com/extensions/contentSettings.html#properties
 */
SA.Interceptor.prototype._contentSettings = {
	'javascript': true,
	'plugins': true
};

/**
 * Loads a tracking policy setting and registers an observe handler.
 *
 * @param policy
 * @param setting
 */
SA.Interceptor.prototype._observePolicy = function(policy, setting) {
	SA.settings.observe(setting, this._trackingPolicies[policy], function(value) {
		this.setTrackingPolicy(policy, value);
	}.bind(this));
};

/**
 * Enables or disables this Engine.
 *
 * @param enable
 */
SA.Interceptor.prototype.enable = function(enable) {
	// prevent multiple interceptor registration
	if (enable && !this._isEnabled) {
		this._intercept(true);
	} else if (!enable && this._isEnabled) {
		this._intercept(false);
	}

	this._isEnabled = enable;
	this._setUiStatus();
};

/**
 * Updates the current page status.
 *
 * @param status
 */
SA.Interceptor.prototype._setUiStatus = function(status) {
	var uiStatus = 'off';
	if (this._isEnabled) {
		uiStatus = this._mode;
	}
	SA.ui.setStatus(uiStatus);
};

/**
 * Registers and removes onBeforeRequest handlers.
 *
 * @param enable
 */
SA.Interceptor.prototype._intercept = function(enable) {
	/* Notice: Make sure to not remove or re-attach the page listener here if
	 * you're enabling content settings. They have to be cleared at least once
	 * for every blocked URL but we don't track content settings here.
	 */
	if (enable) {
		SA.Log.d('Enabling Interceptor');
		chrome.webRequest.onBeforeRequest.addListener(this._listeners.page, {
				urls: this._urls,
				types: ['main_frame', 'sub_frame']
			}, ['blocking']);

		chrome.webRequest.onBeforeRequest.addListener(this._listeners.content, {
				urls: this._urls,
				types: this._requestTypes
			}, ['blocking']);

	} else {
		SA.Log.d('Disabling Interceptor');
		chrome.webRequest.onBeforeRequest.removeListener(this._listeners.page);
		chrome.webRequest.onBeforeRequest.removeListener(this._listeners.content);
	}
};

/**
 * Set a request type's policy to allow or block.
 * @see https://developer.chrome.com/extensions/webRequest.html#type-RequestFilter
 *
 * @param name
 * @param enabled
 */
SA.Interceptor.prototype.setTrackingPolicy = function(name, enabled) {
	this._trackingPolicies[name] = enabled ? true : false;
};


/**
 * Listener to be run before pages (and frames) are loaded.
 *
 * @param request
 */
SA.Interceptor.prototype._pageListener = function(request) {
	var decision = this._getDecision(request);
	var response = this._getResponse(decision, request);

	/* Manipulating content settings is implemented but disabled.
	 * Changes to a request URL's content settings are picked up on consecutive
	 * requests, but not the initial one (probably because it's an asynchronous
	 * API and pageListener is blocking and synchronous.
	 *
	 * This can't be fixed unless Chrome updates either blocking request to
	 * allow async responses or makes chrome.contentSettings synchronous.
	 */
	//this._updateContentSettings(request, decision);

	return response;
};


/**
 * Listener to be run before page content is loaded / requested.
 *
 * @param request
 */
SA.Interceptor.prototype._contentListener = function(request) {
	var decision = this._getDecision(request);
	return this._getResponse(decision, request);
};

/**
 * Returns whether a request is allowed or blocked.
 *
 * @param request
 * @return {Boolean}
 */
SA.Interceptor.prototype._getDecision = function(request) {
	// no need to process this request if we don't track it's content type
	if (this._trackingPolicies[request.type] === false) {
		return true;
	}

	var allowed = SA.engine.decide(request);

	if (allowed !== null) {
		SA.Log.d('Decision', {allowed: allowed, request: request});
	}

	return allowed;
};

/**
 * Compiles a response from a request to be returned in listeners.
 *
 * @param allowed Whether the request is allowed
 * @param request
 * @return null or response object for onBeforeRequest listeners
 */
SA.Interceptor.prototype._getResponse = function(allowed, request) {
	if (allowed) {
		return null;
	}

	var response = {};

	/* determine content of response object by content type */

	// redirect main_frame to block page if user enabled blocking
	if (this._blockMainframes == true && request.type == 'main_frame') {
		SA.ui.registerBlocked(request);
		response.redirectUrl = chrome.extension.getURL('pages/blocked.html');

	// redirect sub_frame to block page
	} else 	if (request.type == 'sub_frame') {
		response.redirectUrl = chrome.extension.getURL('pages/blocked-frame.html');

	// redirect images to a transparent replacement
	} else if (request.type == 'image') {
		response.redirectUrl = SA.Interceptor.TRANSPNG;

	// cancel if not mainframe or blocking enabled by user
	} else if (request.type != 'main_frame' || this._blockMainframes == true) {
		response.cancel = true;
	}

	return response;
};

/**
 * Updates the content settings for a certain request.
 *
 * @param request
 * @param allow
 */
SA.Interceptor.prototype._updateContentSettings = function(request, allow) {
	var url = SA.Utils.getDomain(request.url) + '/*';

	for (var cs in this._contentSettings) {
		if (this._contentSettings[cs] === false || allow) {
			// always clear all settings, they are reset after reloading anyway
			chrome.contentSettings[cs].clear({});

		} else {
			chrome.contentSettings[cs].set({
				primaryPattern: 'http://' + url,
				setting: 'block'
			});
			chrome.contentSettings[cs].set({
				primaryPattern: 'https://' + url,
				setting: 'block'
			});
		}
	}
};