"use strict";

// TODO: Allow updating more things and better: Assigning multiple attributes, Updating a text location with a dom node or a document fragment or the result from an html, using classlist for setting class attribute, setting attributes preserves any static content that appeared before the dynamic part, 

export default function updater(location, func) {
	const type = location.type;
	let node = location.node;
	switch (type) {
		case 'text':
			return function (...pars) {
				// TODO: Handle html results
				let newText = new Text(func(...pars));
				node.replaceWith(newText);
				node = newText;
			};
		case 'attribute':
			let oldAttribute = "";
			return function (...pars) {
				let res = func(...pars);
				if (res === oldAttribute) {
					return;
				}
				if (res !== '') {
					node.setAttribute(res, res);
				}
				if (oldAttribute !== '') {
					node.removeAttribute(oldAttribute);
				}
				oldAttribute = res;
			}
		case 'attribute-value':
			return function (...pars) {
				let val = func(...pars);
				node.setAttribute(location.name, val);
			}
	}
}