'use strict';

const
// class names
  CLASS_AEROBUS = 'Aerobus'
, CLASS_AEROBUS_CHANNEL = CLASS_AEROBUS + '.Channel'
, CLASS_AEROBUS_FORWARDING = CLASS_AEROBUS + '.Forwarding'
, CLASS_AEROBUS_ITERATOR = CLASS_AEROBUS + '.Iterator'
, CLASS_AEROBUS_MESSAGE = CLASS_AEROBUS + '.Message'
, CLASS_AEROBUS_SECTION = CLASS_AEROBUS + '.Section'
, CLASS_AEROBUS_SUBSCRIBER = CLASS_AEROBUS + '.Subscriber'
, CLASS_AEROBUS_SUBSCRIPTION = CLASS_AEROBUS + '.Subscription'
, CLASS_AEROBUS_UNSUBSCRIPTION = CLASS_AEROBUS + '.Unsubscription'
, CLASS_AEROBUS_WHEN = CLASS_AEROBUS + '.When'
, CLASS_ARRAY = 'Array'
, CLASS_BOOLEAN = 'Boolean'
, CLASS_FUNCTION = 'Function'
, CLASS_NUMBER = 'Number'
, CLASS_REGEXP = 'RegExp'
, CLASS_OBJECT = 'Object'
, CLASS_STRING = 'String'
// well-known symbols
, $CLASS = Symbol.toStringTag
, $ITERATOR = Symbol.iterator
, $PROTOTYPE = 'prototype'
// standard APIs shortcuts
, objectAssign = Object.assign
, objectCreate = Object.create
, objectDefineProperties = Object.defineProperties
, objectDefineProperty = Object.defineProperty
, objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
, objectGetOwnPropertyNames = Object.getOwnPropertyNames
, mathFloor = Math.floor
, mathMax = Math.max
, mathMin = Math.min
, mathRandom = Math.random
, maxSafeInteger = Number.MAX_SAFE_INTEGER
// utility functions
, isNothing = value => value == null
, isSomething = value => value != null
, extend = (target, source) => {
    if (isNothing(source)) return target;
    let names = objectGetOwnPropertyNames(source);
    for (let i = names.length - 1; i >= 0; i--){
      let name = names[i];
      if (name in target) continue;
      objectDefineProperty(target, name, objectGetOwnPropertyDescriptor(source, name));
    }
    return target;
  }
, finalize = (collection, error) => {
    for (let i = collection.length; i--;) {
      try {
        collection[i].done();
      }
      catch (e) {
        setImmediate(() => error(e));
      }
      collection[i] = null;
    }
  }
, classOf = value => Object.prototype.toString.call(value).slice(8, -1)
, classIs = className => value => classOf(value) === className
, isArray = classIs(CLASS_ARRAY)
, isFunction = classIs(CLASS_FUNCTION)
, isNumber = classIs(CLASS_NUMBER)
, isObject = classIs(CLASS_OBJECT)
, isString = classIs(CLASS_STRING)
, noop = () => {}
, truthy = () => true
// error builders
, errorArgumentNotValid = value =>
    new TypeError(`Argument of type "${classOf(value)}" is not expected.`)
, errorCallbackNotValid = value =>
    new TypeError(`Callback expected to be a function, not "${classOf(value)}".`)
, errorChannelExtensionNotValid = value =>
    new TypeError(`Channel class extensions expected to be an object, not "${value}".`)
, errorDelimiterNotValid = value =>
    new TypeError(`Delimiter expected to be not empty string, not "${value}".`)
, errorDependencyNotValid = () =>
    new TypeError(`Dependency expected to be a channel name.`)
, errorErrorNotValid = value =>
    new TypeError(`Error expected to be a function, not "${classOf(value)}".`)
, errorForwarderNotValid = () =>
    new TypeError(`Forwarder expected to be a function or a channel name.`)
, errorGearNotFound = value =>
    new Error(`This instance of "${classOf(value)}"" has been deleted.`)
, errorMessageExtensionNotValid = value =>
    new TypeError(`Message class extensions expected to be an object, not "${value}".`)
, errorNameNotValid = value =>
    new TypeError(`Name expected to be a string, not "${classOf(value)}".`)
, errorOrderNotValid = value =>
    new TypeError(`Order expected to be a number, not "${classOf(value)}".`)
, errorSectionExtensionNotValid = value =>
    new TypeError(`Section class extensions expected to be an object, not "${value}".`)
, errorSubscriberNotValid = () =>
    new TypeError(`Subscriber expected to be a function or an object having "next" and optional "done" methods.`)
, errorTraceNotValid = value =>
    new TypeError(`Trace expected to be a function, not "${classOf(value)}".`)
, errorWhenExtensionNotValid = value =>
  new TypeError(`When class extensions expected to be an object, not "${value}".`)
// shared storage, getter and setter for all private assets
, gears = new WeakMap
, getGear = key => {
    let gear = gears.get(key);
    if (isNothing(gear)) throw errorGearNotFound(key);
    return gear;
  }
, setGear = (key, gear) => {
    if (isSomething(gear)) gears.set(key, gear);
    else gears.delete(key, gear);
  }
;




/*
----------------------------------------------------------------------------------------------------
Private classes.
----------------------------------------------------------------------------------------------------
*/




