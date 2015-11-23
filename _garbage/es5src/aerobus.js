/*
  var bus = aerobus(console.log.bind(console));
  ideas:
    dispose channel when it becomes empty
    channel.forward -
      static - accepts channel name 
      dynamic - accepts callback resolving channel name
    channel.zip
      zips publications from several channels and combine them via callback passing as array
      triggers combined publication to self
    buffer, distinct(untilChanged), randomize/reduce/sort until finished, whilst? operators
    subscription/publication strategies: cycle | random | serial | parallel
    delay/debounce/throttle/repeat may accept dynamic intervals (callback)
    subscriptions priority + cancellation via 'return false'
    named subscriptions/publications
    request - reponse pattern on promises
    plugable persistence with expiration
*/

(function(global, factory) {

  if (typeof exports === 'object') module.exports = factory();
  else global.aerobus = factory();

} (this, function(undefined) {
  // error messages
  var MESSAGE_ARGUMENTS = 'Unexpected number of arguments.',
      MESSAGE_CALLBACK = 'Callback must be function.',
      MESSAGE_CHANNEL = 'Channel must be instance of channel class.',
      MESSAGE_CONDITION = 'Condition must be channel name or date or function or interval.',
      MESSAGE_COUNT = 'Count must be positive number.',
      MESSAGE_DELIMITER = 'Delimiter must be string.',
      MESSAGE_DISPOSED = 'Object has been disposed.',
      MESSAGE_FORBIDDEN = 'Operation is forbidden.',
      MESSAGE_INTERVAL = 'Interval must be positive number.',
      MESSAGE_NAME = 'Name must be string.',
      MESSAGE_OPERATION = 'Operation must be instance of publication or subscription class.',
      MESSAGE_STRATEGY = 'Strategy name must be one of the following: "cyclically", "randomly", "simultaneously".',
      MESSAGE_SUBSCRIBER = 'Subscriber must be function.',
      MESSAGE_TRACE = 'Trace must be function.';

  // standard settings
  var DELIMITER = '.', ERROR = 'error', ROOT = '';

  // continuation flags
  var CONTINUE = 0, FINISH = 2, SKIP = 1;

  // shared variables
  var identities = {};

  // shortcuts to native utility methods
  var _ArrayMap = Array.prototype.map,
      _ArraySlice = Array.prototype.slice,
      _clearInterval = clearInterval,
      _clearTimeout = clearTimeout,
      _ObjectCreate = Object.create,
      _ObjectDefineProperties = Object.defineProperties,
      _ObjectDefineProperty = Object.defineProperty,
      _ObjectKeys = Object.keys,
      _setImmediate = typeof setImmediate === 'function'
        ? setImmediate
        : typeof process === 'object' && isFunction(process.nextTick)
          ? process.nextTick
          : function(callback) {
            return _setTimeout(callback, 0);
          },
      _setInterval = setInterval,
      _setTimeout = setTimeout;

  // invokes handler for each item of collection (array or enumerable object)
  // handler can be function or name of item's method
  function each(collection, handler) {
    if (collection == null) return;
    var invoker, parameters;
    if (1 === arguments.length) {
      invoker = invokeSelf;
      parameters = [];
    }
    else if (isString(handler)) {
      invoker = invokeProperty;
      parameters = _ArraySlice.call(arguments, 2);
    }
    else if (isFunction(handler)) {
      invoker = invokeHandler;
      parameters = _ArraySlice.call(arguments, 2);
    }
    else {
      invoker = invokeSelf;
      parameters = handler;
    }
    isNumber(collection.length) ? eachItem() : eachKey();
    function invokeHandler(item) {
      return handler.apply(undefined, [item].concat(parameters));
    }
    function invokeProperty(item) {
      return item[handler].apply(item, parameters);
    }
    function invokeSelf(item) {
      return item.apply(undefined, parameters);
    }
    function eachItem() {
      for (var i = 0, l = collection.length; i < l; i++) {
        var item = collection[i];
        if (isDefined(item) && false === invoker(item)) break;
      }
    }
    function eachKey() {
      for (var key in collection) {
        var item = collection[key];
        if (isDefined(item) && false === invoker(item)) break;
      }
    }
  }

  // returns next identity value for specified object by its name or constructor name
  function identity(object) {
    var type = isFunction(object) ? object.name : object.constructor.name;
    return type.toLowerCase() + '_' + (type in identities ? ++identities[type] : (identities[type] = 1));
  }

  // type checkers
  function isArray(value) {
    return Array.isArray(value);
  }
  function isChannel(value) {
    return value instanceof Channel;
  }
  function isDate(value) {
    return value instanceof Date;
  }
  function isDefined(value) {
    return value !== undefined;
  }
  function isError(value) {
    return value instanceof Error;
  }
  function isFunction(value) {
    return value instanceof Function;
  }
  function isMessage(value) {
    return value instanceof Message;
  }
  function isNumber(value) {
    return 'number' === typeof value || value instanceof Number;
  }
  function isPublication(value) {
    return value instanceof Publication;
  }
  function isString(value) {
    return 'string' === typeof value || value instanceof String;
  }
  function isSubscription(value) {
    return value instanceof Subscription;
  }
  function isUndefined(value) {
    return value === undefined;
  }

  // utility functions
  function noop() {}

  // arguments validators
  function validateCallback(value) {
    if (!isFunction(value)) throw new Error(MESSAGE_CALLBACK);
  }
  function validateCount(value) {
    if (!isNumber(value) || value < 1) throw new Error(MESSAGE_COUNT);
  }
  function validateDelimiter(value) {
    if (!isString(value)) throw new Error(MESSAGE_DELIMITER);
  }
  function validateDisposable(value) {
    if (value.isDisposed) throw new Error(MESSAGE_DISPOSED);
  }
  function validateInterval(value) {
    if (!isNumber(value) || value < 1) throw new Error(MESSAGE_INTERVAL);
  }
  function validateName(value) {
    if (!isString(value)) throw new Error(MESSAGE_NAME);
  }
  function validateSubscriber(value) {
    if (!isFunction(value)) throw new Error(MESSAGE_SUBSCRIBER);
  }
  function validateTrace(value) {
    if (!isFunction(value)) throw new Error(MESSAGE_TRACE);
  }

  // creates new bus object
  function aerobus(delimiter, trace) {
    var channels, configurable;
    if (!arguments.length) {
      delimiter = DELIMITER;
      trace = noop;
    }
    else if (isFunction(delimiter)) {
      trace = delimiter;
      delimiter = DELIMITER;
    }
    else {
      validateDelimiter(delimiter);
      if (isDefined(trace)) validateTrace(trace);
      else trace = noop;
    }
    // creates new channel or returns existing one
    // name must be a string
    // if multiple names are specified returns Domain object supporting simultaneous operations on multiple channels
    function bus(name1, name2, nameN) {
      if (!arguments.length) return bus(ROOT);
      if (arguments.length > 1) return new Domain(bus, _ArrayMap.call(arguments, function(n) {
        return bus(n);
      }));
      var name = arguments[0];
      if (arguments.length === 1 && isArray(name)) return new Domain(bus, name.map(function(n) {
        return bus(n);
      }));
      var channel = channels[name];
      if (channel) return channel;
      var parent;
      if (name !== ROOT && name !== ERROR) {
        validateName(name);
        var index = name.indexOf(delimiter);
        parent = -1 === index
          ? bus(ROOT)
          : bus(name.substr(0, index));
      }
      configurable = false;
      channel = channels[name] = new Channel(bus, name, parent).onDispose(dispose);
      return channel;
      function dispose() {
        delete channels[name];
      }
    }
    init();
    _ObjectDefineProperties(bus, {
      clear: {value: clear},
      channels: {enumerable: true, get: getChannels},
      create: {value: aerobus},
      delimiter: {enumerable: true, get: getDelimiter, set: setDelimiter},
      error: {enumerable: true, get: getError},
      id: {enumerable: true, value: identity(bus)},
      root: {enumerable: true, get: getRoot},
      trace: {get: getTrace, set: setTrace},
      unsubscribe: {value: unsubscribe}
    });
    trace('create', bus);
    return bus;
    // empties this bus
    function clear() {
      trace('clear', bus);
      each(channels, 'dispose');
      init();
      return bus;
    }
    // returns array of all existing channels
    function getChannels() {
      return _ObjectKeys(channels).map(function(key) {
        return channels[key];
      });
    }
    // returns delimiter string
    function getDelimiter() {
      return delimiter;
    }
    // returns error channel
    function getError() {
      return bus(ERROR);
    }
    // returns root channel
    function getRoot() {
      return bus(ROOT);
    }
    // returns trace function
    function getTrace() {
      return trace;
    }
    function init() {
      channels = _ObjectCreate(null);
      configurable = true;
    }
    // sets delimiter string if this bus is empty
    // otherwise throws error
    function setDelimiter(value) {
      if (!configurable) throw new Error(MESSAGE_FORBIDDEN);
      validateDelimiter(delimiter);
      delimiter = value;
    }
    // sets trace function if this bus is empty
    // otherwise throws error
    function setTrace(value) {
      if (!configurable) throw new Error(MESSAGE_FORBIDDEN);
      validateTrace(value);
      trace = value;
    }
    // unsubscribes all specified subscribes from all channels of this bus
    function unsubscribe(subscriber1, subscriber2, subscriberN) {
      each(channels, 'unsubscribe', _ArraySlice.call(arguments));
      return bus;
    }
  }

  // creates new activity object (abstract base for channels, publications and subscriptions)
  function Activity(bus, parent) {
    var disposed = false, disposers = [], enabled = true, enablers = [], ensured = false, triggers = [];
    var activity = _ObjectDefineProperties(this, {
      bus: {enumerable: true, value: bus},
      disable: {value: disable},
      dispose: {value: dispose},
      isDisposed: {enumerable: true, get: getDisposed},
      enable: {value: enable},
      isEnabled: {enumerable: true, get: getEnabled},
      ensure: {value: ensure},
      isEnsured: {enumerable: true, get: getEnsured},
      id: {enumerable: true, value: identity(this)},
      onDispose: {value: onDispose},
      onEnable: {value: onEnable},
      onTrigger: {value: onTrigger},
      trigger: {value: trigger}
    });
    bus.trace('create', activity);
    return activity;
    // disables this activity
    function disable() {
      validateDisposable(activity);
      if (enabled) {
        bus.trace('disable', activity);
        enabled = false;
        notify();
      }
      return activity;
    }
    // disposes this activity
    function dispose() {
      if (!disposed) {
        bus.trace('dispose', activity);
        disposed = true;
        enabled = false;
        each(disposers);
        disposers.length = enablers.length = triggers.length = 0;
      }
      return activity;
    }
    // enables this activity
    function enable() {
      validateDisposable(activity);
      if (!enabled) {
        bus.trace('enable', activity);
        enabled = true;
        notify();
      }
      return activity;
    }
    function ensure() {
      validateDisposable(activity);
      if (!ensured) {
        bus.trace('ensure', activity);
        ensured = true;
      }
      return activity;
    }
    // returns true if this activity has been disposed
    function getDisposed() {
      return disposed;
    }
    // returns true if this activity and all its parents are enabled
    function getEnabled() {
      return enabled && (!parent || parent.isEnabled);
    }
    // returns true if this activity is ensured
    function getEnsured() {
      return ensured;
    }
    function notify() {
      if (!enabled) return;
      if (parent && !parent.isEnabled) parent.onEnable(notify);
      else {
        each(enablers);
        enablers.length = 0;
      }
    }
    // registers callback to be invoked when this activity is being disposed
    // throws error if this activity was alredy disposed
    // callback must be a function
    function onDispose(callback) {
      validateCallback(callback);
      if (disposed) callback();
      else disposers.push(callback);
      return activity;
    }
    // registers callback to be invoked once when this activity is enabled
    // callback must be a function
    function onEnable(callback) {
      validateDisposable(activity);
      validateCallback(callback);
      if (getEnabled()) callback();
      else {
        if (!enablers.length && parent) parent.onEnable(notify);
        enablers.push(callback);
      }
      return activity;
    }
    // registers callback to be invoked when this activity is triggered
    // callback must be a function
    // fix: unstable trigger may fail others
    function onTrigger(callback) {
      validateDisposable(activity);
      validateCallback(callback);
      triggers.push(callback);
      return activity;
    }
    // triggers registered operations on this activity
    function trigger(data) {
      validateDisposable(activity);
      var message = new Message(data, activity);
      bus.trace('trigger', activity, message);
      if (getEnabled()) initiate();
      else if (message.headers.isEnsured) {
        if (!enablers.length && parent) parent.onEnable(initiate);
        enablers.push(initiate);
      }
      return activity;
      function initiate() {
        var index = 1, finishing = false;
        next();
        return activity;
        function next(state) {
          if (disposed) return;
          if (state & SKIP) index = 0;
          if (state & FINISH) finishing = true;
          if (isMessage(state)) message = state;
          if (index > 0) triggers[index >= triggers.length ? index = 0 : index++](message, next);
          else if (finishing) dispose();
        }
      }
    }
  }

  // creates new channel object
  function Channel(bus, name, parent) {
    var publications = [], retentions, retaining = 0, subscriptions = [];
    publications.indexes = _ObjectCreate(null);
    publications.slots = [];
    subscriptions.indexes = _ObjectCreate(null);
    subscriptions.slots = [];
    var channel = _ObjectDefineProperties(this, {
      attach: {value: attach},
      clear: {value: clear},
      detach: {value: detach},
      name: {enumerable: true, value: name},
      publications: {enumerable: true, get: getPublications},
      publish: {value: publish},
      retain: {value: retain},
      retaining: {enumerable: true, get: getRetaining},
      subscribe: {value: subscribe},
      subscriptions: {enumerable: true, get: getSubscriptions},
      unsubscribe: {value: unsubscribe}
    });
    if (parent) _ObjectDefineProperty(channel, 'parent', {enumerable: true, get: getParent});
    return Activity.call(channel, bus, parent).onDispose(dispose).onTrigger(trigger);
    // attaches operation to this channel
    function attach(operation) {
      if (isPublication(operation)) insert(publications);
      else if (isSubscription(operation)) {
        if (insert(subscriptions) && retaining) _setImmediate(deliver);
      }
      else throw new Error(MESSAGE_OPERATION);
      return channel;
      function deliver() {
        each(retentions, operation.trigger);
      }
      function insert(collection) {
        var index = collection.indexes[operation.id];
        if (isDefined(index)) return false;
        var slots = collection.slots;
        index = collection.indexes[operation.id] = slots.length ? slots.pop() : collection.length++;
        collection[index] = operation;
        operation.attach(channel);
        return true;
      }
    }
    function clear() {
      bus.trace('clear', channel);
      retentions = undefined;
      each(publications, detach);
      each(subscriptions, detach);
    }
    // detaches operation from this channel
    function detach(operation) {
      if (isPublication(operation)) remove(publications);
      else if (isSubscription(operation)) remove(subscriptions);
      else throw new Error(MESSAGE_OPERATION);
      return channel;
      function remove(collection) {
        var index = collection.indexes[operation.id];
        if (isUndefined(index)) return;
        collection.slots.push(index);
        collection[index] = undefined;
        delete collection.indexes[operation.id];
        operation.detach(channel);
      }
    }
    function dispose() {
      each(publications, detach);
      each(subscriptions, detach);
      publications = retentions = subscriptions = undefined;
    }
    // returns parent object of this activity
    function getParent() {
      return parent;
    }
    function getPublications() {
      return _ArraySlice.call(publications);
    }
    function getRetaining() {
      return retaining;
    }
    function getSubscriptions() {
      return _ArraySlice.call(subscriptions);
    }
    // publishes data to this channel immediately or creates new publication if no data present
    function publish(data) {
      return arguments.length
        ? channel.trigger(data)
        : new Publication(bus).attach(channel);
    }
    // activates or deactivates retaining of publications for this channel
    // when count is true this channel will retain 9e9 lastest publications
    // when count is a number this channel will retain corresponding number of lastest publications
    // when count is false or 0 this channel will not retain publications
    // all retained publications are authomatically delivered to all new subscriptions to this channel
    function retain(count) {
      if (!arguments.length || count === true) retaining = 9e9;
      else if (!count) {
        retaining = 0;
        retentions = undefined;
      }
      else {
        validateCount(count);
        retaining = count;
        if (retentions) retentions.splice(0, retentions.length - retaining);
      }
      bus.trace('retain', channel);
      return channel;
    }
    function trigger(message, next) {
      if (retaining) {
        if (retentions) retentions.push(message); 
        else retentions = [message];
        if (retaining < retentions.length) retentions.shift();
      }
      each(subscriptions, 'trigger', message);
      if (name !== ERROR && parent) parent.trigger(message);
      next();
    }
    // creates subscription to this channel
    // every subscriber must be a function
    function subscribe(subscriber1, subscriber2, subscriberN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      return new Subscription(bus, _ArraySlice.call(arguments)).attach(channel);
    }
    // unsubscribes all subscribers from all subscriptions to this channel
    function unsubscribe(subscriber1, subscriber2, subscriberN) {
      each(subscriptions, 'unsubscribe', _ArraySlice.call(arguments));
      return channel;
    }
  }

  // creates new domain object (group of channels)
  function Domain(bus, channels) {
    var domain = _ObjectDefineProperties(this, {
      disable: {value: disable},
      enable: {value: enable},
      ensure: {value: ensure},
      preserve: {value: preserve},
      publish: {value: publish},
      subscribe: {value: subscribe},
      unsubscribe: {value: unsubscribe}
    });
    return domain;
    function disable() {
      each(channels, 'disable');
      return domain;
    }
    function enable(value) {
      each(channels, 'enable', value);
      return domain;
    }
    function ensure(value) {
      each(channels, 'ensure', value);
      return domain;
    }
    function preserve(count) {
      each(channels, 'preserve', count);
      return domain;
    }
    // creates new publication to all channels in this domain
    function publish(data) {
      if (arguments.length) {
        each(channels, 'trigger', data);
        return domain;
      }
      else {
        var publication = new Publication(bus);
        each(channels, 'attach', publication);
        return publication;
      }
    }
    // creates subscription to all channels in this domain
    // every subscriber must be a function
    function subscribe(subscriber1, subscriber2, subscriberN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var subscription = new Subscription(bus, _ArraySlice.call(arguments));
      each(channels, 'attach', subscription);
      return subscription;
    }
    // unsubscribes all subscribers from all channels in this domain
    function unsubscribe(subscriber1, subscriber2, subscriberN) {
      each(channels, 'unsubscribe', _ArraySlice.call(arguments));
      return domain;
    }
  }
  // creates new message object
  function Message() {
    var data, channel, headers = _ObjectCreate(null), error;
    each(arguments, use);
    if (error) _ObjectDefineProperty(this, 'error', {enumerable: true, value: error});
    return _ObjectDefineProperties(this, {
      channel: {enumerable: true, value: channel},
      data: {enumerable: true, value: data},
      headers: {enumerable: true, value: headers}
    });
    function use(argument) {
      if (isChannel(argument)) {
        if (isUndefined(channel)) channel = argument.name;
        if (argument.isEnsured) headers.isEnsured = true;
      }
      else if (isFunction(argument)) data = argument();
      else if (isError(argument)) error = argument;
      else if (isMessage(argument)) {
        if (isUndefined(channel)) channel = argument.channel;
        data = argument.data;
        error = argument.error;
        _ObjectKeys(argument.headers).forEach(function (key) {
          headers[key] = argument.headers[key];
        });
      }
      else if (isPublication(argument) || isSubscription(argument)) {
        if (argument.isEnsured) headers.isEnsured = true;
      }
      else data = argument;
    }
  }
  // creates new operation object, abstract base for publications and subscriptions
  function Operation(bus, channels) {
    var operation = _ObjectDefineProperties(this, {
      after: {value: after},
      afterAll: {value: afterAll},
      afterAny: {value: afterAny},
      attach: {value: attach},
      before: {value: before},
      beforeAll: {value: beforeAll},
      beforeAny: {value: beforeAny},
      channels: {enumerable: true, get: getChannels},
      debounce: {value: debounce},
      delay: {value: delay},
      detach: {value: detach},
      filter: {value: filter},
      map: {value: map},
      once: {value: once},
      skip: {value: skip},
      take: {value: take},
      throttle: {value: throttle}
    });
    channels.indexes = {};
    return Activity.call(operation, bus).onDispose(dispose);
    // pospones this operation until condition happens then replays all preceeding publications
    // condition can be date, function, interval or channel name
    function after(condition) {
      if (1 !== arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var happened = false, predicate, recordings, timer;
      if (isString(condition)) operation.onDispose(bus(condition).subscribe(happen).once().dispose);
      else if (isFunction(condition)) predicate = condition;
      else {
        if (isDate(condition)) condition = condition.valueOf() - Date.now();
        else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
        if (condition > 0) timer = _setTimeout(happen, condition);
        else happened = true;
      }
      return happened ? operation : operation.onDispose(dispose).onTrigger(trigger);
      function dispose() {
        _clearTimeout(timer);
        predicate = recordings = undefined;
      }
      function happen() {
        happened = true;
        _setImmediate(each(recordings));
        dispose();
      }
      function trigger(message, next) {
        if (predicate && predicate()) happen();
        if (happened) next();
        else recordings ? recordings.push(next) : (recordings = [next]);
      }
    }
    // pospones this operation until all conditions happen then replays all preceeding publications
    // condition can be date, function, interval or channel name
    function afterAll(condition1, condition2, conditionN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var pending = 0, predicates, recordings, timers;
      if (1 < arguments.length) each(arguments, setup);
      else if (isArray(condition1)) each(condition1, setup);
      else setup(condition1);
      return pending ? operation.onDispose(dispose).onTrigger(trigger) : operation;
      function dispose() {
        each(timers, _clearTimeout);
        predicates = recordings = timers = undefined;
      }
      function happen() {
        if (--pending) return false;
        each(recordings);
        dispose();
        return true;
      }
      function setup(condition) {
        if (isString(condition)) operation.onDispose(bus(condition).subscribe(happen).once().dispose);
        else if (isFunction(condition)) predicates ? predicates.push(condition) : predicates = [condition];
        else {
          if (isDate(condition)) condition = condition.valueOf() - Date.now();
          else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
          if (condition < 0) return;
          var timer = _setTimeout(happen, condition);
          timers ? timers.push(timer) : (timers = [timer]);
        }
        pending++;
      }
      function trigger(message, next) {
        if (predicates) for (var i = 0, l = predicates.length; i < l; i++) {
          var predicate = predicates[i];
          if (!predicate || !predicate()) continue;
          if (happen()) break;
          predicates[i] = undefined;
        }
        if (pending) recordings ? recordings.push(next) : (recordings = [next]);
        else next();
      }
    }
    // pospones this operation until any of conditions happen then replays all preceeding publications
    // condition can be date, function, interval or channel name
    function afterAny(condition1, condition2, conditionN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var pending = true, predicates, recordings, subscriptions, timers;
      if (1 < arguments.length) each(arguments, setup);
      else if (isArray(condition1)) each(condition1, setup);
      else setup(condition1);
      return pending ? operation.onDispose(dispose).onTrigger(trigger) : operation;
      function dispose() {
        each(subscriptions, 'dispose');
        each(timers, _clearTimeout);
        predicates = recordings = subscriptions = timers = undefined;
      }
      function happen() {
        pending = false;
        each(recordings);
        dispose();
      }
      function setup(condition) {
        if (isString(condition)) {
          var subscription = bus(condition).subscribe(happen).once();
          subscriptions ? subscriptions.push(subscription) : (subscriptions = [subscription]);
        }
        else if (isFunction(condition)) predicates ? predicates.push(condition) : (predicates = [condition]);
        else {
          if (isDate(condition)) condition = condition.valueOf() - Date.now();
          else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
          if (condition < 0) {
            pending = false;
            return false;
          }
          var timer = _setTimeout(happen, condition);
          timers ? timers.push(timer) : (timers = [timer]);
        }
      }
      function trigger(message, next) {
        if (predicates) for (var i = -1, l = predicates.length; i < l; i++) {
          var predicate = predicates[i];
          if (!predicate || !predicate()) continue;
          happen();
          break;
        }
        if (pending) recordings ? recordings.push(next) : (recordings = [next]);
        else next();
      }
    }
    // attaches this operation to channel
    function attach(channel) {
      if (!isChannel(channel)) throw new Error(MESSAGE_CHANNEL);
      var index = channels.indexes[channel.name];
      if (isUndefined(index)) {
        bus.trace('attach', operation, channel);
        channels.indexes[channel.name] = channels.length;
        channels.push(channel);
        channel.attach(operation);
      }
      return operation;
    }
    // performs this operation until condition happen
    // condition can be date, function, interval or channel name
    function before(condition) {
      if (1 !== arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var predicate, timer;
      if (isString(condition)) operation.onDispose(bus(condition).subscribe(operation.dispose).once().dispose);
      else if (isFunction(condition)) predicate = condition;
      else {
        if (isDate(condition)) condition = condition.valueOf() - Date.now();
        else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
        if (condition < 0) return operation.dispose();
        timer = _setTimeout(operation.dispose, condition);
      }
      return operation.onDispose(dispose).onTrigger(trigger);
      function dispose() {
        _clearTimeout(timer);
        predicate = timer = undefined;
      }
      function trigger(message, next) {
        if (predicate && predicate()) operation.dispose();
        else next();
      }
    }
    function beforeAll(condition1, condition2, conditionN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var pending = 0, predicates, timers;
      if (1 < arguments.length) each(arguments, setup);
      else if (isArray(condition1)) each(condition1, setup);
      else setup(condition1);
      return pending ? operation.onDispose(dispose).onTrigger(trigger) : operation.dispose();
      function dispose() {
        each(timers, _clearTimeout);
        predicates = timers = undefined;
      }
      function happen() {
        if (pending--) return false;
        operation.dispose();
        return true;
      }
      function setup(condition) {
        if (isString(condition)) operation.onDispose(bus(condition).subscribe(happen).once().dispose);
        else if (isFunction(condition)) predicates ? predicates.push(condition) : (predicates = [condition]);
        else {
          if (isDate(condition)) condition = condition.valueOf() - Date.now();
          else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
          if (condition < 0) return;
          var timer = _setTimeout(happen, condition);
          timers ? timers.push(timer) : (timers = [timer]);
        }
        pending++;
      }
      function trigger(message, next) {
        if (predicates) for (var i = -1, l = predicates.length; i < l; i++) {
          var predicate = predicates[i];
          if (!predicate || !predicate()) continue;
          if (happen()) return;
          predicates[i] = undefined;
        }
        next();
      }
    }
    function beforeAny(condition1, condition2, conditionN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      var pending = false, predicates, subscriptions, timers;
      if (1 < arguments.length) each(arguments, setup);
      else if (isArray(condition1)) each(condition1, setup);
      else setup(condition1);
      return pending ? operation.onDispose(dispose).onTrigger(trigger) : operation.dispose();
      function dispose() {
        each(subscriptions, 'dispose');
        each(timers, _clearTimeout);
        predicates = timers = undefined;
      }
      function setup(condition) {
        if (isString(condition)) {
          var subscription = bus(condition).subscribe(operation.dispose).once();
          subscriptions ? subscriptions.push(subscription) : (subscriptions = [subscription]);
        }
        else if (isFunction(condition)) predicates ? predicates.push(condition) : (predicates = [condition]);
        else {
          if (isDate(condition)) condition = condition.valueOf() - Date.now();
          else if (!isNumber(condition)) throw new TypeError(MESSAGE_CONDITION);
          if (condition < 0) return;
          var timer = _setTimeout(operation.dispose, condition);
          timers ? timers.push(timer) : (timers = [timer]);
        }
        pending = true;
      }
      function trigger(message, next) {
        if (predicates) for (var i = -1, l = predicates.length; i < l; i++) if (predicates[i]) return operation.dispose();
        next();
      }
    }
    // performs this operation once within specified interval between invocation attempts
    // if postpone is true this operation will be invoked at the end of interval
    // otherwise this operation will be invoked at the beginning of interval
    // interval must be positive number
    function debounce(interval, postpone) {
      var timer;
      validateInterval(interval);
      return operation.onDispose(dispose).onTrigger(postpone
        ? triggerPostponed
        : triggerImmediate);
      function dispose() {
        _clearTimeout(timer);
      }
      function triggerImmediate(message, next) {
        if (timer) _clearTimeout(timer);
        else next();
        timer = _setTimeout(function() {
          timer = undefined;
        }, interval);
      }
      function triggerPostponed(message, next) {
        _clearTimeout(timer);
        timer = _setTimeout(function() {
          timer = undefined;
          next();
        }, interval);
      }
    }
    // delays this operation for specified interval
    // interval must be positive number
    function delay(interval) {
      validateInterval(interval);
      var slots = [], timers = [];
      operation.onDispose(dispose).onTrigger(trigger);
      return operation;
      function dispose() {
        each(timers, _clearTimeout);
        timers = undefined;
      }
      function trigger(message, next) {
        var index = slots.length ? slots.pop() : timers.length;
        timers[index] = _setTimeout(function() {
          slots.push(index);
          next();
        }, interval);
      }
    }
    function detach(channel) {
      if (!isChannel(channel)) throw new Error(MESSAGE_CHANNEL);
      var index = channels.indexes[channel.name];
      if (isDefined(index)) {
        bus.trace('detach', operation, channel);
        channels.splice(index, 1);
        delete channels.indexes[channel.name];
        channel.detach(operation);
        if (!channels.length) operation.dispose();
      }
      return operation;
    }
    function dispose() {
      each(channels, 'detach', operation);
    }
    // performs this operation only if callback returns trythy value
    function filter(callback) {
      validateCallback(callback);
      return operation.onTrigger(trigger);
      function trigger(message, next) {
        next(callback(message.data, message) ? CONTINUE : SKIP);
      }
    }
    // returns list of channels this operation attached to
    function getChannels() {
      return _ArraySlice.call(channels);
    }
    // transforms messages being published
    function map(callback) {
      validateCallback(callback);
      return operation.onTrigger(trigger);
      function trigger(message, next) {
        next(new Message(message, callback(message.data, message)));
      }
    }
    // performs this operation only once
    function once() {
      return take(1);
    }
    // skips specified count of attempts to trigger this operation
    function skip(count) {
      validateCount(count);
      return operation.onTrigger(trigger);
      function trigger(message, next) {
        next(--count < 0 ? CONTINUE : SKIP);
      }
    }
    // performs this operation only specified count of times then discards it
    function take(count) {
      validateCount(count);
      return operation.onTrigger(trigger);
      function trigger(message, next) {
        next(--count < 1 ? FINISH : CONTINUE);
      }
    }
    // performs this operation once within specified interval ignoring other attempts
    // interval must be positive number
    function throttle(interval) {
      validateInterval(interval);
      var timer;
      return operation.onDispose(dispose).onTrigger(trigger);
      function dispose() {
        _clearTimeout(timer);
      }
      function trigger(message, next) {
        if (!timer) timer = _setTimeout(function() {
          timer = undefined;
          next();
        }, interval);
      }
    }
  }

  // creates new publication object
  function Publication(bus) {
    var channels = [], strategy = strategies.simultaneously(), publication = _ObjectDefineProperties(this, {
      cyclically: {value: cyclically},
      randomly: {value: randomly},
      repeat: {value: repeat},
      simultaneously: {value: simultaneously},
      strategy: {enumerable: true, get: getStrategy, set: setStrategy}
    });
    return Operation.call(publication, bus, channels).onTrigger(trigger);
    function cyclically() {
      strategy = strategies.cyclically();
      return publication;
    }
    function getStrategy() {
      return strategy;
    }
    function randomly() {
      strategy = strategies.randomly();
      return publication;
    }
    // repeats this publication every interval with optional message
    // interval must be positive number
    // if message is function, it will be invoked each time
    function repeat(data, interval) {
      if (1 === arguments.length) interval = data;
      validateInterval(interval);
      interval = _setInterval(trigger, interval);
      return publication.onDispose(dispose);
      function dispose() {
        _clearInterval(interval);
      }
      function trigger() {
        publication.trigger(data);
      }
    }
    function simultaneously() {
      strategy = strategies.simultaneously();
      return publication;
    }
    function setStrategy(value) {
      var factory = strategies[value];
      if (!factory) throw new Error(MESSAGE_STRATEGY);
      strategy = factory();
    }
    function trigger(message, next) {
      each(strategy(channels), 'trigger', message);
      next();
    }
  }


  var strategies = {
    cyclically: function() {
      var index = -1;
      return function(items) {
        return [items[++index % items.length]];
      }
    },
    randomly: function() {
      return function(items) {
        return [items[Math.floor(items.length * Math.random())]];
      }
    },
    simultaneously: function() {
      return function(items) {
        return items;
      }
    }
  };

  // creates new subscription object
  function Subscription(bus, subscribers) {
    each(subscribers, validateSubscriber);
    var strategy = strategies.simultaneously(), subscription = _ObjectDefineProperties(this, {
      cyclically: {value: cyclically},
      randomly: {value: randomly},
      simultaneously: {value: simultaneously},
      subscribe: {value: subscribe},
      subscribers: {enumerable: true, get: getSubscribers},
      unsubscribe: {value: unsubscribe}
    });
    return Operation.call(subscription, bus, []).onDispose(dispose).onTrigger(trigger);
    function cyclically() {
      strategy = strategies.cyclically();
      return subscription;
    }
    function dispose() {
      subscribers.length = 0;
    }
    function getStrategy() {
      return strategy;
    }
    // returns clone of subscribers array
    function getSubscribers() {
      return _ArraySlice.call(subscribers);
    }
    function randomly() {
      strategy = strategies.randomly();
      return subscription;
    }
    function simultaneously() {
      strategy = strategies.simultaneously();
      return subscription;
    }
    function setStrategy(value) {
      var factory = strategies[value];
      if (!factory) throw new Error(MESSAGE_STRATEGY);
      strategy = factory();
    }
    function subscribe(subscriber1, subscriber2, subscriberN) {
      if (!arguments.length) throw new Error(MESSAGE_ARGUMENTS);
      each(arguments, validateSubscriber);
      subscribers.push.apply(subscribers, subscribers);
      return subscription;
    }
    function trigger(message, next) {
      each(strategy(subscribers), deliver);
      next();
      function deliver(subscriber) {
        if (isDefined(message.error)) subscriber(message.error, message);
        else try {
          subscriber(message.data, message);
        } catch(error) {
          bus.error.trigger(new Message(message, error));
        }
      }
    }
    // unsubscribes all specified subscribers from this subscription
    function unsubscribe(subscriber1, subscriber2, subscriberN) {
      each(arguments, function(subscriber) {
        var index = subscribers.indexOf(subscriber);
        if (-1 !== index) subscribers.splice(index, 1);
      });
      if (!subscribers.length) subscription.dispose();
    }
  }

  return aerobus;
}));