/**
 * Helper for logging tasks.
 *
 * By providing all functions of Log (and its shortcut "l") at any time, no
 * matter what browser is being used, we make sure code doesn't break because of
 * leftover "console.log" calls. It also enables us to permanently add
 * debugging statements that do nothing if "SA.Log.enable(true)" has not yet
 * been called.
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

SA.Log = {
	/**
	 * Enables or disables the logging facility.
	 * @param enabled whether to globally enable logging to console
	 * @param warn alert if console is not available
	 */
	enable: function(enabled, warn) {
		// we always want to log errors
		if (typeof console.error == 'function') {
			SA.Log.e = console.error.bind(console);
		}

		// all other log targets should be enabled based on this condition
		if (!enabled) {
			return;
		}

		if (typeof console == 'undefined' || console == null) {
			if (warn === true) {
				alert('SA.Log: Logging enabled but console not available');
			}
			return;
		}

		// log
		if (typeof console.log == 'function') {
			SA.Log.l = console.log.bind(console);

		} else {
			if (warn === true) {
				alert('SA.Log: Logging enabled but console.log not available');
			}
			return;
		}

		// debug
		if (typeof console.debug == 'function') {
			SA.Log.d = console.debug.bind(console);
		}

		// info
		if (typeof console.info == 'function') {
			SA.Log.i = console.info.bind(console);
		}

		// warn
		if (typeof console.warn == 'function') {
			SA.Log.w = console.warn.bind(console);
		}

		// trace
		if (typeof console.trace == 'function') {
			SA.Log.t = console.trace.bind(console);
		}

		// assert
		if (typeof console.assert == 'function') {
			SA.Log.assert = console.assert.bind(console);
		}
	},

	/**
	 * Logs to console using default logging function.
	 * @param msg
	 */
	l: function() {},

	/**
	 * Logs to console using debug target.
	 * @param msg
	 */
	d: function() {},

	/**
	 * Logs to console using info target.
	 * @param msg
	 */
	i: function() {},

	/**
	 * Logs to console using warning target.
	 * @param msg
	 */
	w: function() {},

	/**
	 * Logs to console using error target.
	 * @param msg
	 */
	e: function() {},

	/**
	 * Print a stack trace.
	 */
	t: function() {},

	/**
	 * Assert condition is true.
	 * Will throw an exception on false.
	 * @param condition
	 */
	a: function(condition) {}
};


/**
 * Even shorter shortcut for even lazier developers during development.
 */
if (typeof l == 'undefined') {
	var l = SA.Log;
}