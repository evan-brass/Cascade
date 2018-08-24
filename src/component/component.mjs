"use strict";

import html from "./html.js";
import StateModel from "./stateModel.js";

// TODO: Keep track of the users that have been added to a perticular model and activates/deactivates/unuses them with the lifecycle of the view.
// TODO: Create ways of expressing things like one and two way binding, event listeners/deligated event listeners, reusing/sorting an array of html results, deactivating a section of view without removing it from the dom (perhaps while a loader is being displayed), Displaying some content until a promise is resolved, other things that lit-html has...

export default function Component(description, stateModel = StateModel) {
	let template = description({
		html: html(stateModel)
	});

	return class extends StateModel {
		constructor() {
			super();

			// Create a shadowDOM
			this.attachShadow({ mode: 'open' });

			// Create our fragment and link into it.
			this.shadowRoot.appendChild(template(this));
		}
	}
};