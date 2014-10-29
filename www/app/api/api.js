define(['net'], function (Net) {

	var Api = {};

	Api.rootUrl = '/api/';

	Api._makeUrl = function _makeUrl(url) {
		return Api.rootUrl + url;
	};

	Api.globalSuccess = function (response) {

	};

	Api.globalError = function (error) {
		console.error(error);
	};

	Api.get = function (url) {
		url = Api._makeUrl(url);
		return Net.json.get({url: url}).then(Api.globalSuccess, Api.globalError);
	};

	Api.post = function (url, data) {
		url = Api._makeUrl(url);
		return Net.json.post({url: url, data: data}).then(Api.globalSuccess, Api.globalError);
	};

	return Api;

});