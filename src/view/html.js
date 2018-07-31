"use strict";

import parameterList from "../common/parameterList.js";
import updater from "./updater.js";

// TODO: Instead of creating a new fragment every single time, create one template and place comment nodes into it at the locations (or immediately before the node in the case of attributes and attribute values).  Copy the fragment out of this template and fetch the locations and build the updaters.
// TODO: Reflect the tree structure of a view in the result of html.  This will help when we need to activate and deactivate users based on conditional
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

const cachedTemplates = new WeakMap();
function createTemplate(strings) {
	let cached;
	if (cached = cachedTemplates.get(strings)) {
		return cached;
	} else {
		// Data
		let str = '';
		let UID = Date.now();
		let attrOrder = 0;
		let partIDs = {
			get ['attribute-value']() {
				return `val-${attrOrder++}`;
			},
			get ['attribute']() {
				return `attr-${UID}-${attrOrder++}=""`;
			},
			'text': `{text-${UID}}`
		};

		// Concatinate the strings with the appropriate marker text
		for (let i = 0; i != (strings.length - 1); ++i) {
			const sub = strings[i];
			str = str + sub;
			str = str + partIDs[location(str)];
		}
		str += strings[strings.length - 1];

		// Create the template
		let template = document.createElement('template');
		cachedTemplates.set(strings, template);
		template.innerHTML = str;

		// Turn the marker texts into marker comment nodes
		let locations = [];
		function sub(node) {
			console.log(node);
			// Base Case
			if (node.nodeType == Node.TEXT_NODE) {
				let idStr = partIDs['text'];
				let index = node.textContent.indexOf(idStr);
				if (index != -1) {
					let exprNode = new Comment(`text-${UID}`);
					locations.push({
						type: 'text'
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
				}
				if (attributes.length != 0) {
					attributes.sort((a, b) => a.attrOrder - b.attrOrder);
					node.parentNode.insertBefore(new Comment(`${attributes.map(a => a)}`), node);
				}
			}
			if (node.hasChildNodes()) {
				// Sub all of it's child nodes
				for (let i = 0; i < node.childNodes.length; ++i) {
					sub(node.childNodes[i]);
				}
			}

		}

		sub(template);

		return template;
	}
}

export default function html(model) {
	return function (strings, ...expressions) {
		let template = createTemplate(strings);

		/*

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
		*/
	};
}