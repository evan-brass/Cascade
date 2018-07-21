import View from "../src/view/view.js";
import Model from "../src/model/model.js";

const Person = Model({
	'first': {
		type: String,
		value: ''
	},
	'last': {
		type: String,
		value: ''
	},
	'age': {
		type: Number,
		value: -1
	}
});
const Post = Model({
	'title': {
		type: String,
		value: 'untitled'
	},
	'author': {
		type: Person,
		value: null
	},
	'created-date': {
		type: Date,
		value: null
	},
	'contents': {
		type: String,
		value: ''
	}
});

View(null, function(html) {
	return html`<article>
		<header>
			<
		</header>
		This number is: ${80 + 5}
	</article>${() => "happy"}`;
})