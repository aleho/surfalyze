/**
 * Decision Engine.
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

SA.DecisionEngine = function(options) {
	this._tabs = [];

	SA.settings.observe('mode', 'off', function(value) {
		this._mode = value;
	}.bind(this));

	this._recorder = options.recorder;
	this._tlds = [];
	this._tldsUrls = {};
	this._contents = [];
	this._contentsUrls = {};
	this._buildWhitelist();

	if (!this._recorder) {
		return;
	}

	this._recorder.observe('new_tld', this._newTldObserver.bind(this));
	this._recorder.observe('new_content', this._newContentObserver.bind(this));
};


/**
 * SA mode.
 */
SA.DecisionEngine.prototype._mode = null;

/**
 * Recorder to use for intercepted requests.
 */
SA.DecisionEngine.prototype._recorder = null;

/**
 * Association of tabs to knows TLDs (provides request context).
 */
SA.DecisionEngine.prototype._tabs = null;
/**
 * Top level domains.
 */
SA.DecisionEngine.prototype._tlds = null;
/**
 * URLs of top level domains.
 */
SA.DecisionEngine.prototype._tldsUrls = null;
/**
 * Contents.
 */
SA.DecisionEngine.prototype._contents = null;
/**
 * URLs of contents.
 */
SA.DecisionEngine.prototype._contentsUrls = null;
/**
 * Associations of contents to top level domains.
 */
SA.DecisionEngine.prototype._contentsTlds = null;

/**
 * Dictionary of white-listed domains and their corresponding regular expression.
 */
SA.DecisionEngine.prototype._whitelistedDomains = {
	'doubleclick': null,
	'google': null,
	'googleadservices': null,
	'googleusercontent': null,
	'gstatic': null,
	'ajax\.googleapis': null,
	'ssl\.google-analytics': null
};

/**
 * This extension's URL to be whitelisted.
 */
SA.DecisionEngine.prototype._extensionExp = new RegExp('^' + chrome.extension.getURL('') + '.*$');
/**
 * Favicon for whitelist.
 */
SA.DecisionEngine.prototype._faviconExp = /.*\/favicon.ico$/;

/**
 * Builds the domain whitelist.
 *
 * TODO Allow users to add entries to the whitelist
 */
SA.DecisionEngine.prototype._buildWhitelist = function() {
	for (var domain in this._whitelistedDomains) {
		this._whitelistedDomains[domain] = new RegExp('(^\\S+\\.|^)' + domain + '\\.\\w+$', 'i');
	}
};

/**
 * Returns the currently whitelisted domains.
 *
 * @return {Array}
 */
SA.DecisionEngine.prototype.getWhitelist = function() {
	return Object.keys(this._whitelistedDomains);
};


/**
 * Returns a boolean decision for a request.
 *
 * @param request Request object
 * @return {Boolean}
 */
SA.DecisionEngine.prototype.decide = function(request) {
	var rating = this._rateRequest(request);

	// no rating means we've probably got nothing to do
	if (rating === null) {
		return true;
	}

	if (rating.whitelisted !== true) {
		SA.Log.d('Rating', rating);
	}

	if (this._mode == 'learning' && rating.whitelisted !== true) {
		this._recordRequestAsync(request);
	}

	this._updateUiAsync(request, rating);

	if (this._mode != 'armed' || rating.whitelisted === true) {
		return true;
	}

	/* Armed. Blocking of requests possible.
	 */

	if (rating.blocked !== true
			// we don't block if TLD/content or content's domain is a known TLD.
			&& (rating.known === true || rating.domainKnown === true)) {
		return true;
	}

	return false;
};

/**
 * Rates a request based on recorded data and relations to known content.
 *
 * @param request Request object to rate.
 */
