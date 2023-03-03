"use strict";

var GiikerCube = execMain(function() {

	var cube = undefined;
	var _device = null;

	var GiikerCube = (function() {

		var _gatt = null;
		var _chrct = null;

		var UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';

		var SERVICE_UUID_DATA = '0000aadb' + UUID_SUFFIX;
		var CHRCT_UUID_DATA = '0000aadc' + UUID_SUFFIX;

		var SERVICE_UUID_RW = '0000aaaa' + UUID_SUFFIX;
		var CHRCT_UUID_READ = '0000aaab' + UUID_SUFFIX;
		var CHRCT_UUID_WRITE = '0000aaac' + UUID_SUFFIX;

		var deviceName;

		function init(device) {
			deviceName = device.name.startsWith('Gi') ? 'Giiker' : 'Mi Smart';
			return device.gatt.connect().then(function(gatt) {
				_gatt = gatt;
				return gatt.getPrimaryService(SERVICE_UUID_DATA);
			}).then(function(service) {
				return service.getCharacteristic(CHRCT_UUID_DATA);
			}).then(function(chrct) {
				_chrct = chrct;
				return _chrct.startNotifications();
			}).then(function() {
				return _chrct.readValue();
			}).then(function(value) {
				var initState = parseState(value);
				if (initState[0] != kernel.getProp('giiSolved', mathlib.SOLVED_FACELET)) {
					var rst = kernel.getProp('giiRST');
					if (rst == 'a' || rst == 'p' && confirm(CONFIRM_GIIRST)) {
						giikerutil.markSolved();
					}
				}
				return _chrct.addEventListener('characteristicvaluechanged', onStateChanged);
			});
		}

		function onStateChanged(event) {
			var value = event.target.value;
			parseState(value);
		}

		var cFacelet = [
			[26, 15, 29],
			[20, 8, 9],
			[18, 38, 6],
			[24, 27, 44],
			[51, 35, 17],
			[45, 11, 2],
			[47, 0, 36],
			[53, 42, 33]
		];

		var eFacelet = [
			[25, 28],
			[23, 12],
			[19, 7],
			[21, 41],
			[32, 16],
			[5, 10],
			[3, 37],
			[30, 43],
			[52, 34],
			[48, 14],
			[46, 1],
			[50, 39]
		];

		function toHexVal(value) {
			var raw = [];
			for (var i = 0; i < 20; i++) {
				raw.push(value.getUint8(i));
			}
			if (raw[18] == 0xa7) { // decrypt
				var key = [176, 81, 104, 224, 86, 137, 237, 119, 38, 26, 193, 161, 210, 126, 150, 81, 93, 13, 236, 249, 89, 235, 88, 24, 113, 81, 214, 131, 130, 199, 2, 169, 39, 165, 171, 41];
				var k1 = raw[19] >> 4 & 0xf;
				var k2 = raw[19] & 0xf;
				for (var i = 0; i < 18; i++) {
					raw[i] += key[i + k1] + key[i + k2];
				}
				raw = raw.slice(0, 18);
			}
			var valhex = [];
			for (var i = 0; i < raw.length; i++) {
				valhex.push(raw[i] >> 4 & 0xf);
				valhex.push(raw[i] & 0xf);
			}
			return valhex;
		}

		function parseState(value) {
			var timestamp = $.now();

			var valhex = toHexVal(value);
			var eo = [];
			for (var i = 0; i < 3; i++) {
				for (var mask = 8; mask != 0; mask >>= 1) {
					eo.push((valhex[i + 28] & mask) ? 1 : 0);
				}
			}
			var cc = new mathlib.CubieCube();
			var coMask = [-1, 1, -1, 1, 1, -1, 1, -1];
			for (var i = 0; i < 8; i++) {
				cc.ca[i] = (valhex[i] - 1) | ((3 + valhex[i + 8] * coMask[i]) % 3) << 3;
			}
			for (var i = 0; i < 12; i++) {
				cc.ea[i] = (valhex[i + 16] - 1) << 1 | eo[i];
			}
			var facelet = cc.toFaceCube(cFacelet, eFacelet);

			var moves = valhex.slice(32, 40);
			var prevMoves = [];
			for (var i = 0; i < moves.length; i += 2) {
				prevMoves.push("BDLURF".charAt(moves[i] - 1) + " 2'".charAt((moves[i + 1] - 1) % 7));
			}
			if (DEBUG) {
				var hexstr = [];
				for (var i = 0; i < 40; i++) {
					hexstr.push("0123456789abcdef".charAt(valhex[i]));
				}
				console.log('[giiker]', "Raw Data: ", valhex.join(""));
				console.log('[giiker]', "Current State: ", facelet);
				console.log('[giiker]', "A Valid Generator: ", scramble_333.genFacelet(facelet));
				console.log('[giiker]', "Previous Moves: ", prevMoves.reverse().join(" "));
				prevMoves.reverse();
			}
			callback(facelet, prevMoves, timestamp, deviceName);
			return [facelet, prevMoves];
		}

		function getBatteryLevel() {
			var _service;
			var _read;
			var _resolve;
			var listener = function(event) {
				_resolve([event.target.value.getUint8(1), deviceName]);
				_read.removeEventListener('characteristicvaluechanged', listener);
				_read.stopNotifications();
			};
			return _gatt.getPrimaryService(SERVICE_UUID_RW).then(function(service) {
				_service = service;
				return service.getCharacteristic(CHRCT_UUID_READ);
			}).then(function(chrct) {
				_read = chrct;
				return _read.startNotifications();
			}).then(function() {
				return _read.addEventListener('characteristicvaluechanged', listener);
			}).then(function() {
				return _service.getCharacteristic(CHRCT_UUID_WRITE);
			}).then(function(chrct) {
				chrct.writeValue(new Uint8Array([0xb5]).buffer);
				return new Promise(function(resolve) {
					_resolve = resolve;
				});
			});
		}

		return {
			init: init,
			opservs: [SERVICE_UUID_DATA, SERVICE_UUID_RW],
			getBatteryLevel: getBatteryLevel
		}
	})();

	var GanCube = (function() {

		var _gatt;
		var _service_data;
		var _service_meta;
		var _chrct_f2;
		var _chrct_f5;
		var _chrct_f6;
		var _chrct_f7;

		var UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
		var SERVICE_UUID_META = '0000180a' + UUID_SUFFIX;
		var CHRCT_UUID_VERSION = '00002a28' + UUID_SUFFIX;
		var CHRCT_UUID_HARDWARE = '00002a23' + UUID_SUFFIX;
		var SERVICE_UUID_DATA = '0000fff0' + UUID_SUFFIX;
		var CHRCT_UUID_F2 = '0000fff2' + UUID_SUFFIX; // cube state, (54 - 6) facelets, 3 bit per facelet
		var CHRCT_UUID_F3 = '0000fff3' + UUID_SUFFIX; // prev moves
		var CHRCT_UUID_F5 = '0000fff5' + UUID_SUFFIX; // gyro state, move counter, pre moves
		var CHRCT_UUID_F6 = '0000fff6' + UUID_SUFFIX; // move counter, time offsets between premoves
		var CHRCT_UUID_F7 = '0000fff7' + UUID_SUFFIX;

		var _service_v2data;
		var _chrct_v2read;
		var _chrct_v2w;
		var SERVICE_UUID_V2DATA = '6e400001-b5a3-f393-e0a9-e50e24dc4179';
		var CHRCT_UUID_V2READ = '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4';
		var CHRCT_UUID_V2WRITE = '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4';

		var decoder = null;
		var version = null;

		var KEYS = [
			"NoRgnAHANATADDWJYwMxQOxiiEcfYgSK6Hpr4TYCs0IG1OEAbDszALpA",
			"NoNg7ANATFIQnARmogLBRUCs0oAYN8U5J45EQBmFADg0oJAOSlUQF0g",
			"NoRgNATGBs1gLABgQTjCeBWSUDsYBmKbCeMADjNnXxHIoIF0g",
			"NoRg7ANAzBCsAMEAsioxBEIAc0Cc0ATJkgSIYhXIjhMQGxgC6QA"
		];

		function getKey(version, value) {
			var key = KEYS[version >> 8 & 0xff];
			if (!key) {
				return;
			}
			key = JSON.parse(LZString.decompressFromEncodedURIComponent(key));
			for (var i = 0; i < 6; i++) {
				key[i] = (key[i] + value.getUint8(5 - i)) & 0xff;
			}
			return key;
		}

		function getKeyV2(version, value) {
			var key = KEYS[2];
			var iv = KEYS[3];
			key = JSON.parse(LZString.decompressFromEncodedURIComponent(key));
			iv = JSON.parse(LZString.decompressFromEncodedURIComponent(iv));
			for (var i = 0; i < 6; i++) {
				key[i] = (key[i] + value[5 - i]) % 255;
				iv[i] = (iv[i] + value[5 - i]) % 255;
			}
			return [key, iv];
		}

		function decode(value) {
			var ret = [];
			for (var i = 0; i < value.byteLength; i++) {
				ret[i] = value.getUint8(i);
			}
			if (decoder == null) {
				return ret;
			}
			iv = decoder.iv || [];
			if (ret.length > 16) {
				var offset = ret.length - 16;
				var block = decoder.decrypt(ret.slice(offset));
				for (var i = 0; i < 16; i++) {
					ret[i + offset] = block[i] ^ (~~iv[i]);
				}
			}
			decoder.decrypt(ret);
			for (var i = 0; i < 16; i++) {
				ret[i] ^= (~~iv[i]);
			}
			return ret;
		}

		function checkHardware(gatt) {
			console.log('[gancube] checkHardware start');
			return gatt.getPrimaryServices().then(function(services) {
				for (var i = 0; i < services.length; i++) {
					var service = services[i];
					DEBUG && console.log('[gancube] v1init find service', service.uuid);
					if (service.uuid == SERVICE_UUID_META) {
						_service_meta = service;
					} else if (service.uuid == SERVICE_UUID_DATA) {
						_service_data = service;
					} else if (service.uuid == SERVICE_UUID_V2DATA) {
						_service_v2data = service;
					}
				}
				if (_service_v2data) {
					return v2init();
				}
				if (_service_data && service_meta) {
					return v1init();
				}
				logohint.push('Not support your Gan cube');
			});
		}

		function v1init() {
			return _service_meta.getCharacteristic(CHRCT_UUID_VERSION).then(function(chrct) {
				return chrct.readValue();
			}).then(function(value) {
				version = value.getUint8(0) << 16 | value.getUint8(1) << 8 | value.getUint8(2);
				DEBUG && console.log('[gancube] version', JSON.stringify(version));
				decoder = null;
				if (version > 0x010007 && (version & 0xfffe00) == 0x010000) {
					return _service_meta.getCharacteristic(CHRCT_UUID_HARDWARE).then(function(chrct) {
						return chrct.readValue();
					}).then(function(value) {
						var key = getKey(version, value);
						if (!key) {
							logohint.push('Not support your Gan cube');
							return;
						}
						DEBUG && console.log('[gancube] key', JSON.stringify(key));
						decoder = $.aes128(key);
					});
				} else { //not support
					logohint.push('Not support your Gan cube');
				}
			}).then(function() {
				return _service_data.getCharacteristics();
			}).then(function(chrcts) {
				for (var i = 0; i < chrcts.length; i++) {
					var chrct = chrcts[i]
					DEBUG && console.log('[gancube] v1init find chrct', chrct.uuid);
					if (chrct.uuid == CHRCT_UUID_F2) {
						_chrct_f2 = chrct;
					} else if (chrct.uuid = CHRCT_UUID_F5) {
						_chrct_f5 = chrct;
					} else if (chrct.uuid = CHRCT_UUID_F6) {
						_chrct_f6 = chrct;
					} else if (chrct.uuid = CHRCT_UUID_F7) {
						_chrct_f7 = chrct;
					}
				}
			}).then(loopRead);
		}

		function v2initKey() {
			var mac = prompt('MAC address (xx:xx:xx:xx:xx:xx) of your cube, can be found in CubeStation or about://bluetooth-internals/#devices',
				'xx:xx:xx:xx:xx:xx');
			var m = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.exec(mac);
			if (!m) {
				logohint.push('Not a valid mac address, cannot connect to your Gan cube');
				return;
			}
			var value = [];
			for (var i = 0; i < 6; i++) {
				value.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
			}
			var keyiv = getKeyV2(version, value);
			DEBUG && console.log('[gancube] key', JSON.stringify(keyiv));
			decoder = $.aes128(keyiv[0]);
			decoder.iv = keyiv[1];
		}

		function v2init() {
			console.log('[gancube] v2init start');
			v2initKey();
			return _service_data.getCharacteristics().then(function(chrcts) {
				for (var i = 0; i < chrcts.length; i++) {
					var chrct = chrcts[i]
					DEBUG && console.log('[gancube] v2init find chrct', chrct.uuid);
					if (chrct.uuid == CHRCT_UUID_V2READ) {
						_chrct_v2read = chrct;
					} else if (chrct.uuid = CHRCT_UUID_V2WRITE) {
						_chrct_v2w = chrct;
					}
				}
				if (!_chrct_v2read) {
					console.log('[gancube] v2init cannot find v2read chrct');
				}
			}).then(function() {
				return _chrct_v2read.startNotifications();
			}).then(function() {
				return _chrct_v2read.addEventListener('characteristicvaluechanged', parseV2Data);
			});
		}

		function init(device) {
			return device.gatt.connect().then(function(gatt) {
				_gatt = gatt;
				return checkHardware(gatt);
			});
		}

		var prevMoves;
		var prevCubie = new mathlib.CubieCube();
		var curCubie = new mathlib.CubieCube();
		var latestFacelet;
		var timestamp;
		var prevTimestamp = 0;
		var moveCnt = -1;
		var prevMoveCnt = -1;
		var movesFromLastCheck = 1000;

		function checkState() {
			if (movesFromLastCheck < 50) {
				return new Promise(function(resolve) {
					resolve(false);
				});
			}
			return _chrct_f2.readValue().then(function(value) {
				value = decode(value);
				var state = [];
				for (var i = 0; i < value.length - 2; i += 3) {
					var face = value[i ^ 1] << 16 | value[i + 1 ^ 1] << 8 | value[i + 2 ^ 1];
					for (var j = 21; j >= 0; j -= 3) {
						state.push("URFDLB".charAt(face >> j & 0x7));
						if (j == 12) {
							state.push("URFDLB".charAt(i / 3));
						}
					}
				}
				latestFacelet = state.join("");
				movesFromLastCheck = 0;
				return new Promise(function(resolve) {
					resolve(true);
				});
			});
		}

		function loopRead() {
			if (!_device) {
				return;
			}
			return _chrct_f5.readValue().then(function(value) {
				value = decode(value);
				timestamp = $.now();
				moveCnt = value[12];
				if (moveCnt == prevMoveCnt) {
					return;
				}
				prevMoves = [];
				for (var i = 0; i < 6; i++) {
					var m = value[13 + i];
					prevMoves.unshift("URFDLB".charAt(~~(m / 3)) + " 2'".charAt(m % 3));
				}
				var f6val;
				return _chrct_f6.readValue().then(function(value) {
					value = decode(value);
					f6val = value;
					return checkState();
				}).then(function(isUpdated) {
					if (isUpdated && prevMoveCnt == -1) {
						callback(latestFacelet, prevMoves, timestamp, 'Gan 356i');
						prevCubie.fromFacelet(latestFacelet);
						prevMoveCnt = moveCnt;
						if (latestFacelet != kernel.getProp('giiSolved', mathlib.SOLVED_FACELET)) {
							var rst = kernel.getProp('giiRST');
							if (rst == 'a' || rst == 'p' && confirm(CONFIRM_GIIRST)) {
								giikerutil.markSolved();
							}
						}
						return;
					}

					var timeOffs = [];
					for (var i = 0; i < 9; i++) {
						var off = f6val[i * 2 + 1] | f6val[i * 2 + 2] << 8;
						timeOffs.unshift(~~(off / 0.95));
					}

					var moveDiff = (moveCnt - prevMoveCnt) & 0xff;
					prevMoveCnt = moveCnt;
					movesFromLastCheck += moveDiff;
					if (moveDiff > 6) {
						movesFromLastCheck = 50;
						moveDiff = 6;
					}
					var _timestamp = prevTimestamp;
					for (var i = moveDiff - 1; i >= 0; i--) {
						_timestamp += timeOffs[i];
					}
					if (Math.abs(_timestamp - timestamp) > 2000) {
						console.log('[gancube]', 'time adjust', timestamp - _timestamp, '@', timestamp);
						prevTimestamp += timestamp - _timestamp;
					}

					for (var i = moveDiff - 1; i >= 0; i--) {
						var m = "URFDLB".indexOf(prevMoves[i][0]) * 3 + " 2'".indexOf(prevMoves[i][1]);
						mathlib.CubieCube.EdgeMult(prevCubie, mathlib.CubieCube.moveCube[m], curCubie);
						mathlib.CubieCube.CornMult(prevCubie, mathlib.CubieCube.moveCube[m], curCubie);
						prevTimestamp += timeOffs[i];
						callback(curCubie.toFaceCube(), prevMoves.slice(i), prevTimestamp, 'Gan 356i');
						var tmp = curCubie;
						curCubie = prevCubie;
						prevCubie = tmp;
					}
					if (isUpdated && prevCubie.toFaceCube() != latestFacelet) {
						console.log('[gancube]', 'Cube state check error');
						console.log('[gancube]', 'calc', prevCubie.toFaceCube());
						console.log('[gancube]', 'read', latestFacelet);
						prevCubie.fromFacelet(latestFacelet);
					}
				});
			}).then(loopRead);
		}

		function getBatteryLevel() {
			return _chrct_f7.readValue().then(function(value) {
				value = decode(value);
				return new Promise(function(resolve) {
					resolve([value[7], 'Gan 356i']);
				});
			});
		}

		function parseV2Data(value) {
			DEBUG && console.log('[gancube]', 'v2 raw value', value);
			value = decode(value);
			DEBUG && console.log('[gancube]', 'v2 dec value', value);
			return;
		}

		return {
			init: init,
			opservs: [SERVICE_UUID_DATA, SERVICE_UUID_META, SERVICE_UUID_V2DATA],
			getBatteryLevel: getBatteryLevel
		}
	})();

	var GoCube = (function() {

		var _gatt;
		var _service;
		var _read;
		var _write;
		var _deviceName;
		var UUID_SUFFIX = '-b5a3-f393-e0a9-e50e24dcca9e';
		var SERVICE_UUID = '6e400001' + UUID_SUFFIX;
		var CHRCT_UUID_WRITE = '6e400002' + UUID_SUFFIX;
		var CHRCT_UUID_READ = '6e400003' + UUID_SUFFIX;

		var WRITE_BATTERY = 50;
		var WRITE_STATE = 51;

		function init(device) {
			_deviceName = device.name.startsWith('GoCube') ? 'GoCube' : 'Rubiks Connected'
			return device.gatt.connect().then(function(gatt) {
				_gatt = gatt;
				return gatt.getPrimaryService(SERVICE_UUID);
			}).then(function(service) {
				_service = service;
				return _service.getCharacteristic(CHRCT_UUID_WRITE);
			}).then(function(chrct) {
				_write = chrct;
				return _service.getCharacteristic(CHRCT_UUID_READ);
			}).then(function(chrct) {
				_read = chrct;
				return _read.startNotifications();
			}).then(function() {
				return _read.addEventListener('characteristicvaluechanged', onStateChanged);
			}).then(function() {
				return _write.writeValue(new Uint8Array([WRITE_STATE]).buffer);
			});
		}

		function onStateChanged(event) {
			var value = event.target.value;
			parseData(value);
		}

		function toHexVal(value) {
			var valhex = [];
			for (var i = 0; i < value.byteLength; i++) {
				valhex.push(value.getUint8(i) >> 4 & 0xf);
				valhex.push(value.getUint8(i) & 0xf);
			}
			return valhex;
		}
		var _batteryLevel;

		var axisPerm = [5, 2, 0, 3, 1, 4];
		var facePerm = [0, 1, 2, 5, 8, 7, 6, 3];
		var faceOffset = [0, 0, 6, 2, 0, 0];
		var moveCntFree = 100;
		var curFacelet = mathlib.SOLVED_FACELET;
		var curCubie = new mathlib.CubieCube();
		var prevCubie = new mathlib.CubieCube();

		function parseData(value) {
			var timestamp = $.now();
			if (value.byteLength < 4) {
				return;
			}
			if (value.getUint8(0) != 0x2a ||
				value.getUint8(value.byteLength - 2) != 0x0d ||
				value.getUint8(value.byteLength - 1) != 0x0a) {
				return;
			}
			var msgType = value.getUint8(2);
			var msgLen = value.byteLength - 6;
			if (msgType == 1) { // move
				// console.log(toHexVal(value));
				for (var i = 0; i < msgLen; i += 2) {
					var axis = axisPerm[value.getUint8(3 + i) >> 1];
					var power = [0, 2][value.getUint8(3 + i) & 1];
					var m = axis * 3 + power;
					console.log('move', "URFDLB".charAt(axis) + " 2'".charAt(power));
					mathlib.CubieCube.EdgeMult(prevCubie, mathlib.CubieCube.moveCube[m], curCubie);
					mathlib.CubieCube.CornMult(prevCubie, mathlib.CubieCube.moveCube[m], curCubie);
					curFacelet = curCubie.toFaceCube();
					callback(curFacelet, ["URFDLB".charAt(axis) + " 2'".charAt(power)], timestamp, _deviceName);
					var tmp = curCubie;
					curCubie = prevCubie;
					prevCubie = tmp;
					if (++moveCntFree > 20) {
						moveCntFree = 0;
						_write.writeValue(new Uint8Array([WRITE_STATE]).buffer);
					}
				}
			} else if (msgType == 2) { // cube state
				var facelet = [];
				for (var a = 0; a < 6; a++) {
					var axis = axisPerm[a] * 9;
					var aoff = faceOffset[a];
					facelet[axis + 4] = "BFUDRL".charAt(value.getUint8(3 + a * 9));
					for (var i = 0; i < 8; i++) {
						facelet[axis + facePerm[(i + aoff) % 8]] = "BFUDRL".charAt(value.getUint8(3 + a * 9 + i + 1));
					}
				}
				var newFacelet = facelet.join('');
				if (newFacelet != curFacelet) {
					console.log('facelet', newFacelet);
					curCubie.fromFacelet(newFacelet);
				}
			} else if (msgType == 3) { // quaternion
			} else if (msgType == 5) { // battery level
				_batteryLevel = value.getUint8(3);
				console.log('battery level', _batteryLevel);
			} else if (msgType == 7) { // offline stats
				console.log('offline stats', toHexVal(value));
			} else if (msgType == 8) { // cube type
				console.log('cube type', toHexVal(value));
			}
		}


		function getBatteryLevel() {
			_write.writeValue(new Uint8Array([WRITE_BATTERY]).buffer);
			return new Promise(function(resolve) {
				resolve([_batteryLevel, _deviceName])
			});
		}

		return {
			init: init,
			opservs: [SERVICE_UUID],
			getBatteryLevel: getBatteryLevel
		};
	})();

	function init(timer) {

		if (!window.navigator || !window.navigator.bluetooth) {
			alert("Bluetooth API is not available. Ensure https access, and try chrome with chrome://flags/#enable-experimental-web-platform-features enabled");
			return Promise.resolve();
		}

        return window.navigator.bluetooth.getAvailability().then(function(available) {
            if (!available) {
                return Promise.reject("Bluetooth is not available. Ensure HTTPS access, and check bluetooth is enabled on your device");
			}
			return window.navigator.bluetooth.requestDevice({
				filters: [{
					namePrefix: 'Gi'
				}, {
					namePrefix: 'Mi Smart Magic Cube'
				}, {
					namePrefix: 'GAN'
				}, {
					namePrefix: 'GoCube'
				}, {
					namePrefix: 'Rubiks'
				},{
					services: ['0000fe95-0000-1000-8000-00805f9b34fb']
				}, {
					services: [GiikerCube.opservs[0]]
				}],
				optionalServices: [].concat(GiikerCube.opservs, GanCube.opservs, GoCube.opservs),
			});
		}).then(function(device) {
			console.log(device);
			_device = device;
			if (device.name.startsWith('Gi') || device.name.startsWith('Mi Smart Magic Cube')) {
				cube = GiikerCube;
				return GiikerCube.init(device);
			} else if (device.name.startsWith('GAN')) {
				cube = GanCube;
				return GanCube.init(device);
			} else if (device.name.startsWith('GoCube') || device.name.startsWith('Rubiks')) {
				cube = GoCube;
				return GoCube.init(device);
			} else {
				return Promise.reject('Cannot detect device type');
			}
		});
	}

	function stop() {
		if (!_device) {
			return;
		}
		_device.gatt.disconnect();
		_device = null;
	}

	var callback = $.noop;

	return {
		init: init,
		stop: stop,
		isConnected: function() {
			return _device != null;
		},
		setCallBack: function(func) {
			callback = func;
		},
		getCube: function() {
			return cube;
		}
	};
});
