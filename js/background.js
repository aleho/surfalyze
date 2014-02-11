/**
 * JS for the background page.
 *
 * Here all the magic initialization of SurfAlyze happens.
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

SA.recorder = new SA.RequestRecorder();
SA.interceptor = new SA.Interceptor();

SA.engine = new SA.DecisionEngine({
	recorder: SA.recorder
});

SA.db = new SA.Storage({
	error: function(db, error) {
		SA.Log.e(error);
	},

	ready: function(db, data, event) {
		SA.engine.initFromDb(SA.db);
	}
});