SA.DecisionEngine.prototype._rateRequest = function(request) {
	// a null return value means we didn't do anything
	if (this._mode == 'off' || this._mode == null) {
		return null;
	}

	var decision = {
		// request was whitelisted
		whitelisted: false,
		// request was previously recorded
		known: true,
		// request is blocked in the DB
		blocked: null,
		// request URL's domain was previously recorded as TLD
		domainKnown: null
	};

	// whitelisted requests are always allowed
	if (this._isWhitelisted(request)) {
		decision.whitelisted = true;
		return decision;
	}

	if (request.type == 'main_frame') {
		this._registerTab(request);
	}

	var tld = this._tabs[request.tabId];

	if (!tld) {
		decision.known = false;
		return decision;
	}

	/* DB schema allows to block entire TLDs by field "blocked". This also
	 * applies to contents if part of that TLD.
	 */
	if (tld.blocked == 1) {
		decision.blocked = true;
		return decision;
	}

	if (request.type == 'main_frame' || request.type == 'sub_frame') {
		return decision;
	}

	var requestUrl = SA.Utils.sanitizeUrl(request.url);
	var requestTld = SA.Utils.getDomain(requestUrl);

	var tldId = this._tldsUrls[requestTld];
	if (tldId) {
		decision.domainKnown = true;
	}

	// get record ID of this content by its URL
	var contentId = this._contentsUrls[requestUrl];

	// content ID is unknown
	if (!contentId) {
		decision.known = false;
		return decision;
	}

	// get full content object
	var content = this._contents[contentId];

	// content is unknown
	if (!content) {
		decision.known = false;
		return decision;
	}

	// content could also be blocked by DB entry
	if (content.blocked == 1) {
		decision.blocked = true;
		return decision;
	}

	// blocked is still set to null
	decision.blocked = false;
	return decision;
};

/**
 * Task to be called to update the UI based on a rating.
 * Runs asynchronously.
 *
 * @param request
 * @param rating
 */
SA.DecisionEngine.prototype._updateUiAsync = function(request, rating) {
	setTimeout(function() {
		// notify of a page change
		if (request.type == 'main_frame') {
			SA.ui.registerMainframe(request);
			// reset icon to default to change it below (if blocked)
			SA.ui.setDefault(request);

		// registerBlocked would trigger the infobar on main_frame navigation
		} else if (this._mode != 'learning') {
			// tell UI that a request was disallowed or unknown
			if (rating.allowed === false
					|| (rating.known === false && rating.domainKnown !== true)) {
				SA.ui.registerDisallowedOrUnknown(request);
			}
		}

		/* Change the UI status in warning and armed modes if not allowed or
		 * unknown.
		 * No warning for "blocked" because that's somehow a user decision.
		 */
		if (this._mode != 'learning'
				&& (rating.allowed !== true
						|| (rating.known === false && rating.domainKnown !== true))) {
			SA.ui.setWarning(request);
		}
	}.bind(this), 0);
};

/**
 * Records a request.
 *
 * @param request
 */
SA.DecisionEngine.prototype._recordRequestAsync = function(request) {
	if (!this._recorder) {
		return;
	}

	if (request.tabId < 0) {
		/* We may never reach this point.
		 * Negative tabIds are generated by Chrome features and should be
		 * whitelisted.
		 */
		SA.Log.w('Could not record, tabId ' + request.tabId, ' invalid', request);
		return;
	}

	var recorder = this._recorder;

	// record the request (to DB)
	chrome.tabs.get(request.tabId, function(tab) {
		if (!tab || tab.incognito) {
			return;
		}
		setTimeout(function() {
			SA.Log.d('Recording request', request);
			recorder.record(request);
		}, 0);
	});
};


/**
 * Checks a request domain against the local whitelist.
 *
 * @param request
 * @return {Boolean}
 */
SA.DecisionEngine.prototype._isWhitelisted = function(request) {
	var domain = SA.Utils.getDomain(request.url);

	// skip checks for this extension
	if (this._extensionExp.test(request.url)) {
		return true;
	}

	// allow favicon.ico (which are of type other)
	if (request.type == 'other' && this._faviconExp.test(request.url)) {
		return true;
	}

	// check in whitelisted domains
	for (var i in this._whitelistedDomains) {
		var isWhitelisted = this._whitelistedDomains[i].test(domain);
		if (isWhitelisted) {
			return true;
		}
	}

	return false;
};


/**
 * Registers a tabs context to make sure we can relate content to TLDs.
 *
 * @param request
 */
