"use strict";

// Default comparison functions for different types.  These can always be overridden by a compare function on the definition.
export default function defaultCompare(type) {
	if (type == Date) {
		return (A, B) => (A.getTime() == B.getTime());
	} else if (type == Array || type == HTMLCollection) {
		// Arrays are practically the same as collections.  They propagate a change when what's in them changes, order or if an item is added or removed.
		return function (A, B) {
			if (A.length == B.length) {
				for (let i = 0; i < A.length; ++i) {
					if (A[i] != B[i]) {
						return false;
					}
				}
				return true;
			}
			return false;
		};
	} else {
		return (A, B) => A == B;
	}
}