// Internal representation of Aerobus as a map of the channels.
class BusGear {
  constructor(config) {
    this.bubbles = config.bubbles;
    this.channels = new Map;
    this.delimiter = config.delimiter;
    this.error = config.error;
    this.id = 0;
    /*
    this.patterns = [];
    */
    this.trace = config.trace;
    // extended classes used by this instance
    this.Channel = subclassChannel();
    extend(this.Channel[$PROTOTYPE], config.channel);
    this.Message = subclassMessage();
    extend(this.Message[$PROTOTYPE], config.message);
    this.Section = subclassSection();
    extend(this.Section[$PROTOTYPE], config.section);
    this.When = subclassWhen();
    extend(this.When[$PROTOTYPE], config.when);
  }
  // sets bubbles behavior
  bubble(value) {
    value = !!value;
    this.trace('bubble', value);
    this.bubbles = value;
  }
  // clears and removes all channels
  clear() {
    let channels = this.channels;
    for (let channel of channels.values())
      setGear(channel.clear(), null);
    channels.clear();
    this.patterns = [];
  }
  // gets a channel by its name
  get(name) {
    let channels = this.channels
      , channel = channels.get(name);
    // if channel already exists, just return it
    if (channel)
      return channel;
    // get root channel if name is empty string
    let Channel = this.Channel;
    if (name === '') {
      channel = new Channel(this, name);
      channels.set(name, channel);
      return channel;
    }
    // build channels hierarchy starting from root channel
    let parent = channels.get('')
      , delimiter = this.delimiter
      , parts = name.split(this.delimiter);
    if (!parent) {
      parent = new Channel(this, '');
      channels.set('', parent);
    }
    name = '';
    for (let i = -1, l = parts.length; ++i < l;) {
      name = name
        ? name + delimiter + parts[i]
        : parts[i];
      channel = channels.get(name);
      if (!channel) {
        channel = new Channel(this, name, parent);
        channels.set(name, channel);
      }
      parent = channel;
    }
    return channel;
  }
  // resolves a channel, pattern or section by several names
  resolve(names) {
    let arity = names.length;
    // if no names passed, get the root channel
    if (!arity)
      return this.get('');
    // if single string name is passed, get the corresponding channel
    if (arity === 1) {
      let name = names[0];
      if (classOf(name) === CLASS_STRING)
        return this.get(name);
    }
    // otherwise parse names and return section
    let Section = this.Section
      , channels
      , resolved = [];
    for (let i = -1, l = names.length; ++i < l;) {
      let name = names[i];
      switch (classOf(name)) {
        case CLASS_REGEXP:
          if (!channels)
            channels = Array.from(this.channels.values());
          for (let j = -1, m = channels.length; ++j < m;) {
            let channel = channels[j];
            if (name.test(channel.name))
              resolved.push(channel);
          }
          break;
        case CLASS_STRING:
          resolved.push(this.get(name));
          break;
        default:
          throw errorNameNotValid(name);
      }
    }
    return new Section(this, () => resolved);
  }
  // unsubscribe from all channels
  unsubscribe(unsubscription) {
    for (let channel of this.channels.values())
      getGear(channel).unsubscribe(unsubscription);
  }
}

// Internal representation of a channel as a publication/subscription destination.
class ChannelGear {
  constructor(bus, name, parent, trace) {
    this.bubbles = bus.bubbles;
    this.bus = bus;
    this.enabled = true;
    this.name = name;
    if (parent)
      this.parent = getGear(parent);
    this.trace = trace;
    trace('create');
  }
  // determine enabled state
  get isEnabled() {
    let parent = this.parent;
    return this.enabled && (!parent || parent.isEnabled);
  }
  // set bubbling behavior based on verity of 'value' argument
  bubble(value) {
    value = !!value;
    this.trace('bubble', value);
    this.bubbles = value;
  }
  // clear all observers, retentions and subscriptions
  clear() {
    this.trace('clear');
    let error = this.bus.error
      , observers = this.observers
      , retentions = this.retentions
      , subscribers = this.subscribers;
    // clear retentions
    if (retentions)
      retentions.length = 0;
    // finalize and clear observers
    if (observers) {
      finalize(observers, error);
      delete this.observers;
    }
    // finalize and clear subscribers
    if (subscribers) {
      finalize(subscribers, error);
      delete this.subscribers;
    }
  }
  // switch to 'cycle' publication strategy or disable publication strategy depending on 'limit' argument
  cycle(limit, step) {
    let cursor = 0;
    // normalize limit setting
    limit = isNumber(limit)
      ? limit > 0 ? limit : 0
      : limit ? 1 : 0;
    // normalize step setting
    step = isNumber(step) && 0 < step
      ? step
      : limit;
    this.trace('cycle', limit, step);
    // disable publication strategy if limit is zero
    if (!limit) delete this.strategy;
    // otherwise set strategy to cycle implementation
    else this.strategy = subscribers => {
      let length = subscribers.length;
      // return empty array if no subsribers are present
      if (!length)
        return [];
      // otherwise compute number of subscribers to select
      let count = mathMin(limit, length)
        , i = cursor
        , selected = Array(count);
      // select next range of subscribers
      while (count-- > 0)
        selected[i] = subscribers[i++ % length];
      // advance cursor
      cursor += step;
      // return selected subscribers
      return selected;
    };
  }
  // set enabled state based on verity of 'value' argument
  enable(value) {
    value = !!value;
    this.trace('enable', value);
    this.enabled = value;
  }
  // append forwarding rules
  forward(forwarding) {
    let collection = this.forwarders
      , forwarders = forwarding.forwarders;
    this.trace('forward', forwarders);
    if (collection)
      collection.push(...forwarders);
    else this.forwarders = forwarders.slice();
  }
  // append observer
  observe(observer) {
    let existing = this.observers;
    this.observers = existing
      ? existing.concat(observer)
      : [observer];
  }
  // publish a message
  publish(message, callback) {
    if (!this.isEnabled) return;
    let Message = this.bus.Message
      , observers = this.observers
      , skip = false;
    // if message is an instance of Message class
    message = classOf(message) === CLASS_AEROBUS_MESSAGE
      // then clone it and append this channel name to routes
      ? new Message(message.data, message.id, [this.name].concat(message.route))
      // otherwise create new instance of Message class
      : new Message(message, ++this.bus.id, [this.name]);
    this.trace('publish', message);
    // notify all observers with message
    if (observers)
      for (let i = -1, l = observers.length; ++i < l;) {
        let observer = observers[i];
        if (observer)
          observer.next(message);
      }

    if (!message.route.includes(this.name, 1)) {
      let forwarders = this.forwarders;
      if (forwarders) {
        let destinations = new Set;
        skip = true;
        for (let i = -1, l = forwarders.length; ++i < l;) {
          let forwarder = forwarders[i]
            , names = isFunction(forwarder)
              ? forwarder(message.data, message)
              : forwarder;
          if (isArray(names))
            for (let j = -1, m = names.length; ++j < m;) {
              let name = names[j];
              if (isNothing(name) || this.name === name)
                skip = false;
              else if (isString(name))
                destinations.add(name);
              else throw errorNameNotValid(name);
            }
          else if (isNothing(names) || this.name === names)
            skip = false;
          else if (isString(names))
            destinations.add(names);
          else throw errorNameNotValid(names);
        }
        for (let destination of destinations) {
          let result = getGear(this.bus.get(destination)).publish(message, callback);
          if (result === message.cancel)
            return result;
        }
      }
    }

    if (skip) return;

    let retentions = this.retentions;
    if (retentions) {
      retentions.push(message);
      if (retentions.length > retentions.limit)
        retentions.shift();
    }

    if (this.bubbles) {
      let parent = this.parent;
      if (parent) {
        let result = parent.publish(message, callback);
        if (result === message.cancel)
          return result;
      }
    }

    let subscribers = this.subscribers;
    if (!subscribers) return;
    let strategy = this.strategy;
    if (strategy) subscribers = strategy(subscribers);
    for (let i = -1, l = subscribers.length; ++i < l;) {
      let subscriber = subscribers[i];
      if (subscriber)
        try {
          let result = subscriber.next(message.data, message);
          if (result === message.cancel)
            return result;
          callback(result);
        }
        catch(error) {
          callback(error);
          setImmediate(() => this.bus.error(error, message));
        }
    }
  }

