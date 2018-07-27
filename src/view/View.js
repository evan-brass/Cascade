"use strict";

import parameterList from "../common/parameterList.js";
import html from "./html.js";

// View keeps track of the users that have been added to a perticular model and activates/deactivates/unuses them with the lifecycle of the view.

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