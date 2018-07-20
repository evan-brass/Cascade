"use strict";

import { parameterList } from "./common.js";


// View keeps track of the users that have been added to a perticular model and activates/deactivates/unuses them with the lifecycle of the view.
export default function View(model, func) {
	function location(str) {
		let tests = {
			// Current test set is at: https://regexr.com/3spam
			'attribute-value': /<[a-zA-Z\-]+(?:\s+[a-zA-z\-]+(?:=['"][^'"]*['"])?)*\s+[a-zA-Z\-]+=['"]$/,
			'attribute': /<[a-zA-Z\-]+(?:\s+[a-zA-z\-]+(?:=['"][^'"]*['"])?)*\s+$/,
			'comment': {
				// TODO: Implement a comment regular expression
				test(str) { return false; }
			},
			'text': {
				// MAYBE: Implement a text regular expression\
				test(str) { return true; }
			}
		};
		// Order to test the regular expressions
		let ordered = ['attribute-value', 'attribute', 'comment', 'text'];
		for (let test of ordered) {
			const regEx = tests[test];
			if (regEx.test(str)) {
				return test;
			}
		}
		throw new Error("Unable to determine the location from the string. The only valid locations for a part are: as an attribute's value, as an attribute, or in a text location");
	}
	function html(strings, ...expressions) {
		let str = '';
		let partExpressions = [];
		let UID = Date.now();
		let partIDs = {
			'attribute-value': `val-${UID}`,
			'attribute': `attr-${UID}=""`,
			'text': `{text-${UID}}`
		};
		let i;
		for (i = 0; i < expressions.length; ++i) {
			const exp = expressions[i];
			const left = strings[i];
			const right = strings[i + 1];

			str = str.concat(left);
			if (exp instanceof Function) {
				partExpressions.push(exp);
				exp.location = location(str);
				str = str.concat(partIDs[exp.location]);
			} else {
				str = str.concat(exp.toString());
			}
		}
		str.concat(strings[i]); // Append the last string (There's one more string then expression, always

		console.log(str);

		let temp = document.createElement('template');
		temp.innerHTML = str;
		let fragment = temp.content;
		console.log(fragment);

		let partLocations = [];
		let nextLoc = 0;
		let walker = document.createTreeWalker(fragment,
			NodeFilter.SHOW_COMMENT |
			NodeFilter.SHOW_ELEMENT |
			NodeFilter.SHOW_TEXT);
		let idStr = partIDs['text'];
		do {
			const node = walker.currentNode;
			console.log(node);
			if (node.nodeType == Node.TEXT_NODE) {
				let index = node.wholeText.indexOf(idStr);
				if (index != -1) {
					let exprNode = new Text();
					partLocations.push(exprNode);
					node.replaceWith(node.wholeText.slice(0, index),
						exprNode,
						node.wholeText.slice(index + idStr.length));
				}
			}
		} while (walker.nextNode());


		console.log(fragment);
		return fragment;
	}

	func(html);
};



// How I'd like to be able to use this:
/*

let documentFragment = View(model, function (html, one, two, unsafe, link) {
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
}) */