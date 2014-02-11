/**
 * JS for the options page.
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
(function($) { return {

	_settings: null,
	_recordsList: null,
	_contentsTable: null,
	_contentsList: null,
	_whitelist: null,

	init: function() {
		SA.db = new SA.Storage({
			error: function(db, error) {
				SA.Log.e('Error initializing DB', error);
			}
		});

		$(document).ready(this._init.bind(this));
	},

	_init: function() {
		this._settings = {
			'mode': $('#mode'),
			'advanced': $('#advanced'),
			'sbakey': $('#option-sbakey'),
			'showtoolbar': $('#option-toolbar'),
			'blockmainframes': $('#option-blockmainframes'),
			'request-iframes': $('#option-request-iframes'),
			'request-images': $('#option-request-images'),
			'request-scripts': $('#option-request-scripts'),
			'request-objects': $('#option-request-objects'),
			'request-ajax': $('#option-request-ajax'),
			'request-other': $('#option-request-other')
		};

		this._recordsList = $('#recordslist');
		this._contentsTable = $('#contentstable');
		this._contentsList = $('#contentslist');
		this._whitelist = $('#whitelist');

		// Tabs
		new SA.ContentTabs($('#tabs').children());

		$('#tab-records').on('showtab', function() {
			this._contentsTable.hide();
			this._contentsList.empty();
			this._loadRecords();
		}.bind(this));

		$('#tab-whitelist').on('showtab', function() {
			this._loadWhitelist();
		}.bind(this));


		$('#versioninfo-version').html(SA.VERSION);

		new SA.Help({selector: 'div.help'});


		// UI events
		this._settings.mode.on('change', this.changeModeEvent.bind(this));

		var advanced = this._settings.advanced;
		advanced.on({
			'change': this.changeAdvancedEvent,
			'enable': function() {
				advanced.attr('disabled', null);
				advanced.trigger('change');
			},
			'disable': function() {
				advanced.attr('disabled', 'disabled');
				advanced.val('off');
				advanced.trigger('change');
			}
		});

		// change events for inputs
		$('input[type="text"]').on('change', function() {
			var el = $(this);
			var setting = el.data('setting');
			var value = el.val();
			SA.settings.set(setting, value);
		});

		// change events for checkboxes
		$('input[type="checkbox"]').on('change', function() {
			var el = $(this);
			var setting = el.data('setting');
			var value = el.prop('checked');
			SA.settings.set(setting, value);
		});


		this._restoreSettings();
	},

	changeModeEvent: function() {
		var mode = this._settings.mode.val();

		var main = $('#main-options');
		var advanced = this._settings.advanced;

		if (mode == 'off') {
			advanced.trigger('disable');
			SA.ContentBox.disable(main);
		} else {
			advanced.trigger('enable');
			SA.ContentBox.enable(main);
		}

		SA.settings.set('mode', mode);
	},

	changeAdvancedEvent: function() {
		var requests = $('#requests-options');

		var el = $(this);
		var advanced = el.val();

		if (advanced == 'off') {
			SA.ContentBox.disable(requests);
		} else {
			SA.ContentBox.enable(requests);
		}

		SA.settings.set('advanced', advanced);
	},

	_restoreSettings: function() {
		for (var setting in this._settings) {
			var input = this._settings[setting];
			input.data('setting', setting);

			var def;
			if (input.attr('type') == 'checkbox') {
				def = input.prop('checked');
			} else {
				def = input.val();
			}

			SA.settings.get(setting, def, function(value) {
				var type = this.attr('type');

				if (type == 'checkbox') {
					if (value) {
						this.prop('checked', true);
					} else {
						this.prop('checked', false);
					}

				} else if (type == 'select-one') {
					// we only trigger change of the dropdowns
					this.val(value);
					this.trigger('change');

				} else {
					this.val(value);
				}

			}.bind(input));
		}
	},


	/**
	 * Loads all stored TLDs (from DB) into the table
	 */
	_loadRecords: function() {
		SA.db.tlds
			.associate(true)
			.cols(['id', 'domain', 'blocked', 'discovery', 'sb_lookup',
				'COUNT(contents_tlds.id) AS "contentcount"'
			])
			.order('domain')
			.join('contents_tlds', {'id': 'tld_id'}, 'LEFT')
			.group('tlds.id')

			.findArray(function(err, docs) {
				if (err) {
					SA.Log.e('Could not load TLDs', err);
				} else {
					this._recordsList.empty();
					for (var i = 0; i < docs.length; i++) {
						if (docs[i]) {
							this._addTld(docs[i]);
						}
					}
				}
			}.bind(this));
	},

	/**
	 * Loads all stored contents (from DB).
	 */
	_loadContents: function(tld) {
		this._contentsList.empty();
		this._contentsTable.hide();

		SA.db.contents
			.cols(['id', 'url', 'blocked', 'discovery', 'sb_lookup', 'types.chrome', 'types.name'])
			.join('types', {type_id: 'id'})
			.join('contents_tlds', {'id': 'content_id'})
			.order(['url'])
			.associate(true)
			.findArray({'contents_tlds.tld_id': tld.id},
				function(err, docs) {
					if (err) {
						SA.Log.e('Could not load TLDs', err);
					} else {
						this._contentsTable.show();
						for (var i = 0; i < docs.length; i++) {
							if (docs[i]) {
								this._addContent(docs[i]);
							}
						}
					}
				}.bind(this)
			);
	},

	_addTld: function(tld) {
		var Utils = SA.Utils;
		var blocked = (tld.blocked == 1)
				? chrome.i18n.getMessage('boolean_true') : '';

		$('<tr>')
			.append($('<td>').addClass('bl bb').html(tld.domain))
			.append($('<td>').addClass('bb').html(Utils.formatDateString('Y-m-d', tld.discovery)))
			.append($('<td>').addClass('bb').html(Utils.formatDateString('Y-m-d', tld.sb_lookup)))
			.append($('<td>').addClass('bb center').html(blocked))
			.append($('<td>').addClass('bb br right').append($('<a>')
					.attr('href', '#contents')
					.html(tld.contentcount)
					.on('click', function() {
						this._loadContents(tld);
					}.bind(this))))
			.appendTo(this._recordsList);
	},

	_addContent: function(content) {
		var Utils = SA.Utils;
		var url = content.url;
		if (url.length > 30) {
			url = Utils.breakAt(80, url, '<br>', 10);
		}

		var blocked = (content.blocked == 1)
				? chrome.i18n.getMessage('boolean_true') : '';

		$('<tr>')
			.append($('<td>').addClass('bl bb').html(url))
			.append($('<td>').addClass('bb').html(content['types.name']))
			.append($('<td>').addClass('bb').html(
					Utils.formatDateString('Y-m-d', content.discovery)))
			.append($('<td>').addClass('bb').html(
					Utils.formatDateString('Y-m-d', content.sb_lookup)))
			.append($('<td>').addClass('bb br center').html(blocked))
			.appendTo(this._contentsList);
	},


	/**
	 * Loads all whitelisted URLs.
	 */
	_loadWhitelist: function() {
		this._whitelist.empty();
		SA.messaging.get('whitelist', function(whitelist) {
			if (!whitelist || !whitelist.length) {
				return;
			}

			for (var i = 0; i < whitelist.length; i++) {
				this._addWhitelistUrl(whitelist[i]);
			}
		}.bind(this));
	},

	_addWhitelistUrl: function(url) {
		$('<tr>')
			.append($('<td>').addClass('bl br bb').html(url))
			.appendTo(this._whitelist);
	}

}; })(Zepto).init();