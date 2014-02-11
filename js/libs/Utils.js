/**
 * Utility functions.
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

/* Utils are always loaded first, so we enforce namespace existence here */
if (!SA) var SA = {};

SA.Utils = {
	/**
	 * Whether this extension is running in development mode.
	 */
	_devMode: null,

	_localUrls: [
		/^chrome-extension:.*$/,
		/^file:.*$/,
	],

	/**
	 * Extracts the domain out of a URL string.
	 *
	 * @param url
	 * @param full Include subdomains (default: true)
	 */
	getDomain: function(url, full) {
		for (var i = 0; i < this._localUrls.length; i++) {
			if (this._localUrls[i].test(url)) {
				return url;
			}
		}

		url = url.split('/');
		var domain = '';

		if (url.length < 3
				|| (url[0] != 'http:' && url[0] != 'https:')) {
			domain = url[0];
		} else {
			domain = url[2];
		}

		if (full !== false) {
			return domain;
		}

		var base = domain.split('.');
		var len = base.length;
		return base[len-2] + '.' + base[len-1];
	},

	/**
	 * Removes parameters from URLs.
	 *
	 * @param url
	 */
	sanitizeUrl: function(url) {
		var end = url.indexOf('?');
		var hashPos = url.indexOf('#');

		if (hashPos > 0 && (end == -1 || hashPos < end)) {
			end = hashPos;
		}
		if (end > -1) {
			url = url.substring(0, end);
		}

		return url;
	},

	/**
	 * Builds a request string from an object of request parts.
	 *
	 * @param items
	 * @return {String}
	 */
	buildRequestString: function(items) {
		var request = '';
		for (var item in items) {
			if (request) {
				request += '&';
			}
			request += encodeURIComponent(item) + '=' + encodeURIComponent(items[item]);
		}
		return request;
	},

	/**
	 * Executes a callback with true/false parameter if this extension is in
	 * development mode (useful for debugging tasks).
	 *
	 * The first call to this method runs asynchronously. All successive calls
	 * execute the callback immediately.
	 */
	checkForDevMode: function(callback) {
		if (this._devMode !== null) {
			callback(this._devMode);
			return;
		}

		chrome.management.get(chrome.runtime.id, function(info) {
			if (info.installType == 'development') {
				this._devMode = true;
			} else {
				this._devMode = false;
			}

			callback(this._devMode);
		}.bind(this));
	},

	/**
	 * Returns a formatted date string.
	 *
	 * @param format string
	 *        Y: year, four digits
	 *        m: month, two digits
	 *        d: day, two digits
	 *        H: hour, two digits
	 *        i: minutes, two digits
	 *        s: seconds, two digits
	 *        u: microseconds, three digits
	 * @param timestamp number to format
	 */
	formatTimestamp: function(format, timestamp) {
		var date = new Date(timestamp);

		var placeholders = {
				Y: date.getFullYear(),
				m: this.pad('00', (date.getMonth() + 1)),
				d: this.pad('00', date.getDate()),
				H: this.pad('00', date.getHours()),
				i: this.pad('00', date.getMinutes()),
				s: this.pad('00', date.getSeconds()),
				u: this.pad('000', date.getMilliseconds())
		};

		for (var char in placeholders) {
			format = format.replace(new RegExp(char, 'g'), placeholders[char]);
		}
		return format;
	},

	/**
	 * Returns a formatted date string.
	 *
	 * @param format string (Y, m, d, H, i, s)
	 * @param string to format
	 */
	formatDateString: function(format, string) {
		if (!string) {
			return '';
		}
		var timestamp = Date.parse(string);
		return this.formatTimestamp(format, timestamp);
	},

	/**
	 * Pads a string to the given prototype.
	 *
	 * @param prototype e.g "000" for a total length of 3, padded with zeros
	 * @param string
	 */
	pad: function(prototype, string) {
		return String(prototype + string).slice(-prototype.length);
	},

	/**
	 * Breaks a string at a certain length.
	 *
	 * @param count Line length
	 * @param string String to break
	 * @param eol String to use at end of lines
	 * @param soft Soft break range (don't break string if length greater than
	 *        count but smaller than count + soft)
	 */
	breakAt: function(count, string, eol, soft) {
		eol = eol || '';
		sof = soft || false;
		var pos = 0;
		var ret = '';

		// soft break means everything within it's value is acceptable
		if (soft && string.length <= (count + soft)) {
			return string;
		}

		do {
			ret += string.substr(pos, count) + eol;
			pos += count;
		} while (pos < string.length);

		return ret;
	}
};