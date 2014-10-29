(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define(factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.net = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here

/**
 * net.js 0.1 Copyright (c) 2013, Matt King (mking@mking.me)
 * Available via the MIT license.
 * see: https://github.com/mattking17/net.js for details
 */
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../node_modules/almond/almond", function(){});

define('promise',

       [],

function() {

  var types = {
    SUCCESS: 'success',
    FAIL: 'fail'
  };

  function Promise() {
    this.promises = {
      success: [],
      fail: []
    };
  }

  Promise.prototype.then = function(success, fail) {
    if (success) {
      this.promises.success.push(success);
    }
    if (fail) {
      this.promises.fail.push(fail);
    }
    return this;
  };

  Promise.prototype.run = function(type, response, request) {
    var result = response,
        list = this.promises[type];
    while (list.length) {
      var func = list.shift();
      var callResult = func(result, request);
      result = callResult || result;
    }
    return this;
  };

  Promise.prototype.succeed = function(response, request) {
    return this.run(types.SUCCESS, response, request);
  };

  Promise.prototype.fail = function(response) {
    return this.run(types.FAIL, response);
  };

  return Promise;

});

define('net/ajax',

       ['promise'],

function(Promise) {

  var XMLHttpRequest = function() {
    XMLHttpRequest = window.XMLHttpRequest || (function() {

      var types = ['Msxml2.XMLHTTP.6.0',
                   'Msxml2.XMLHTTP.3.0',
                   'Microsoft.XMLHTTP'];

      var manufacture = function(type) {
        return function() {
          return new window.ActiveXObject(type);
        };
      };

      for (var i = 0; i < types.length; i++) {
        try {
          var n = new window.ActiveXObject(types[i]);
          return manufacture(types[i]);
        } catch (e) { }
      }

      throw new Error('This browser does not support XMLHttpRequest.');

    }());

    return new XMLHttpRequest(Array.prototype.slice.call(arguments, 0));
  };

  var METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE'
  };

  var validResponses = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content'
  };

  var invalidResponses = {
    0: 'Server Could Not Be Reached',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    411: 'Method Not Allowed',
    500: 'Internal Server Error',
    501: 'Unsupported Method',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  function badRequest(status) {
    return status === 0 || status > 399;
  }

  function handleReadyStateChange(promise, options) {

    return function() {
      if (this.readyState !== 4) {
        return;
      }
      if (badRequest(this.status)) {
        promise.fail(this);
      } else {
        if (options.process) {
          options.process.call(options.process, this, promise);
        } else {
          promise.succeed(this);
        }
      }
    };

  }

  function request(optionsOrString, options) {

    if (typeof optionsOrString === 'string') {
      options = options || {};
      options.url = optionsOrString;
    } else {
      options = optionsOrString || {};
    }

    var promise = new Promise();
    promise.then(options.success || function(res) { return res; },
                 options.error || function(res) { return res; } );

    var req = new XMLHttpRequest();
    req.open(options.method || METHODS.GET, options.url, true);

    options.headers = options.headers || {};

    for (var k in options.headers) {
      req.setRequestHeader(k, options.headers[k]);
    }

    req.withCredentials = options.withCredentials;

    req.onreadystatechange = handleReadyStateChange(promise, options);

    if (req.readyState === 4) {
      return false;
    }

    req.send(options.data || null);

    return promise;
  }

  function prepOptions(optionsOrUrl, options, method) {
    if (typeof optionsOrUrl === 'string' && options) {
      options.method = method;
    } else {
      optionsOrUrl.method = method;
    }
  }

  function get(optionsOrUrl, options) {
    prepOptions(optionsOrUrl, options, METHODS.GET);
    return request(optionsOrUrl, options);
  }

  function post(optionsOrUrl, options) {
    prepOptions(optionsOrUrl, options, METHODS.POST);
    return request(optionsOrUrl, options);
  }

  function put(optionsOrUrl, options) {
    prepOptions(optionsOrUrl, options, METHODS.PUT);
    return request(optionsOrUrl, options);
  }

  function del(optionsOrUrl, options) {
    prepOptions(optionsOrUrl, options, METHODS.DELETE);
    return request(optionsOrUrl, options);
  }

  var api = {
    get: get,
    post: post,
    put: put,
    delete: del,
    request: request
  };

  return api;

});

define('net/json',

       ['net/ajax'],

function(ajax) {

  function preprocess(options) {
    options = options || {};
    options.headers = options.headers || {};
    options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
    options.headers.Accept = options.headers.Accept || 'application/json';
    options.process = process;

    if (options.data) {
      options.data = JSON.stringify(options.data);
    }
  }

  function process(request, promise) {
    var response;
    try {
      response = JSON.parse(request.responseText || '{}');
    } catch(e) {
      return promise.fail(request);
    }
    return promise.succeed(response, request);
  }

  function get(options) {
    preprocess(options);
    return ajax.get(options);
  }

  function post(options) {
    preprocess(options);
    return ajax.post(options);
  }

  function put(options) {
    preprocess(options);
    return ajax.put(options);
  }

  function del(options) {
    preprocess(options);
    return ajax.delete(options);
  }

  var api = {
    get: get,
    post: post,
    put: put,
    delete: del
  };

  return api;

});

define('net/form',

       ['net/ajax'],

function(ajax) {

  function serialize(data) {
    for (var index = 0, keys = Object.keys(data), length = keys.length, out = [];
         index < length;
         index++) {

      out.push([
        encodeURIComponent(keys[index]),
        encodeURIComponent(data[keys[index]])
      ].join('='));
    }
    return out.join('&');
  }

  function preprocess(options) {
    options = options || {};
    options.headers = options.headers || {};
    if (options.data) {
      if (options.data.nodeName === 'FORM') {
        options.data = new FormData(options.data);
      } else if (!(options.data instanceof FormData)) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.data = serialize(options.data);
      }
    }
  }

  function post(options) {
    preprocess(options);
    return ajax.post(options);
  }

  function put(options) {
    preprocess(options);
    return ajax.put(options);
  }

  var api = {
    post: post,
    put: put
  };

  return api;

});

define('net',

       ['net/ajax',
        'net/json',
        'net/form'],

function(ajax, json, form) {

  var api = {
    ajax: ajax,
    json: json,
    form: form
  };

  return api;

});

    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return require('net');
}));