/**
 * Request Recorder.
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

SA.RequestRecorder = function(options) {
	this._tabs = {};

	SA.settings.observe('sbakey', '', function(value) {
		this._setSbaKey(value);
	}.bind(this));
};

SA.RequestRecorder.prototype._tabs = null;
SA.RequestRecorder.prototype._safebrowsing = null;
SA.RequestRecorder.prototype._observers = {};

/**
 * Records a loaded request.
 *
 * @param request A request to be recorded.
 */
SA.RequestRecorder.prototype.record = function(request) {
	if (!request) {
		return;
	}

	switch (request.type) {
		case 'main_frame':
			this._recordTld(request);
			break;

		case 'image':
			// we don't track images for now
			break;

		default:
			this._recordContent(request);
	}
};


/**
 * Records an initial page request.
 *
 * @param request The request to be recorded.
 */
SA.RequestRecorder.prototype._recordTld = function(request) {
	var domain = SA.Utils.getDomain(request.url);
	if (!domain) {
		SA.Log.e('Could not parse request tld', request);
		return;
	}

	this._tabs[request.tabId] = domain;

	var tld = {
		domain: domain,
		blocked: null,
		discovery: SA.SQLiteDb.formatDate(),
		sb_lookup: null
	};

	SA.db.tlds.findFirst({domain: tld.domain},
		function(err, doc) {
			if (err) {
				SA.Log.e('Error querying tld', err);
			}

			//TODO implement re-lookup of URL after a certain period
			if (doc && doc.sb_lookup != null) {
				return;
			}

			this._checkUrl(request.url, function(allowed, response, status) {
				if (allowed === false) {
					SA.Log.w('Bad TLD detected (' + response + ')', request);
				}

				if (allowed !== null) {
					tld.blocked = (allowed === true) ? 0 : 1;
					tld.sb_lookup = SA.SQLiteDb.formatDate();
				}

				this._persistTld(tld);

			}.bind(this));
		}.bind(this)
	);
};

/**
 * Saves a TLD object.
 *
 * @param tld
 */
SA.RequestRecorder.prototype._persistTld = function(tld) {
	SA.db.tlds.insert(tld, {conflict: 'REPLACE'}, function(err, result) {
		if (err) {
			SA.Log.e('Could not insert a TLD record', err);
		}
		if (!result || result.rowsAffected == 0 || result.insertId == 0) {
			return;
		}

		tld.id = result.insertId;
		this._notifyObservers('new_tld', tld);
	}.bind(this));
};


/**
 * Records page content associated to a main request.
 *
 * TODO Record associations of TLDs to TLDs by getting the domain of a content
 * and putting that id together with the domain of the site containing it into
 * `links`.
 *
 * @param request The request to be recorded.
 */
SA.RequestRecorder.prototype._recordContent = function(request) {
	if (!request.tabId || request.tabId <= 0) {
		SA.Log.w('Received request without valid tabId', request);
		return;
	}

	var tld = this._tabs[request.tabId];

	if (!tld) {
		chrome.tabs.get(request.tabId, function(tab) {
			// spoof a TLD content to record here.
			this._recordTld({
				tabId: request.tabId,
				url: tab.url
			});

			this._recordContent(request);

		}.bind(this));

		SA.Log.d('Searching for the request\'s tab to retry recording', request);
		return;
	}

	var content = {
		url: SA.Utils.sanitizeUrl(request.url),
		type: request.type,
		blocked: null,
		discovery: SA.SQLiteDb.formatDate(),
		sb_lookup: null
	};

	SA.db.contents
		.join('types', {'types.id': 'contents.type_id'})
		.findFirst(
			{url: content.url, 'types.chrome': content.type},
			function(err, doc) {
				if (err) {
					SA.Log.e('Error querying content', err);
				}

				//TODO implement re-lookup URL after a certain period
				if (doc && doc.sb_lookup != null) {
					return;
				}

				this._checkUrl(request.url, function(allowed, response, status) {
					if (allowed === false) {
						SA.Log.w('Bad content detected (' + response + ')', request);
					}

					if (allowed !== null) {
						content.blocked = (allowed === true) ? 0 : 1;
						content.sb_lookup = SA.SQLiteDb.formatDate();
					}

					this._persistContent(tld, content);

				}.bind(this));
			}.bind(this)
		);
};

