"use strict";

import parameterList from "../common/parameterList.js";
import html from "./html.js";

// TODO: Keep track of the users that have been added to a perticular model and activates/deactivates/unuses them with the lifecycle of the view.
// TODO: Create ways of expressing things like one and two way binding, event listeners/deligated event listeners, reusing/sorting an array of html results, deactivating a section of view without removing it from the dom (perhaps while a loader is being displayed), Displaying some content until a promise is resolved, other things that lit-html has...

export default function View(model, func) {
	let pars = {
		html: html(model),
		one(propName) {
			if (propName in model) {
				// TODO: Remove the new function.  It's just here so that the parameterList get's the right stuff when creating the user.
				return new Function(propName, 'return ' + propName);
			} else {
				throw new Error(`Can't create a one way binding to a property that doesn't exist on the model`);
			}
		},
		two: () => { }
	};
	let parameters = parameterList(func).map(name => pars[name]);
	let viewResult = func(...parameters);

	return viewResult;
};