  reset() {
    this.trace('reset');
    let error = this.bus.error
      , observers = this.observers
      , subscribers = this.subscribers;
    // reset all properties
    this.enabled = true;
    delete this.forwarders;
    delete this.observers;
    delete this.plans;
    delete this.retentions;
    delete this.strategy;
    delete this.subscribers;
    delete this.subscriptions;
    // finalize observers
    if (observers)
      finalize(observers, error);
    // finalize subscribers
    if (subscribers)
      finalize(subscribers, error);
  }
  // enable or disable retention policy depending on 'limit' argument
  retain(limit) {
    // normalize limit setting
    limit = isNumber(limit)
      ? mathMax(limit, 0)
      : limit
        ? maxSafeInteger
        : 0;
    this.trace('retain', limit);
    // if limit is greater than zero, enable policy
    if (limit) {
      let collection = this.retentions;
      // if policy is already enabled
      if (collection) {
        // trim retentions to limit
        if (collection.length > limit)
          collection = this.retentions = collection.slice(collection.length - limit);
        // set new limit
        collection.limit = limit;
      }
      // or enable policy
      else {
        this.retentions = [];
        this.retentions.limit = limit;
      }
    }
    // otherwise delete retentions collection to disable policy
    else delete this.retentions;
  }
  // switch to 'shuffle' publication strategy or disable publication strategy depending on 'limit' argument
  shuffle(limit) {
    // normalize limit setting
    limit = isNumber(limit)
      ? limit > 0 ? limit : 0
      : limit ? 1 : 0;
    this.trace('shuffle', limit);
    // if limit is zero
    if (!limit)
      // disable strategy
      delete this.strategy;
    // // otherwise set strategy to shuffle implementation
    else this.strategy = subscribers => {
      // return empty array if no subsribers are present
      let length = subscribers.length;
      if (!length)
        return [];
      // else compute number of subscribers to select
      let count = mathMin(limit, length)
        , selected = Array(count);
      // randomly select computed number of unique subscribers
      do {
        let candidate = subscribers[mathFloor(mathRandom() * length)];
        if (!selected.includes(candidate))
          selected[--count] = candidate;
      }
      while (count > 0);
      // return selected subscribers
      return selected;
    };
  }

  subscribe(subscription) {
    this.trace('subscribe', subscription.parameters);

    let collection = this.subscribers
      , retentions = this.retentions
      , subscribers = subscription.subscribers;

    if (collection)
      for (let i = -1, l = subscribers.length; ++i < l;) {
        let subscriber = subscribers[i]
          , last = collection.length - 1;

        if (collection[last].order <= subscriber.order)
          collection.push(subscriber);
        else {
          while (last > 0 && collection[last] > subscriber.order)
            last--;
          collection.splice(last, 0, subscriber);
        }
      }
    else this.subscribers = subscribers.slice();

    if (retentions)
      for (let i = -1, l = subscribers.length; ++i < l;) {
        let subscriber = subscribers[i];
        for (let j = -1, m = retentions.length; ++j < m;) {
          let retention = retentions[j];
          try {
            subscriber.next(retention.data, retention);
          }
          catch(error) {
            setImmediate(() => this.bus.error(error, retention));
          }
        }
      }
  }

  toggle() {
    this.trace('toggle');
    this.enabled = !this.enabled;
  }

  unobserve(observer) {
    let existing = this.observers
      , excepted = [];
    if (existing)
      for (let j = existing.length; --j;) {
        let candidate = existing[j];
        if (observer === candidate) existing[j] = null;
        else excepted.push(observer);
      }
    if (excepted.length) this.observers = excepted;
    else delete this.observers;
  }

  unsubscribe(unsubscription) {
    this.trace('unsubscribe', unsubscription.parameters);
    let collection = this.subscribers
      , predicates = unsubscription.predicates;
    if (!collection)
      return;

    if (predicates.length) {
      let unsubscribed = 0;
      for (let i = collection.length; i--;) {
        let subscriber = collection[i];
        if (subscriber) for (let j = predicates.length; j--;)
          if (predicates[j](subscriber)) {
            collection[i] = null;
            unsubscribed++;
            try {
              subscriber.done();
            }
            catch (error) {
              setImmediate(() => this.bus.error(error));
            }
            break;
          }
      }

      if (unsubscribed < collection.length) {
        let subscribers = [];
        for (let i = collection.length; i--;) {
          let subscriber = collection[i];
          if (subscriber) subscribers.push(subscriber);
        }
        this.subscribers = subscribers;
      }
      else delete this.subscribers;
    }
    else {
      for (let i = collection.length; i--;)
        try {
          collection[i].done();
        }
        catch (error) {
          setImmediate(() => this.bus.error(error));
        }
      delete this.subscribers;
    }
  }
}

