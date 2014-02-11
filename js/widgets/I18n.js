/**
 * I18n helper to translate all DOM elements with a data-i18n attribute.
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

SA.I18n = {
	/**
	 * Translates all
	 * @param attribute
	 */
	translate: function() {
		var items = document.querySelectorAll('[data-i18n]');
		for (var i = 0; i < items.length; i++) {
			var item = items[i];

			var id = item.getAttribute('data-i18n');
			if (!id) {
				console.log('I18n attribute value unset', item);
				continue;
			}

			var translation = this._getTranslation(id);

			if (item.tagName == 'INPUT') {
				item.value = translation;
			} else {
				item.innerHTML = translation;
			}
		}
	},

	_getTranslation: function(id, def) {
		var msg = chrome.i18n.getMessage(id);
		if (msg) {
			return msg;
		}

		console.error('i18n ID ' + id + ' not translated');
		return def || id;
	}
};

document.addEventListener('DOMContentLoaded', function I18nInit(event) {
	document.removeEventListener('DOMContentLoaded', I18nInit, false);
	SA.I18n.translate();
}, false);