"use strict";

export function parameterList(func) {
	if (!(func instanceof Function)) {
		throw new Error("Expected a function");
	}

	// TODO: Give an error for default parameter values and destructuring.
	let [, normal, specialArrow] = (new String(func))
		.match(/^[\w\s]*\(([^)]*)\)|^(\w?)/);
	if (specialArrow) {
		return [specialArrow];
	} else {
		return normal.split(',')
			.map(arg => arg.trim())
			.filter(parName => parName != '');
	}
}