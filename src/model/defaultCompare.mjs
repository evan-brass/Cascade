"use strict";


// Used to determine if we need to call the watchers
export function defaultCompare(a, b) {
	if (a instanceof Date && b instanceof Date) {
		if (a === b) {
			return true;
		} else if (a === null || b === null) {
			return false;
		} else {
			return a.getTime() == b.getTime();
		}
	} else if (a instanceof Array && b instanceof Array) {
		if (a.length === b.length) {
			return a.every((val, index) => defaultCompare(val, b[index]));
		} else {
			return false;
		}
	} else {
		return a === b;
	}
}