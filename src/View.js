"use strict";

import { parameterList } from "./common.js";


// View keeps track of the users that have been added to a perticular model and activates/deactivates/unuses them with the lifecycle of the view.
export default function View(model, func) {
	

};

// How I'd like to be able to use this:

let documentFragment = View(model, function (one, two, unsafe, link) {
	// Static variables
	let ratings = [
		'Inteligent',
		'Bland',
		'Uninteligent',
		'Uninteligable'
	];

	return
html`<section class="post">
	<header>
		<select>
			${ratings.map(rating => html`<option>${rating}</option>`)}
		</select>
		<h1>${one(author)}</h1>
	</header>
	${unsafe(content)}
</section>`;
})