// Internal representation of a forwarding as a rule set.
class Forwarding {
  // parses parameters as forwarding rules and wraps to new instance of Forwarding class
  constructor(parameters) {
    let forwarders = [];
    // iterate all parameters
    for (let i = -1, l = parameters.length; ++i < l;) {
      let parameter = parameters[i];
      // depending on class of parameter
      switch (classOf(parameter)) {
        // if parameter is instance of Forwarding class
        case CLASS_AEROBUS_FORWARDING:
          // just copy its rules
          forwarders.push(...parameter.forwarders);
          break;
        // if parameter is function or string
        case CLASS_FUNCTION: case CLASS_STRING:
          // append it to rules
          forwarders.push(parameter);
          break;
        // class of parameter is unexpected, throw
        default:
          throw errorArgumentNotValid(parameter);
      }
    }
    // if no forwarding rules found, throw
    if (!forwarders.length)
      throw errorForwarderNotValid();
    // define read-only field on this object to keep array of rules
    objectDefineProperty(this, 'forwarders', { value: forwarders });
  }
}
// set the name of Forwarding class
objectDefineProperty(Forwarding[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_FORWARDING });

// represents iterator internally as an observer of several channels
class IteratorGear {
  // create new instance of iterator and attach it to all the observables provided
  constructor(observables) {
    this.disposed = false;
    this.messages = [];
    this.rejects = [];
    this.resolves = [];
    // implement observer interface with reference count to guarantee the done method is invoked once
    let count = 0
      , observer = {
          done: () => {
            // if reference count is less than iterable count, await
            if (++count < observables.length) return;
            // otherwise mark this iterator as done
            this.disposed = true;
            // and reject all pending promises
            this.rejects.forEach(reject => reject());
          }
        , next: message => {
            // if there are pending promises, resolve first of them
            if (this.resolves.length) this.resolves.shift()(message);
            // otherwise keep message to resolve it later
            else this.messages.push(message);
          }
        };
    // create disposer implementation to detach observer from all the observables
    this.disposer = () => {
      for (let i = observables.length; i--;)
        getGear(observables[i]).unobserve(observer);
    };
    // attach new observer to all observables
    for (let i = observables.length; i--;)
      getGear(observables[i]).observe(observer);
  }
  // stop iteration
  done() {
    // avoid repetitive calls
    if (this.disposed)
      return;
    this.disposed = true;
    // reject all pending promises
    let rejects = this.rejects;
    for (let i = rejects.length; i--;)
      rejects[i]();
    // invoke disposer implementation
    this.disposer();
  }
  // iterate to the next message, already published or expected to be published
  next() {
    // check if iteration has been compelete
    if (this.disposed)
      return {done: true };
    // if there is a published message
    if (this.messages.length)
      // return resolved promise
      return { value: Promise.resolve(this.messages.shift()) };
    // otherwise return pending promise
    return { value: new Promise((resolve, reject) => {
      this.rejects.push(reject);
      this.resolves.push(resolve);
    }) };
  }
}

// Internal representation of a replay as a recording of operations over channel/section.
class Replay {
  constructor() {
    this.recordings = [];
  }
  bubble(value) {
    this.recordings.push(['bubble', value]);
  }
  clear() {
    this.recordings.push(['clear']);
  }
  enable(value = true) {
    this.recordings.push(['enable', value]);
  }
  forward(forwarding) {
    this.recordings.push(['forward', forwarding]);
  }
  publish(data, callback) {
    this.recordings.push(['publish', data, callback]);
  }
  replay(targets) {
    let recordings = this.recordings;
    for (let i = -1, l = recordings.length; ++i < l;) {
      let [method, ...parameters] = recordings[i];
      for (let j = -1, m = targets.length; ++j < m;)
        getGear(targets[j])[method](...parameters);
    }
  }
  reset() {
    this.recordings.push(['reset']);
  }
  retain(limit) {
    this.recordings.push(['retain', limit]);
  }
  subscribe(subscription) {
    this.recordings.push(['subscribe', subscription]);
  }
  toggle() {
    this.recordings.push(['toggle']);
  }
  unsubscribe(unsubscription) {
    this.recordings.push(['unsubscribe', unsubscription]);
  }
}

// Internal representation of a pattern as a replay.
/*
class Pattern extends Replay {
  constructor(regex) {
    super();
    this.regex = regex;
  }
}
*/

// Internal representation of a section as a union of channels.
class SectionGear {
  constructor(bus, resolver) {
    this.bus = bus;
    this.resolver = resolver;
  }
  bubble(value) {
    this.each(channel => channel.bubble(value));
  }
  clear() {
    this.each(channel => channel.clear());
  }
  each(callback) {
    let channels = this.resolver();
    for (let i = -1, l = channels.length; ++i < l;)
      callback(getGear(channels[i]));
  }
  enable(value = true) {
    this.each(channel => channel.enable(value));
  }
  forward(forwarding) {
    this.each(channel => channel.forward(forwarding));
  }
  publish(data, callback) {
    this.each(channel => channel.publish(data, callback));
  }
  reset() {
    this.each(channel => channel.reset());
  }
  retain(limit) {
    this.each(channel => channel.retain(limit));
  }
  subscribe(subscription) {
    this.each(channel => channel.subscribe(subscription));
  }
  toggle() {
    this.each(channel => channel.toggle());
  }
  unsubscribe(unsubscription) {
    this.each(channel => channel.unsubscribe(unsubscription));
  }
}

// Internal representation of a subscriber as a set of related fields.
class Subscriber {
  // validates parameters and wraps to new instance of Subscriber class
  constructor(base, name, order) {
    let done, next;
    // if base is function, use it as subscriber without done callback implementation
    if (isFunction(base)) {
      done = noop;
      next = base;
    }
    // if base is instance of Subscriber class, just copy its fields
    else if (classOf(base) === CLASS_AEROBUS_SUBSCRIBER) {
      done = base.done;
      next = base.next;
      if (isNothing(name))
        name = base.name;
      if (isNothing(order))
        order = base.order;
    }
    // if base is object containing 'next' method
    else if (isObject(base) && isFunction(base.next)) {
      // wrap its 'next' method to the arrow function to preserve calling context
      next = (data, message) => base.next(data, message);
      // if object contains 'done' field
      if (isSomething(base.done))
        // and 'done' is a function
        if (isFunction(base.done)) {
          let disposed = false;
          // wrap its 'done' method to the arrow function to preserve calling context
          // and guarantee it is called once
          done = () => {
            if (disposed) return;
            disposed = true;
            base.done();
          };
        }
        // otherwise throw
        else throw errorSubscriberNotValid(base);
      // if object does not contain 'done' field, fake it
      else done = noop;
      // if name parameter is undefined and object contains 'name' field
      if (isNothing(name) && isSomething(base.name))
        // and 'name' is string
        if (isString(base.name))
          // use it as subscriber's name
          name = base.name;
        // otherwise throw
        else throw errorNameNotValid(base.name);
      // if order parameter is undefined and object contains 'order' field
      if (isNothing(order) && isSomething(base.order))
        // and 'order' is number
        if (isNumber(base.order))
          // use it as subscriber's order
          order = base.order;
        // otherwise throw
        else throw errorOrderNotValid(base.order);
    }
    // class of base is unexpected, throw
    else throw errorSubscriberNotValid(base);
    // if order is undefined, default it
    if (isNothing(order))
      order = 0;
    // define read-only fields on this object to keep parsed parameters
    objectDefineProperties(this, {
      base: { value: base }
    , done: { value: done }
    , next: { value: next }
    , order: { value: order }
    });
    // define read-only field on this object to keep parsed name if it is defined
    if (isSomething(name))
      objectDefineProperty(this, 'name', { value: name });
  }
}
// set the name of Subscriber class
objectDefineProperty(Subscriber[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_SUBSCRIBER });

