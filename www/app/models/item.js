define(['ko'], function (ko) {

	function Item(options) {
		options = options || {};
		this.id = ko.observable(options.id);
		this.description = ko.observable(options.description);
		this.user = ko.observable(options.user);
		this.newUser = ko.observable();
	}

	Item.prototype.update = function update(options) {
		if (options.id) { this.id(options.id); }
		if (options.description) { this.description(options.description); }
		if (options.user) { this.user(options.user); }
	};

	Item.prototype.toJSON = function () {
		return {
			id: this.id(),
			description: this.description(),
			user: this.newUser()
		};
	};

	return Item;

});