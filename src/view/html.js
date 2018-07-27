"use strict";

import parameterList from "../common/parameterList.js";
import updater from "./updater.js";

// TODO: Instead of creating a new fragment every single time, create one template and place comment nodes into it at the locations (or immediately before the node in the case of attributes and attribute values).  Copy the fragment out of this template and fetch the locations and build the updaters.

// Use regular expressions to determine where we are in the html string
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
			// MAYBE: Implement a text regular expression
			// TODO: Also let text be replaced by the result of html
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

export default function html(model) {
	return function (strings, ...expressions) {
		let str = '';
		let UID = Date.now();
		let attrOrder = 0;
		let partIDs = {
			get ['attribute-value']() {
				return ``;
			},
			get ['attribute']() {
				return `attr-${UID}-${attrOrder++}=""`;
			},
			'text': `{text-${UID}}`
		};

		// MAYBE: If that normalize thing is called then all the text node locations would be lost, perhaps add a "safe" mode which surrounds the text parts with comment nodes so that they can't be collapsed in the case of normalize being called.
		function locateParts(fragment) {
			let locations = [];

			function sub(node) {
				console.log(node);
				// Base Case
				if (node.nodeType == Node.TEXT_NODE) {
					let idStr = partIDs['text'];
					let index = node.textContent.indexOf(idStr);
					if (index != -1) {
						let exprNode = new Text();
						locations.push({
							type: 'text',
							node: exprNode
						});
						let pre = node.textContent.slice(0, index);
						let post = node.textContent.slice(index + idStr.length);
						let parts = [];
						if (pre != '') {
							parts.push(pre);
						}
						parts.push(exprNode);
						if (post != '') {
							parts.push(post);
						}
						node.replaceWith(...parts);
					}
					return;
				}
				if (node.nodeType == Node.ELEMENT_NODE) {
					let attributes = [];
					let attrMatcher = /attr-[0-9]+-([0-9]+)/;
					let valMatcher = /val-[0-9]+-([0-9]+)/;
					for (let name of node.getAttributeNames()) {
						let value = node.getAttribute(name);
						let attrOrder = new Number(name.match(attrMatcher)[1]);
						if (!isNaN(attrOrder)) {
							attributes.push({
								type: 'attribute',
								node: node,
								attrOrder
							})
							node.removeAttribute(name);
							continue;
						}
						attrOrder = new Number(value.match(valMatcher)[1]);
						if (!isNaN(attrOrder)) {
							attributes.push({
								type: 'attribute-value',
								name,
								node: node,
								attrOrder,
							});
						}
						// TODO: Handle attribute values
					}
					attributes.sort((a, b) => a.attrOrder - b.attrOrder);
					locations = locations.concat(attributes);
				}
				if ('hasChildNodes' in node && node.hasChildNodes()) {
					// TODO: Better way of checking for elements and fragments.  This currently also matches text nodes.
					// Sub all of it's child nodes
					for (let i = 0; i < node.childNodes.length; ++i) {
						sub(node.childNodes[i]);
					}
				}

			}

			sub(fragment);
			return locations;
		}

		let partExpressions = [];
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
		// Append the last string (There's one more string then there are expressions, always)
		str.concat(strings[i]);

		console.log(str);

		let temp = document.createElement('template');
		temp.innerHTML = str;
		let fragment = temp.content;
		console.log(fragment);

		let locations = locateParts(fragment);


		// Create user functions for every expression that 
		for (let i = 0; i < locations.length; ++i) {
			const location = locations[i];
			const expr = partExpressions[i];
			let deps = parameterList(expr);
			model.use(deps, updater(location, expr));
		}

		console.log(fragment);
		return {
			fragment,
			locations,
			partExpressions
		};
	};
}