'use strict';

(function (global, factory) {
	if (typeof define === "function" && define.amd) {
		define(['./utilities', 'chai', './Bus'], factory);
	} else if (typeof exports !== "undefined") {
		factory(require('./utilities'), require('chai'), require('./Bus'));
	} else {
		var mod = {
			exports: {}
		};
		factory(global.utilities, global.chai, global.Bus);
		global.aerobusTest = mod.exports;
	}
})(this, function (_utilities, _chai, _Bus) {
	var utilities = _interopRequireWildcard(_utilities);

	var _Bus2 = _interopRequireDefault(_Bus);

	function _interopRequireDefault(obj) {
		return obj && obj.__esModule ? obj : {
			default: obj
		};
	}

	function _interopRequireWildcard(obj) {
		if (obj && obj.__esModule) {
			return obj;
		} else {
			var newObj = {};

			if (obj != null) {
				for (var key in obj) {
					if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
				}
			}

			newObj.default = obj;
			return newObj;
		}
	}

	var data = {},
	    delimiter = '.',
	    trace = function trace() {},
	    strategy = 'cycle' | 'random' | 'default';

	describe('airybus', function () {
		it('should be a function', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.isFunction(bus);
		});
		it('should be equal delimiter', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.delimiter, delimiter);
		});
		it('change delimeter should not throw', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(bus.delimiter = delimiter);
		});
		it('should be equal trace', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.trace, trace);
		});
		it('change trace should not throw', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(bus.trace = trace);
		});
		it('root should return Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(utilities.isChannel(bus.root));
		});
		it('change delimeter should throw because bus already is not empty', function () {
			_chai.assert.throw(function () {
				var bus = (0, _Bus2.default)(delimiter, trace);
				bus.root;
				bus.delimiter = delimiter;
			});
		});
		it('change trace should throw because bus already is not empty', function () {
			_chai.assert.throw(function () {
				var bus = (0, _Bus2.default)(delimiter, trace);
				bus.root;
				bus.trace = trace;
			});
		});
		it('root parent should return undefined', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(utilities.isUndefined(bus.root.parent));
		});
		it('root isEnabled should return true default', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(bus.root.isEnabled);
		});
		it('root disable should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.root.disable(), bus.root);
		});
		it('root isEnabled should return false after disable', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.disable();

			_chai.assert.notOk(bus.root.isEnabled);
		});
		it('root enable(false) should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.root.enable(false), bus.root);
		});
		it('root isEnabled should return false after enable(false)', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.enable(false);

			_chai.assert.notOk(bus.root.isEnabled);
		});
		it('root enable(true) should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.root.enable(true), bus.root);
		});
		it('root isEnabled should return true after enable(true)', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.enable(true);

			_chai.assert.ok(bus.root.isEnabled);
		});
		it('error should return Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(utilities.isChannel(bus.error));
		});
		it('error parent should return undefined', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(utilities.isUndefined(bus.error.parent));
		});
		it('bus(test) should return custom Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.ok(utilities.isChannel(bus('test')));
		});
		it('test name should be test', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus('test').name, 'test');
		});
		it('test parent should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus('test').parent, bus.root);
		});
		it('bus(\'parent.child\').parent.name should return \'parent\' value', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus('parent.child').parent.name, 'parent');
		});

		var invocations = 0,
		    subscriber = function subscriber(message) {
			invocations++;
		};

		it('bus.root.subscribe(subscriber) should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.root.subscribe(subscriber), bus.root);
		});
		it('bus.root.subscribers should return array containing subscriber', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber);

			_chai.assert.notOk(bus.root.subscribers.indexOf(subscriber) === -1);
		});
		it('bus.root.publish(data) should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber);

			_chai.assert.strictEqual(bus.root.publish(data), bus.root);
		});
		it('subscriber should be invoked', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			invocations = 0;
			bus.root.subscribe(subscriber);
			bus.root.publish(data);

			_chai.assert.strictEqual(invocations, 1);
		});
		it('bus.root.unsubscribe(subscriber) should return root Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber);

			_chai.assert.strictEqual(bus.root.unsubscribe(subscriber), bus.root);
		});
		it('bus.root.subscribers should return array/iterator not containing subscriber', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber);
			bus.root.unsubscribe(subscriber);

			_chai.assert.ok(bus.root.subscribers.indexOf(subscriber) === -1);
		});
		it('bus(\'test1\', \'test2\') should return Section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');

			_chai.assert.ok(utilities.isSection(section));
		});
		it('section channels should return array of Channel objects', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2'),
			    channels = section.channels;

			_chai.assert.strictEqual(channels[0], bus('test1'));

			_chai.assert.strictEqual(channels[1], bus('test2'));
		});
		it('section disable should return section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');

			_chai.assert.strictEqual(section.disable(), section);
		});
		it('section channels isEnabled should return false after disable', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.disable();

			_chai.assert.notOk(bus('test1').isEnabled);

			_chai.assert.notOk(bus('test2').isEnabled);
		});
		it('section enable(false) should return section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');

			_chai.assert.strictEqual(section.enable(false), section);
		});
		it('section channels isEnabled should return false after enable(false)', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.enable(false);

			_chai.assert.notOk(bus('test1').isEnabled);

			_chai.assert.notOk(bus('test2').isEnabled);
		});
		it('section enable(true) should return section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');

			_chai.assert.strictEqual(section.enable(true), section);
		});
		it('section channels isEnabled should return true after enable(true)', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.enable(true);

			_chai.assert.ok(bus('test1').isEnabled);

			_chai.assert.ok(bus('test2').isEnabled);
		});
		it('section subscribe should return section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');

			_chai.assert.strictEqual(section.subscribe(subscriber), section);
		});
		it('section channels should return array/iterator containing subscriber', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.subscribe(subscriber);

			_chai.assert.notOk(bus('test1').subscribers.indexOf(subscriber) === -1);

			_chai.assert.notOk(bus('test2').subscribers.indexOf(subscriber) === -1);
		});
		it('section publish should return section object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			invocations = 0;
			section.subscribe(subscriber);

			_chai.assert.strictEqual(section.publish(data), section);
		});
		it('subscriber should be invoked twice', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			invocations = 0;
			section.subscribe(subscriber);
			section.publish(data);

			_chai.assert.strictEqual(invocations, 2);
		});
		it('bus.unsubscribe should return bus function', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.subscribe(subscriber);

			_chai.assert.strictEqual(bus.unsubscribe(subscriber), bus);
		});
		it('channels should return array not containing subscriber', function () {
			var bus = (0, _Bus2.default)(delimiter, trace),
			    section = bus('test1', 'test2');
			section.subscribe(subscriber);
			bus.unsubscribe(subscriber);

			_chai.assert.ok(bus('test1').subscribers.indexOf(subscriber) === -1);

			_chai.assert.ok(bus('test2').subscribers.indexOf(subscriber) === -1);
		});

		var invocations1 = 0,
		    invocations2 = 0,
		    subscriber1 = function subscriber1(message) {
			return invocations1++;
		},
		    subscriber2 = function subscriber2(message) {
			return invocations2++;
		};

		it('subscribe for same subscribers should return Channel object', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.strictEqual(bus.root.subscribe(subscriber1, subscriber2), bus.root);
		});
		it('publish cyclically should call subscribers cyclically', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber1, subscriber2);

			_chai.assert.strictEqual(bus.root.publish(data, 'cyclically'), bus.root);

			_chai.assert.ok(invocations1 === 1 && invocations2 === 0);

			_chai.assert.strictEqual(bus.root.publish(data), bus.root);

			_chai.assert.ok(invocations1 === 1 && invocations2 === 1);
		});
		it('publish randomly should call subscribers randomly', function () {
			invocations1 = 0, invocations2 = 0;
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber1, subscriber2);

			_chai.assert.strictEqual(bus.root.publish(data, 'randomly'), bus.root);

			_chai.assert.ok(invocations1 + invocations2 === 1);

			_chai.assert.strictEqual(bus.root.publish(data), bus.root);

			_chai.assert.ok(invocations1 + invocations2 === 2);
		});
		it('bus channels should return array of channels', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus('test1', 'test2', 'test3');
			bus('test4');

			_chai.assert.includeMembers(bus.channels, [bus('root'), bus('test1'), bus('test2'), bus('test3'), bus('test4')]);
		});
		it('channel clear shoud clear subscribers', function () {
			var bus = (0, _Bus2.default)(delimiter, trace);
			bus.root.subscribe(subscriber1, subscriber2);

			_chai.assert.strictEqual(bus.clear(), bus);

			_chai.assert.includeMembers(bus.channels, []);
		});
		it('retentions should work', function () {
			invocations = 0;
			var bus = (0, _Bus2.default)(delimiter, trace);

			_chai.assert.includeMembers(bus.root.retentions, []);

			_chai.assert.strictEqual(bus.root.retain(1), bus.root);

			_chai.assert.strictEqual(bus.root.retaining, 1);

			bus.root.publish(data);
			bus.root.subscribe(subscriber);

			_chai.assert.strictEqual(invocations, 1);
		});
	});
});