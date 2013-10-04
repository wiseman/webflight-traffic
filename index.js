var defaults = require('lodash.defaults');
var each = require('lodash.foreach');
var geolib = require('geolib');
var planefinder = require('planefinder');
var sbs1 = require('sbs1');
var arDroneConstants = require('ar-drone/lib/constants')


function navdata_option_mask(c) {
  return 1 << c;
}


function initDrone(client) {
  // From the SDK.
  var default_navdata_options = (
    navdata_option_mask(arDroneConstants.options.DEMO) |
      navdata_option_mask(arDroneConstants.options.VISION_DETECT));
  // Enable the magnetometer data.
  client.config('general:navdata_options',
                default_navdata_options |
                navdata_option_mask(arDroneConstants.options.MAGNETO));
}

function traffic(name, deps) {
  initDrone(deps.client);
  var traffic = {};
  var config = deps.config.traffic || {};
  var trafficPushInterval = 1000;  // ms
  var messageTimeout = 120000;  // ms

  var garbageCollect = function() {
    var nowMillis = new Date().getTime();
    each(traffic, function(value, key) {
      var age = nowMillis - value.timestamp;
      if (age >= messageTimeout) {
        console.log('Expired old traffic ID ' + key);
        delete traffic[key];
      }
    });
  };

  // Listen to SBS1 messages.
  var sbs1Host = config.sbs1_host || 'localhost';
  var sbs1Client = sbs1.createClient({host: sbs1Host});

  sbs1Client.on('message', function(msg) {
    var id = msg.hex_ident;
    // Don't assume messages have any kind of timestamps; add our own.
    msg.timestamp = new Date().getTime();
    traffic[id] = defaults(msg, traffic[id] || {});
  });
  sbs1Client.on('error', function(err) {
    console.error('Error communicating with SBS1 server at ' +
                  sbs1Host + ': ' + err);
  });

  var handlePlanefinderData = function(planes) {
    each(planes, function(plane) {
      traffic[plane.hex_ident] = plane;
    });
  };

  if (config.planefinder) {
    console.log('Using planefinder');
    // Use default config.
    if (typeof(config.planefinder) !== 'object') {
      config.planefinder = {};
    }
    defaults(config.planefinder, {
      faa: false,
      maxDistance: 30000
    });
    // Find bounds.
    var dronePosition = {
      latitude: 37.786930,
      longitude: -122.399614
    };
    config.planefinder.bounds = (
      config.planefinder.bounds ||
        geolib.getBoundsOfDistance(dronePosition, config.planefinder.maxDistance));
    var pfClient = planefinder.createClient(config.planefinder);
    pfClient.on('data', handlePlanefinderData);
    pfClient.resume();
  }

  // Schedule periodic traffic updates.
  var pushTraffic = function() {
    garbageCollect();
    deps.io.sockets.emit('traffic', traffic);
  };
  var trafficTimer = setInterval(pushTraffic, trafficPushInterval);
};


module.exports = traffic;
