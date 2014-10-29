define(
[
	'ko',
	'api/listApi!',
	'models/item'
],
function (ko, ListApi, Item) {

	var ViewModel = {};

	ViewModel.list = ListApi.list;

	ViewModel.newItem = new Item();

	ViewModel.submitNewItem = function submitNewItem() {
		ListApi.new(ViewModel.newItem).then(function () {
			ViewModel.newItem = new Item();
		});
	};

	ViewModel.submitUpdate = function submitUpdate(item) {
		ListApi.update(item);
	};

	ViewModel.load = function load(name, parentRequire, onload, config) {
		if (config.isBuild) { return onload(ViewModel); }

		ko.applyBindings(ViewModel);
		onload(ViewModel);
	};

	return ViewModel;

});
