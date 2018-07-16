export const ShapeDef = {
	'area': {
		type: Number,
		value: 0
	},
	'perimeter': {
		type: Number,
		value: 0
	}
};

export const RectangleDef = {
	'width': {
		type: Number,
		value: 0
	},
	'height': {
		type: Number,
		value: 0
	},
	'area': {
		type: Number,
		value(width, height) {
			return width * height;
		}
	},
	'perimeter': {
		type: Number,
		value(width, height) {
			return 2 * (width + height);
		}
	}
};

export const SquareDef = {
	'side': {
		type: Number,
		value: 0
	},
	'width': {
		type: Number,
		value(side) {
			return side;
		}
	},
	'height': {
		type: Number,
		value(side) {
			return side;
		}
	}
};

export const CircleDef = {
	'radius': {
		type: Number,
		value: 0
	},
	'area': {
		type: Number,
		value(radius) {
			return Math.PI * Math.pow(radius, 2);
		}
	}
};