/**
 * Implementation of the Safe Browsing Lookup API.
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
 * @param options
 */
SA.SafeBrowsingApi = function(options) {
	this.setKey(options.key);
	this._cache = {};
};

/**
 * Response status types.
 */
SA.SafeBrowsingApi.RESPONSE = {
	MALWARE: 200,
	OK: 204,
	BAD_REQUEST: 400,
	NOT_AUTHORIZED: 401,
	NOT_AVAILABLE: 503
};
/**
 * Test URL, will always be reported as malware
 */
SA.SafeBrowsingApi.__BADURL = 'http://malware.testing.google.test/testing/malware/';
/**
 * URL for lookup requests
 */
SA.SafeBrowsingApi.URL = 'https://sb-ssl.google.com/safebrowsing/api/lookup';

/**
 * Object to build query string.
 */
SA.SafeBrowsingApi.prototype._request = {
	client: 'surfalyze',
	apikey: '',
	appver: '0.1',
	pver: '3.0'
};
/**
 * Request URL to be used for API queries.
 */
SA.SafeBrowsingApi.prototype._url = null;
/**
 * Local response cache for URLs.
 */
SA.SafeBrowsingApi.prototype._cache = null;


/**
 * Sets the API key for the Safe Browsing API.
 *
 * @param key
 */
SA.SafeBrowsingApi.prototype.setKey = function(key) {
	this._request.apikey = key;
	if (key) {
		this._url = SA.SafeBrowsingApi.URL + '?' + SA.Utils.buildRequestString(this._request);
	} else {
		this._url = '';
	}
};

/**
 * Checks a URL.
 *
 * @param url
 * @param callback
 */
SA.SafeBrowsingApi.prototype.checkUrl = function(url, callback) {
	// we don't have to take request and hash of URLs into account
	url = SA.Utils.sanitizeUrl(url);

	if (!this._request.apikey) {
		// no API key means user doesn't want (and won't be able) to query safe browsing
		callback.apply(callback, [null, null, null, null]);

	} else if (this._cache[url] !== undefined) {
		// respond with decision from cache
		callback.apply(callback, [null, this._cache[url], null, null]);

	} else {
		this._lookup(url, callback);
	}
};

/**
 * Performs an XMLHttpRequest against the Safe Browsing Lookup API.
 *
 * @param url
 * @param callback
 */
SA.SafeBrowsingApi.prototype._lookup = function(url, callback) {
	var xhr = new XMLHttpRequest();

	var cache = this._cache;
	xhr.onreadystatechange = function() {
		if (this.readyState != 4) {
			return;
		}

		var allowed = null;

		if (this.status == SA.SafeBrowsingApi.RESPONSE.OK) {
			allowed = true;
		} else if (this.status == SA.SafeBrowsingApi.RESPONSE.MALWARE) {
			allowed = false;
		}

		cache[url] = allowed;

		if (typeof callback == 'function') {
			callback.apply(callback, [null, allowed, this.response, this.status]);
		}
	};

	// number of URLs, line feed, URLs
	var content = '1\n' + url;
	xhr.open('POST', this._url);

	try {
		xhr.send(content);
	} catch (err) {
		callback.apply(callback, [err]);
	}
};