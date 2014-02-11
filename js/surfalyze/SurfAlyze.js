/**
 * SurfAlyze main class.
 *
 * Holds references to runtime objects and database schema.
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

SA.VERSION = chrome.app.getDetails().version;


SA.Utils.checkForDevMode(function(dev) {
	if (dev) {
		SA.Log.enable(true);
	}
});


/**
 * @param {SA.ChromeStorage}
 */
SA.settings = new SA.ChromeStorage('local');

/**
 * @param {SA.Storage}
 */
SA.db = null;

/**
 * @param {SA.messaging}
 */
SA.messaging = null;

/**
 * @param {SA.ui}
 */
SA.ui = null;

/**
 * @param {SA.RequestRecorder}
 */
SA.recorder = null;

/**
 * @param {SA.DecisionEngine}
 */
SA.engine = null;

/**
 * @param {SA.Interceptor}
 */
SA.interceptor = null;


/**
 * The default schema.
 */
SA.schema = {
	tables: {
		// Top Level Domains
		tlds: [
			"`id` INTEGER PRIMARY KEY",
			"`domain` TEXT NOT NULL UNIQUE",
			"`blocked` INTEGER DEFAULT '0'",
			"`discovery` STRING NOT NULL", // datetime
			"`sb_lookup` STRING DEFAULT NULL" // datetime
		],
		// Associations of TLDs to TLDs (parent_id) as tree
		links: [
			"`id` INTEGER PRIMARY KEY",
			"`tld_id` INTEGER NOT NULL",
			"`parent_id` INTEGER NOT NULL",
			"`discovery` STRING NOT NULL"
		],
		// content types (as defined by Chrome)
		types: [
			"`id` INTEGER PRIMARY KEY",
			"`name` TEXT NOT NULL",
			"`chrome` TEXT NOT NULL UNIQUE"
		],
		// Content (as requests)
		contents: [
			"`id` INTEGER PRIMARY KEY",
			"`url` TEXT NOT NULL UNIQUE",
			"`type_id` INTEGER NOT NULL",
			"`blocked` INTEGER DEFAULT '0'",
			"`discovery` STRING NOT NULL",
			"`sb_lookup` STRING DEFAULT NULL",
			"UNIQUE (`url`, `type_id`)"
		],
		// Content to TLDs
		contents_tlds: [
			"`id` INTEGER PRIMARY KEY",
			"`content_id` INTEGER NOT NULL",
			"`tld_id` INTEGER NOT NULL",
			"`discovery` STRING NOT NULL"
		]
	},

	values: {
		types: [
			{id: 1, name: 'Image',    chrome: 'image'},
			{id: 2, name: 'Plugins',  chrome: 'object'},
			{id: 3, name: 'Script',   chrome: 'script'},
			{id: 4, name: 'CSS',      chrome: 'stylesheet'},
			{id: 5, name: 'AJAX',     chrome: 'xmlhttprequest'},
			{id: 6, name: 'Subframe', chrome: 'sub_frame'},
			{id: 7, name: 'Other',    chrome: 'other'}
		]
	},

	indexes: {
		tlds: {
			domain: "`domain`"
		},
		links: {
			tld_tld: "`tld_id`, `parent_id`",
		},
		types: {
			chrome: "`chrome`"
		},
		contents: {
			url: "`url`"
		},
		contents_tlds: {
			content_tld: "`content_id`, `tld_id`"
		}
	},
};


/**
 * @param {object}
 */
SA.dbOptions = {
	id: 'SurfAlyze.db',
	name: 'SurfAlyze Database',
	size: 50 * 1024 * 1024,
	schema: SA.schema
};