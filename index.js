'use strict';

var toTasks = require('./lib/to-tasks');
var utils = require('./lib/utils');
var env = require('./lib/env');

function create(Base, config) {
  if (utils.isObject(Base)) {
    config = Base;
    Base = require('base-methods');
  }

  config = utils.createConfig(config || {});
  var proto = Base.prototype;
  var method = config.method || 'app';
  var plural = config.plural || 'apps';

  /**
   * Create an instance of Runner with the given options.
   *
   * @param {Object} `options`
   * @param {Object} `parent`
   * @param {Function} `fn`
   */

  function Runner(options, parent, fn) {
    if (typeof options === 'function') {
      return new Runner(null, null, options);
    }

    if (typeof parent === 'function') {
      return new Runner(options, null, parent);
    }

    if (!(this instanceof Runner)) {
      return new Runner(options, parent, fn);
    }

    Base.call(this);
    this.use(utils.runtimes());

    if (typeof config.initFn === 'function') {
      config.initFn.call(this, this);
    }

    if (!this.name) {
      this.name = Base.name || 'base';
    }

    this.options = options || {};
    this.define('parent', null);
    this[plural] = {};
    this.config = {};
    this.paths = {};
    this.env = {};

    if (parent) {
      this.parent = parent;
    } else {
      this.initRunner();
    }

    if (typeof fn === 'function') {
      this.invoke(fn);
    }
  }

  /**
   * Inherit Base
   */

  Base.extend(Runner);

  /**
   * Create the `base` runner instance, along with any defaults,.
   */

  Runner.prototype.initRunner = function() {
    this.use(env());
    this.loadMiddleware({});
    this.loadTasks({});
  };

  /**
   * Load an object of middleware functions.
   */

  Runner.prototype.loadMiddleware = function(fns) {
    for (var fn in fns) this.invoke(fns[fn]);
  };

  /**
   * Load an object of tasks.
   */

  Runner.prototype.loadTasks = function(tasks) {
    for (var key in tasks) {
      this.task(key, this.invoke(tasks[key]));
    }
  };

  /**
   * Call the given `fn` in the context if the current instance,
   * passing the instance, the `base` instance, and `env` as
   * arguments to `fn`.
   *
   * @param {Function} `fn`
   * @return {Object} Returns the instance, for chaining.
   */

  Runner.prototype.invoke = function(fn) {
    var App = this.Ctor;
    var app = this;
    if (App && App.prototype.register) {
      app = new App();
    }
    fn.call(this, app, this.base, this.env);
    return this;
  };

  /**
   * Run the given applications and their `tasks`. The given
   * `callback` function will be called when the tasks are complete.
   *
   * ```js
   * generators: {
   *   foo: ['one', 'two'], // tasks
   *   bar: ['three']
   * }
   * ```
   * @param {String|Array|Object} `tasks`
   * @param {Function} cb
   * @return {Object} returns the instance for chaining
   */

  Runner.prototype.build = function(tasks, cb) {
    if (typeof tasks === 'string') {
      return this.runTasks.apply(this, arguments);
    }
    if (utils.isObject(tasks)) {
      return this.runTasks.apply(this, arguments);
    }
    if (Array.isArray(tasks)) {
      if (utils.isSimpleTask(tasks)) {
        proto.build.call(this, tasks, cb);
        return this;
      }
      utils.async.each(tasks, function(task, next) {
        this.build(task, next);
      }.bind(this), cb);
      return this;
    }
    this.emit('build', tasks);
    proto.build.call(this, tasks, cb);
  };

  /**
   * Run the given applications and their `tasks`. The given
   * `callback` function will be called when the tasks are complete.
   *
   * ```js
   * generators: {
   *   foo: ['one', 'two'], // tasks
   *   bar: ['three']
   * }
   * ```
   * @param {String|Array|Object} `tasks`
   * @param {Function} cb
   * @return {Object} returns the instance for chaining
   */

  Runner.prototype.runTasks = function(tasks, cb) {
    if (!utils.isObject(tasks)) {
      tasks = toTasks(tasks, this, plural);
    }

    if (Array.isArray(tasks)) {
      utils.async.each(tasks, function(task, next) {
        this.build(task, next);
      }.bind(this), cb);
      return this;
    }

    utils.async.eachOf(tasks, function(list, name, next) {
      var app = this[method](name);
      this.emit('runTasks', name, app);
      app.build(list, next);
    }.bind(this), cb);
    return this;
  };

  /**
   * Add a leaf to the task-runner tree.
   *
   * @param {String} `name`
   * @param {Array} `tasks`
   */

  Runner.prototype.leaf = function(name, tasks) {
    this.tree = this.tree || {};
    this.tree[name] = Object.keys(tasks);
  };

  /**
   * Custom `inspect` method.
   */

  Runner.prototype.inspect = function() {
    var obj = {
      options: this.options,
      parent: Base.name,
      name: this.name,
      path: this.path,
      env: this.env
    };

    obj.tasks = Object.keys(this.tasks);
    if (this.tree) {
      obj.tree = this.tree;
    }

    if (typeof config.inspectFn === 'function') {
      config.inspectFn.call(this, obj, this);
    }
    return obj;
  };

  /**
   * Get the depth of the current instance. This provides a quick
   * insight into how many levels of nesting there are between
   * the `base` instance and the current application.
   *
   * ```js
   * console.log(this.depth);
   * //= 1
   * ```
   * @return {Number}
   */

  utils.define(Runner.prototype, 'depth', {
    get: function() {
      return this.parent ? this.parent.depth + 1 : 0;
    }
  });

  /**
   * Get the `base` instance.
   *
   * ```js
   * var base = this.base;
   * ```
   * @return {Object}
   */

  utils.define(Runner.prototype, 'base', {
    get: function() {
      return this.parent ? this.parent.base : this;
    }
  });

  return Runner;
};

/**
 * Expose `create`
 */

module.exports = create;
