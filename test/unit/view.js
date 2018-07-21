"use strict";

import View from "../../src/view/view.js";
//import Model from "../src/Model.js";

describe('View', function (html) {
	it.skip('General Testing', function () {
		console.log(View(null, function (html) {
			return html`<div>${80 + 5}</div>${() => "happy"}`;
		}));
	});
});