// Internal representation of a subscription as a set of subscribers.
class Subscription {
  // parses parameters as subscribers and wraps to the new instance of the Subscription class
  constructor(parameters) {
    let builders = []
      , name
      , order;
    // iterate all parameters
    for (let i = -1, l = parameters.length; ++i < l;) {
      let parameter = parameters[i];
      // depending on the class of the parameter
      switch (classOf(parameter)) {
        // if parameter is a function, an object or an instance of the Subscriber class
        case CLASS_FUNCTION: case CLASS_OBJECT: case CLASS_AEROBUS_SUBSCRIBER:
          // create deferred builder to call it after all common parameters are parsed
          builders.push(() => new Subscriber(parameter, name, order));
          break;
        // if parameter is a number, use it as the common order
        case CLASS_NUMBER:
          order = parameter;
          break;
        // if parameter is a number, use it as the common name
        case CLASS_STRING:
          name = parameter;
          break;
        // the class of the parameter is unexpected, throw
        default:
          throw errorArgumentNotValid(parameter);
      }
    }
    // if no builder has been created, throw
    if (!builders.length)
      throw errorSubscriberNotValid();
    // define read-only fields on this object to keep arrays of original parameters and parsed subscribers
    objectDefineProperties(this, {
      parameters: { value: parameters }
    , subscribers: { value: builders.map(builder => builder()) }
    });
  }
}
// set the name of the Subscription class
objectDefineProperty(Subscription[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_SUBSCRIPTION });

// Internal representation of an unsubscription as a set of predicates to match subscribers with.
class Unsubscription {
  // parses parameters as predicates and wraps to the new instance of the Unsubscription class
  constructor(parameters) {
    let predicates = [];
    // iterate all parameters
    for (let i = -1, l = parameters.length; ++i < l;) {
      // depending on the class of the parameter
      let parameter = parameters[i];
      switch (classOf(parameter)) {
        // if parameter is an instance of the Subscriber class
        case CLASS_AEROBUS_SUBSCRIBER:
          // create predicate matching a subscriber with parameter
          predicates.push(subscriber => subscriber === parameter);
          break;
        // if parameter is a function or an object
        case CLASS_FUNCTION: case CLASS_OBJECT:
          // create predicate matching subscriber's base with parameter
          predicates.push(subscriber => subscriber.base === parameter);
          break;
        // if parameter is a string
        case CLASS_STRING:
          // create predicate matching subscriber's name with parameter
          predicates.push(subscriber => subscriber.name === parameter);
          break;
        // the class of the parameter is unexpected, throw
        default:
          throw errorArgumentNotValid(parameter);
      }
    }
    // define read-only fields on this object to keep arrays of original parameters and parsed predicates
    objectDefineProperties(this, {
      parameters: { value: parameters }
    , predicates: { value: predicates }
    });
  }
}
// set the name of the Unsubscription class
objectDefineProperty(Unsubscription[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_UNSUBSCRIPTION });

class WhenGear extends Replay {
  constructor(bus, parameters, targets) {
    super();
    this.condition = truthy;
    this.sources = [];
    this.targets = targets;
    for (let i = -1, l = parameters.length; ++i < l;) {
      let parameter = parameters[i];
      switch(classOf(parameter)) {
        case CLASS_FUNCTION:
          this.condition = parameter;
          break;
        case CLASS_STRING:
          this.sources.push(parameter);
          break;
        default:
          throw errorArgumentNotValid(parameter);
      }
    }
    switch (this.sources.length) {
      case 0: throw errorDependencyNotValid();
      case 1:
        this.observer = {
          done: noop
        , next: message => {
            if (this.condition(message)) this.replay(this.targets);
          }
        };
        (this.sources[0] = getGear(bus.get(this.sources[0]))).observe(this.observer);
        break;
      default:
        this.counters = new Map;
        this.observer = {
          done: noop
        , next: message => {
            if (!this.condition(message)) return;
            let destination = message.destination
              , counter = this.counters.get(destination) + 1;
            this.counters.set(destination, counter);
            for (let i = -1, l = this.counters.length; ++i < l;)
              if (this.counters[i] !== counter) return;
            this.replay(this.targets);
          }
        };
        for (let i = this.sources.length - 1; i >= 0; i--)
          (this.sources[i] = getGear(bus.get(this.sources[i]))).observe(this.observer);
        break;
    }
  }
  done() {
    for (let i = this.dependencies.length; i--;)
      this.dependencies[i].unobserve(this.observer);
  }
}



/*
----------------------------------------------------------------------------------------------------
Public classes.
----------------------------------------------------------------------------------------------------
*/



/**
 * Common public api for channels and sections.
 */