/**
 * Saves a content object. Associates it to its tld, determined by the request.
 *
 * @param tld
 * @param content
 */
SA.RequestRecorder.prototype._persistContent = function(tld, content) {
	var contentsTldsInsert = 'INSERT INTO `contents_tlds` (`content_id`, `tld_id`, `discovery`) '
			+ 'VALUES (?, (SELECT `id` FROM `tlds` WHERE `domain` = ?), ?)';

	var contentsQuery = {
		q: 'INSERT OR REPLACE INTO `contents` (`url`, `type_id`, `blocked`, `discovery`, `sb_lookup`) '
				+ 'VALUES (?, (SELECT `id` FROM `types` WHERE `chrome` = ?), ?, ?, ?)',
		v: [content.url, content.type, content.blocked, content.discovery, content.sb_lookup]
	};

	SA.db.query(contentsQuery, function(err, result) {
		if (err) {
			SA.Log.e('Could not insert a content record', err);
			return;
		}

		// no affected rows means we ran into ignore
		if (!result || !result.rowsAffected) {
			return;
		}

		// no id is very bad, mkay?
		if (!result.insertId) {
			SA.Log.e('Could not insert content, url=' + content.url
					+ ', type=' + content.type);
			SA.Log.d(result);
			return;
		}

		content.id = result.insertId;
		this._notifyObservers('new_content', content, tld);

		var contentsTldsQuery = {
			q: contentsTldsInsert,
			v: [result.insertId, tld, content.discovery]
		};
		SA.db.query(contentsTldsQuery, function(err, result) {
			if (err) {
				SA.Log.e('Could not associate content to TLD', err);
				return;
			}
		});
	}.bind(this));
};


/**
 *
 *
 * @param key
 */
SA.RequestRecorder.prototype._setSbaKey = function(key) {
	if (!key) {
		this._safebrowsing = null;
	} else {
		this._safebrowsing = new SA.SafeBrowsingApi({key: key});
	}
};

/**
 * Checks a given URL against the Safe Browsing API
 *
 * @param url URL to check
 * @param callback
 */
SA.RequestRecorder.prototype._checkUrl = function(url, callback) {
	if (!this._safebrowsing) {
		if (typeof callback == 'function') {
			callback.apply(callback, [null, null, null]);
		}
		return;
	}

	this._safebrowsing.checkUrl(url, function(err, allowed, response, status) {
		if (err) {
			SA.Log.e('Error trying to contact Safe Browsing API', err);
		} else if (allowed === null) {
			SA.Log.w('No decision from Safe Browsing API, status=' + status);
		}

		if (typeof callback == 'function') {
			callback.apply(callback, [allowed, response, status]);
		}
	});
};

/**
 * @param event
 * @param callback
 */
SA.RequestRecorder.prototype.observe = function(event, callback) {
	if (!this._observers[event]) {
		this._observers[event] = [];
	}
	this._observers[event].push(callback);
};


/**
 * Notifies all observers of a specific event.
 */
SA.RequestRecorder.prototype._notifyObservers = function(event) {
	if (!this._observers[event] || !this._observers[event].length) {
		return;
	}

	var observers = this._observers[event];
	for (var io = 0; io < observers.length; io++) {
		(function(args) {
			var observer = observers[io];
			setTimeout(function() {
				observer.apply(observer, args);
			}, 0);
		})(arguments);
	}
};

/**
 * Records a number of fake content entries for a fake TLD.
 *
 * @param domain Domain name
 * @param contentCount Number of contents to generate
 */
SA.RequestRecorder.prototype._recordFakeData = function(domain, contentCount) {
	var tld = {
		domain: domain,
		blocked: 0,
		discovery: SA.SQLiteDb.formatDate(),
		sb_lookup: SA.SQLiteDb.formatDate()
	};

	var content = {
		type: 'script',
		blocked: 0,
		discovery: null,
		sb_lookup: null
	};

	var contentUrl = 'http://' + domain + '/js/script_';

	this._persistTld(tld);

	for (var i = 1; i <= contentCount; i++) {
		content.url = contentUrl + i + '.js';
		content.sb_lookup = SA.SQLiteDb.formatDate();
		content.discovery = SA.SQLiteDb.formatDate();
		this._persistContent(tld.domain, content);
	}
};