define(['ko', 'api/api', 'models/item'], function (ko, Api, Item) {

	var ListApi = {};

	ListApi.list = ko.observableArray();

	ListApi.populate = function populate() {
		return Api.get('list').then(function (response) {
			ListApi.list.removeAll();
			response.list.forEach(function (item) {
				ListApi.list.push(new Item(item));
			});
		});
	};

	ListApi.new = function (item) {
		if (!item) { throw new Error('No data passed.'); }
		return Api.post('list', item.toJSON()).then(function (response) {
			ListApi.list.push(new Item(response));
		});
	};

	ListApi.update = function (item) {
		if (!item) { throw new Error('Id is required.'); }
		var id = item.id();
		return Api.post('list/' + id, item.toJSON()).then(function (response) {
			item.update(response);
		});
	};

	ListApi.load = function load(name, parentRequire, onload, config) {
		if (config.isBuild) { return onload(ListApi); }

		var done = function () {
			onload(ListApi);
		};

		ListApi.populate().then(done, done);
	};

	return ListApi;

});