class Common {
  /**
   * Depending on value enables or disables publications bubbling for the related channel(s).
   *  If bubbling is enabled, the channel first delivers each publication to the parent channel
   *  and only then notifies own subscribers.
   * @param {boolean} [value]
   *  Omit or pass thruthy value to enable bubbling; falsey to disable.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  bubble(value = true) {
    getGear(this).bubble(value);
    return this;
  }

  /**
   * Empties related channel(s).
   *  Removes all #retentions and #subscribers.
   *  Keeps #forwarders as well as #enabled and #bubbles settings.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  clear() {
    getGear(this).clear();
    return this;
  }

  /**
   * Switches related channel(s) to use 'cycle' delivery strategy.
   *  Every publication will be delivered to the provided number of subscribers in rotation manner.
   * @param {number} [limit=1]
   *  The number of subsequent subscribers receiving next publication.
   * @param {number} [step=1]
   *  The number of subsequent subscribers to step over after each publication.
   *  If step is less than number, subscribers selected for delivery will overlap.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  cycle(limit = 1, step = 1) {
    getGear(this).cycle(limit, step);
    return this;
  }

  /**
   * Depending on provided value enables or disables related channel(s).
   *  Disabled channel supresses all future publications.
   * @param {boolean} [value]
   *  Omit or pass truthy value to enable; falsey to disable.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  enable(value = true) {
    getGear(this).enable(value);
    return this;
  }

  /**
   * Adds provided forwarders to the related channel(s).
   *  Forwarded message is not published to the channel
   *  unless any of forwarders resolves false/null/undefined value
   *  or explicit name of this channel.
   *  To eliminate infinite forwarding, channel will not forward any publication
   *  which already have traversed this channel.
   * @param {...function|string} [parameters]
   *  The name of destination channel;
   *  and/or the function resolving destination channel's name/array of names;
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If any forwarder has value other than false/function/null/string/undefined.
   *  If this object has been deleted.
   */
  forward(...parameters) {
    getGear(this).forward(new Forwarding(parameters));
    return this;
  }

  /**
   * Publishes message to the related channel(s).
   *  Bubbles publication to ancestor channels,
   *  then notifies own subscribers within try block.
   *  Any error thrown by a subscriber will be forwarded to the #bus.error callback.
   *  Subsequent subscribers are still notified even if preceeding subscriber throws.
   * @param {any} [data]
   *  The data to publish.
   * @param {function} [callback]
   *  Optional callback to invoke after publication has been delivered with single argument:
   *  array of results returned from all notified subscribers of all channels this publication was delivered to.
   *  When provided, forces message bus to use request/response pattern instead of publish/subscribe.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If callback is defined but is not a function.
   *  If this object has been deleted.
   */
  publish(data, callback) {
    if (isSomething(callback)) {
      if (!isFunction(callback))
        throw errorCallbackNotValid(callback);
      let results = [];
      getGear(this).publish(data, result => results.push(result));
      callback(results);
    }
    else getGear(this).publish(data, noop);
    return this;
  }

  /**
   * Resets related channel(s).
   *  Removes all #retentions and #subscriptions.
   *  Sets #bubbles and #enabled, resets #retentions.limit.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  reset() {
    getGear(this).reset();
    return this;
  }

  /**
   * Enables or disables retention policy for the related channel(s).
   *  Retention is a publication persisted in a channel
   *  and used to notify future subscribers right after their subscription.
   * @param {number} [limit]
   *  Number of retentions to persist (FIFO - first in, first out).
   *  When omitted or truthy, the channel retains all publications.
   *  When falsey, all retentions are removed and the channel stops retaining publications.
   *  Otherwise the channel retains at most provided limit of publications.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  retain(limit = maxSafeInteger) {
    getGear(this).retain(limit);
    return this;
  }

  /**
   * Switches related channel(s) to use 'shuffle' delivery strategy.
   *  Every publication will be delivered to the provided number of randomly selected subscribers
   *  in each related channel.
   * @param {number} [limit=1]
   *  The number of randomly selected subscribers per channel receiving next publication.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  shuffle(limit = 1) {
    getGear(this).shuffle(limit);
    return this;
  }

  /**
   * Subscribes all provided subscribers to the related channel(s).
   *  If there are messages retained in a channel,
   *  every subscriber will be immediately notified with all retentions.
   * @param {...function|number|object|string} [parameters]
   *  Subscriber function;
   *  and/or numeric order for all provided subscribers/observers (0 by default);
   *  and/or iterator/observer object implemeting "next" and optional "done" methods;
   *  and/or string name for all provided subscribers/observers.
   *  Subscribers with greater order are invoked later.
   *  All named subscribers can be unsubscribed at once by their name.
   *  The "next" method of an iterator/observer object is invoked
   *  for each publication being delivered with one argument: published message.
   *  The optional "done" method of an iterator/observer object is invoked
   *  once when it is being unsubscribed from the related channel(s).
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  subscribe(...parameters) {
    getGear(this).subscribe(new Subscription(parameters));
    return this;
  }

  /**
   * Toggles the enabled state of the related channel(s).
   *  Disables the enabled channel and vice versa.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  toggle() {
    getGear(this).toggle();
    return this;
  }

  /**
   * Unsubscribes provided subscribers/names or all subscribers from the related channel(s).
   * @param {...function|string|Subscriber} [parameters]
   *  Subscribers and/or subscriber names to unsubscribe.
   *  If not specified, unsubscribes all subscribers.
   * @returns {Channel|Section}
   *  This object.
   * @throws
   *  If this object has been deleted.
   */
  unsubscribe(...parameters) {
    getGear(this).unsubscribe(new Unsubscription(parameters));
    return this;
  }
}

/**
 * Iterator class.
 */
class Iterator {
  constructor(observables) {
    setGear(this, new IteratorGear(observables));
  }

  /**
   * Ends iteration of this channel/section and closes the iterator.
   */
  done() {
    getGear(this).done();
  }

  /**
   * Produces next message has been published or going to be published to this channel/section.
   * @returns {object}
   *  Object containing whether 'done' or 'value' properties.
   *  The 'value' property returns a Promise resolving to the next message.
   *  The 'done' property returns true if the iteration has been ended with #done method call
   *  or owning bus/channel/section clearance/reseting.
   */
  next() {
    return getGear(this).next();
  }
}
objectDefineProperty(Iterator[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_ITERATOR });

/**
 * Channel class.
 * @alias Channel
 * @extends Common
 * @property {boolean} bubbles
 *  Gets the bubbling state if this channel.
 * @property {Aerobus} bus
 *  Gets the bus instance owning this channel.
 * @property {boolean} enabled
 *  Gets the enabled state of this channel.
 * @property {string} name
 *  Gets the name if this channel (empty string for root channel).
 * @property {Channel} [parent]
 *  Gets the parent channel (undefined for root channel).
 * @property {array} retentions
 *  Gets the list of retentions kept by this channel.
 * @property {array} subscribers
 *  Gets the list of subscribers to this channel.
 */