SA.DecisionEngine.prototype._registerTab = function(request) {
	var domain = SA.Utils.getDomain(request.url);

	var tldId = this._tldsUrls[domain];
	if (!tldId) {
		return false;
	}

	var tld = this._tlds[tldId];
	if (!tld) {
		return false;
	}

	this._tabs[request.tabId] = tld;
};


/**
 * Initializes all local data needed for decision making from DB.
 *
 * @param db
 */
SA.DecisionEngine.prototype.initFromDb = function(db) {
	// read all TLDs into memory
	db.tlds
		.associate(true)
		.findArray(this._setTlds.bind(this));

	// read a list of all TLDs and store them as map URL -> id
	db.tlds
		.cols(['domain', 'id'])
		.findList(this._setTldUrls.bind(this));

	// read a list of all contents
	db.contents
		.cols(['id', 'url', 'blocked', 'types.chrome', 'types.name'])
		.join('types', {type_id: 'id'})
		.associate(true)
		.findArray(this._setContents.bind(this));

	// read a list of all content URLs
	db.contents
		.cols(['url', 'id'])
		.findList(this._setContentUrls.bind(this));

	// read a list of content to TLD associations
	db.contents_tlds
		.cols(['content_id', 'tld_id'])
		.find(this._associateTldsToContents.bind(this));
};

/**
 * Takes a DB result to initialize TLDs.
 * @param err
 * @param docs
 */
SA.DecisionEngine.prototype._setTlds = function(err, docs) {
	if (err) {
		SA.Log.e('Could not load TLDs', err);
	} else {
		this._tlds = docs;
	}
};

/**
 * Takes a DB result to initialize the URL to TLD array.
 * @param err
 * @param docs
 */
SA.DecisionEngine.prototype._setTldUrls = function(err, docs) {
	if (err) {
		SA.Log.e('Could not load TLDs\' URLs', err);
	} else {
		this._tldsUrls = docs;
	}
};

/**
 * Takes a DB result to initialize Contents.
 * @param err
 * @param docs
 */
SA.DecisionEngine.prototype._setContents = function(err, docs) {
	if (err) {
		SA.Log.e('Could not load contents', err);
	} else {
		this._contents = docs;
	}
};

/**
 * Taks a DB result to initialize the URL to Content array.
 * @param err
 * @param docs
 */
SA.DecisionEngine.prototype._setContentUrls = function(err, docs) {
	if (err) {
		SA.Log.e('Could not load contents\' URLs', err);
	} else {
		this._contentsUrls = docs;
	}
};

/**
 *
 * Takes a DB find result to associate TLDs to Contents.
 * @param err
 * @param result
 */
SA.DecisionEngine.prototype._associateTldsToContents = function(err, result) {
	if (err) {
		SA.Log.e('Could not load content to TLD association', err);
		return;
	}

	for (var i = 0; i < result.rows.length; i++) {
		var item = result.rows.item(i);
		var content = this._contents[item.content_id];
		if (!content) {
			continue;
		}
		if (!content.tlds) {
			content.tlds = {};
		}
		content.tlds[item.tld_id] = this._tlds[item.tld_id];
	}
};


/**
 * Adds new TLD entries to our state arrays.
 * @param tld
 */
SA.DecisionEngine.prototype._newTldObserver = function(event, tld) {
	this._tlds[tld.id] = tld;
	this._tldsUrls[tld.domain] = tld.id;
};

/**
 * Adds new Content entries to our state arrays.
 * @param content
 * @param tld
 */
SA.DecisionEngine.prototype._newContentObserver = function(event, content, tldDomain) {
	var tldId = this._tldsUrls[tldDomain];
	if (!tldId) {
		SA.Log.e('Could not find TLD ID for new content', tldDomain);
		return;
	}

	var tld = this._tlds[tldId];
	if (!tld) {
		SA.Log.e('Could not find TLD for new content', tldId);
		return;
	}

	content.tlds = {
		tldId: tld
	};

	this._contents[content.id] = content;
	this._contentsUrls[content.url] = content.id;
};