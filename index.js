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
  var host = 'localhost';
  if (deps.config && deps.config.traffic) {
    host = deps.config.traffic.sbs1_host || host;
  }
  var sbs1Client = sbs1.createClient({host: host});
  var trafficPushPeriod = 1000;  // ms
  var messageTimeout = 120000;  // ms

  mergeMessages = function(oldMsg, newMsg) {
    var merged = {};
    for (var attrname in oldMsg) { merged[attrname] = oldMsg[attrname]; }
    for (var attrname in newMsg) {
      if (newMsg[attrname]) {
        merged[attrname] = newMsg[attrname];
      }
    }
    return merged;
  }

  garbageCollect = function() {
    var nowMillis = new Date().getTime();
    keys = [];
    for (var key in traffic) {
      keys.push(key);
    }
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var age = nowMillis - traffic[key].timestamp;
      if (age >= messageTimeout) {
        console.log('Expired old traffic ID ' + key);
        delete traffic[key];
      }
    }
  };

  // Listen to SBS1 messages.
  sbs1Client.on('message', function(msg) {
    var id = msg.hex_ident;
    // Don't assume messages have any kind of timestamps; add our own.
    msg.timestamp = new Date().getTime();
    traffic[id] = mergeMessages(traffic[id] || {}, msg);
  });
  sbs1Client.on('error', function(err) {
    console.error('Error communicating with SBS1 server at ' +
                  host + ': ' + err);
  });

  // Schedule periodic traffic updates.
  var pushTraffic = function() {
    garbageCollect();
    deps.io.sockets.emit('traffic', traffic);
  };
  var trafficTimer = setInterval(pushTraffic, trafficPushPeriod);
};


module.exports = traffic;