class ChannelBase extends Common {
  constructor(bus, name, parent) {
    super();
    objectDefineProperty(this, 'name', { value: name, enumerable: true });
    if (isSomething(parent))
      objectDefineProperty(this, 'parent', { value: parent, enumerable: true });
    let trace = (event, ...args) => bus.trace(event, this, ...args);
    setGear(this, new ChannelGear(bus, name, parent, trace));
    /*
    let patterns = bus.patterns;
    if (patterns.length) {
      let replayee = [this];
      for (let i = - 1, l = patterns.length; ++i < l;) {
        let pattern = patterns[i];
        if (pattern.regex.test(name))
          pattern.replay(replayee);
      }
    }
    */
  }
  get bubbles() {
    return getGear(this).bubbles;
  }
  get enabled() {
    return getGear(this).isEnabled;
  }
  get forwarders() {
    let gear = getGear(this)
      , forwarders = gear.forwarders;
    return forwarders
      ? forwarders.slice()
      : [];
  }
  get retentions() {
    let retentions = getGear(this).retentions
      , result = [];
    if (retentions) {
       result.push(...retentions);
       result.limit = retentions.limit;
    }
    else result.limit = 0;
    return result;
  }
  get subscribers() {
    let gear = getGear(this)
      , subscribers = gear.subscribers;
    return subscribers
      ? subscribers.filter(isSomething)
      : [];
  }
  when(parameters) {
    let gear = getGear(this)
      , bus = gear.bus
      , When = bus.When;
    return new When(bus, parameters, [this]);
  }

  /**
   * Returns async iterator for this channel.
   *  Async iterator returns promises resolving to messages being published.
   * @alias Channel#@@iterator
   * @returns {Iterator}
   *  New instance of the Iterator class.
   */
  [$ITERATOR]() {
    return new Iterator([this]);
  }
}
objectDefineProperty(ChannelBase[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_CHANNEL });
function subclassChannel() {
  return class Channel extends ChannelBase {
    constructor(bus, name, parent) {
      super(bus, name, parent);
    }
  }
}

/**
 * Message class.
 * @alias Message
 * @property {any} data
 *  The published data.
 * @property {string} destination
 *  The channel name this message is directed to.
 * @property {array} route
 *  The array of channel names this message has traversed.
 */
class MessageBase {
  constructor(data, id, route) {
    objectDefineProperties(this, {
      data: { value: data, enumerable: true }
    , destination: { value: route[0], enumerable: true }
    , id: { value: id, enumerable: true }
    , route: { value: route, enumerable: true }
    });
  }
}
objectDefineProperties(MessageBase[$PROTOTYPE], {
  [$CLASS]: { value : CLASS_AEROBUS_MESSAGE }
, cancel: { value: objectCreate(null) }
});
function subclassMessage() {
  return class Message extends MessageBase {
    constructor(data, id, route) {
      super(data, id, route);
    }
  }
}

/**
 * Section class.
 * @alias Section
 * @extends Common
 * @property {Array} channels
 *  The array of channels this section relates.
 */
class SectionBase extends Common {
  constructor(bus, resolver) {
    super();
    setGear(this, new SectionGear(bus, resolver));
  }
  get channels() {
    return [...getGear(this).resolver()];
  }
  when(parameters) {
    let gear = getGear(this)
      , bus = gear.bus
      , When = bus.When;
    return new When(bus, parameters, gear.channels);
  }
  /**
   * Returns an async iterator for this section.
   *  The iterator will iterate publications made to all related channels after the iteration start
   *  unless all channels are cleared or iterator is #done().
   * @alias Section#@@iterator
   * @returns {Iterator}
   *  The new instance of the Iterator class.
   */
  [$ITERATOR]() {
    return new Iterator(getGear(this).resolver());
  }
}
objectDefineProperty(SectionBase[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_SECTION });
function subclassSection() {
  return class Section extends SectionBase {
    constructor(bus, binder) {
      super(bus, binder);
    }
  }
}

class WhenBase extends Common {
  constructor(bus, parameters, targets) {
    super();
    setGear(this, new WhenGear(bus, parameters, targets));
  }
  get condition() {
    return getGear(this).condition;
  }
  get sources() {
    return [...getGear(this).sources];
  }
  get targets() {
    return [...getGear(this).targets];
  }
  done() {
    getGear(this).done();
    return this;
  }
  [$ITERATOR]() {
    return new Iterator(getGear(this).targets);
  }
}
objectDefineProperty(WhenBase[$PROTOTYPE], $CLASS, { value: CLASS_AEROBUS_WHEN });
function subclassWhen() {
  return class When extends WhenBase {
    constructor(bus, parameters, target) {
      super(bus, parameters, target);
    }
  }
}

/**
 * The message bus factory.
 *  Creates new message bus instances.
 * @param {...boolean|function|object|string} parameters
 *  The boolean value defining default bubbling behavior;
 *  and/or the string delimiter of hierarchical channel names (dot by default);
 *  and/or the error callback, invoked asynchronously with (error, [message]) arguments,
 *  where error is an error thrown by a iterator/observer/subscriber and caught via the bus;
 *  and/or the object literal with settings to configure (bubbles, delimiter, error, trace)
 *  and extesions for internal classes (channel, message and section).
 * @returns {Aerobus}
 *  The new instance of Aerobus as a function which resolves channels/sets of channels
 *  and contains additional API members.
 * @throws
 *  If any option is of unsupported type (boolean, function, object, string);
 *  or delimiter string is empty;
 *  or option object contains non-string or empty "delimiter" property;
 *  or option object contains non-function "error" property;
 *  or option object contains non-function "trace" property;
 *  or option object contains non-object "channel" property;
 *  or option object contains non-object "message" property;
 *  or option object contains non-object "section" property.
 */
function aerobus(...options) {
  let config = {
      bubbles: true
    , channel: {}
    , delimiter: '.'
    , error: error => { throw error; }
    , message: {}
    , pattern: {}
    , section: {}
    , trace: noop
    , when: {}
  };
  // iterate options
  for (let i = -1, l = options.length; ++i < l;) {
    let option = options[i];
    // depending on class of option
    switch(classOf(option)) {
      // use boolean as 'bubbles' setting
      case CLASS_BOOLEAN:
        config.bubbles = option;
        break;
      // use function as 'error' setting
      case CLASS_FUNCTION:
        config.error = option;
        break;
      // parse object members
      case CLASS_OBJECT:
        let { bubbles, channel, delimiter, error, message, section, trace, when } = option;
        // use 'bubbles' field if defined
        if (isSomething(bubbles))
          config.bubbles = !!bubbles;
        // use 'delimiter' string if defined
        if (isSomething(delimiter))
          if (isString(delimiter) && delimiter.length)
            config.delimiter = delimiter;
          else throw errorDelimiterNotValid(delimiter);
        // use 'error' function if defined
        if (isSomething(error))
          if (isFunction(error))
            config.error = error;
          else throw errorErrorNotValid(error);
        // use 'trace' function if defined
        if (isSomething(trace))
          if (isFunction(trace))
            config.trace = trace;
          else throw errorTraceNotValid(trace);
        // use 'channel' if defined to extend Channel instances
        if (isSomething(channel))
          if (isObject(channel))
            objectAssign(config.channel, channel);
          else throw errorChannelExtensionNotValid(channel);
        // use 'message' if defined to extend Message instances
        if (isSomething(message))
          if (isObject(message))
            objectAssign(config.message, message);
          else throw errorMessageExtensionNotValid(message);
        // use 'section' if defined to extend Section instances
        if (isSomething(section))
          if (isObject(section))
            objectAssign(config.section, section);
          else throw errorSectionExtensionNotValid(section);
        // use 'when' if defined to extend When instances
        if (isSomething(when))
          if (isObject(when))
            objectAssign(config.when, when);
          else throw errorWhenExtensionNotValid(when);
        break;
      // use string as 'delimiter' setting
      case CLASS_STRING:
        if (option.length)
          config.delimiter = option;
        else throw errorDelimiterNotValid(option);
        break;
      // class of option is unexpected, throw
      default:
        throw errorArgumentNotValid(option);
    }
  }
  // keep the stuffe implementing bus in the private storage
  setGear(bus, new BusGear(config));
  // extend bus function with additional API members
  return objectDefineProperties(bus, {
    [$CLASS]: { value: CLASS_AEROBUS }
  , bubble: { value: bubble }
  , bubbles: { get: getBubbles }
  , clear: { value: clear }
  , create: { value: create }
  , channels: { get: getChannels }
  , delimiter: { get: getDelimiter }
  , error: { get: getError }
  , root: { get: getRoot }
  , trace: { get: getTrace, set: setTrace }
  , unsubscribe: { value: unsubscribe }
  });
  /**
   * A message bus instance.
   *  Depending on arguments provided resolves channels and sets of channels (sections).
   * @global
   * @alias Aerobus
   * @param {...string} [names]
   *  The channel names to resolve. If not provided resolves the root channel. 
   *  If one provided, resolves corresponding channel.
   *  Otherwise resolves section joining several channels into one logical unit.
   * @return {Channel|Section}
   *  Resolved channel or section.
   * @property {boolean} bubbles
   *  Gets the bubbling state of this bus.
   * @property {string} delimiter
   *  Gets the delimiter string used to split hierarchical channel names.
   * @property {array} channels
   *  Gets the list of existing channels.
   * @property {Channel} error
   *  Gets the error callback.
   * @property {Channel} root
   *  Gets the root channel.
   * @property {function} trace
   *  Gets or sets the trace callback.
   * @throws
   *  If any name is not a string.
   */
  function bus(...names) {
    return getGear(bus).resolve(names);
  }
  /**
   * Enables or disables publication bubbling for this bus depending on value.
   *  Every newly created chanel will inherit this setting.
   * @alias Aerobus#bubble
   * @param {boolean} value
   *  Truthy value to enable bubbling or falsey to disable.
   * @return {function}
   *  This bus.
   */
  function bubble(value = true) {
    getGear(bus).bubble(value);
    return bus;
  }
  /**
   * Empties this bus clearing and removing all existing channels.
   * @alias Aerobus#clear
   * @return {function}
   *  This bus.
   */
  function clear() {
    getGear(bus).clear();
    return bus;
  }
  /**
   * Creates new bus instance which inherits settings from this instance.
   * @alias Aerobus#create
   * @param {...any} [overrides]
   *  The overrides of settings being inherited.
   * @return {function}
   *  New message bus instance.
   */
  function create(...overrides) {
    let overriden = config;
    // iterate all overrides and then with config used to setup this instance.
    for (let i = -1, l = overrides.length; ++i < l;) {
      let override = overrides[i];
      // depending on class of override
      switch(classOf(override)) {
        // use boolean to override 'bubbles' setting
        case CLASS_BOOLEAN:
          overriden.bubbles = override;
          break;
        // use function to override 'error' setting
        case CLASS_FUNCTION:
          overriden.error = override;
          break;
        // use object to override all settings
        case CLASS_OBJECT:
          objectAssign(overriden, override);
          break;
        // use string to override 'delimiter' setting
        case CLASS_STRING:
          if (override.length)
            overriden.delimiter = override;
          else throw errorDelimiterNotValid(override);
          break;
        // class of override is unexpected, throw
        default:
          throw errorArgumentNotValid(override);
      }
    }
    return aerobus(overriden);
  }
  function getBubbles() {
    return getGear(bus).bubbles;
  }
  function getChannels() {
    return Array.from(getGear(bus).channels.values());
  }
  function getDelimiter() {
    return getGear(bus).delimiter;
  }
  function getError() {
    return getGear(bus).error;
  }
  function getRoot() {
    return getGear(bus).get('');
  }
  function getTrace() {
    return getGear(bus).trace;
  }
  function setTrace(value) {
    if (!isFunction(value))
      throw errorTraceNotValid(value);
    getGear(bus).trace = value;
  }
  /**
   * Unsubscribes provided subscribers or names from all channels of this bus.
   * @alias Aerobus#unsubscribe
   * @param {...function|string|Subscriber} [parameters]
   *  Subscribers and/or subscriber names to unsibscribe.
   *  If omitted, unsubscribes all subscribers from all channels.
   * @return {function}
   *  This bus.
   */
  function unsubscribe(...parameters) {
    getGear(bus).unsubscribe(new Unsubscription(parameters));
    return bus;
  }
}

export default aerobus;
