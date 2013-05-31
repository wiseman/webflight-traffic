# webflight-traffic

This is a plugin for the browser-based AR.Drone ground control station
[webflight](http://eschnou.github.io/ardrone-webflight/) that displays
nearby aircraft overlaid on the drone's camera feed.

![Screenshot](traffic-screenshot.jpg "Screenshot")


## How it works

To properly show traffic onscreen we need to know 3 things:

1. Where the drone is.
2. The drone's attitude.
3. Where the traffic is.


### Where the drone is

The AR.Drone doesn't come with GPS, so for now I fake it:

```
this.dronePosition = {
  // Sunset Junction area of Los Angeles.
  // https://www.google.com/maps/preview#!q=34.090303%2C-118.276223
  lat: 34.090303,
  lon: -118.276223
};
```

It should be possible to use a USB GPS, wifi SSID geolocation or some
other scheme to get the drone's position.


### The drone's attitude

The AR.Drone has gyros, accelerometers and a magnetometer which gives
us its heading, pitch and roll so we can figure out where on the video
feed to put the markers.

We just need to make sure we enable the magnetometer values in the
drone's navdata telemetry:

```javascript
function initDrone(client) {
  // From the AR.Drone SDK.
  var default_navdata_options = (
    navdata_option_mask(arDroneConstants.options.DEMO) |
    navdata_option_mask(arDroneConstants.options.VISION_DETECT));
  // Enable the magnetometer data.
  client.config('general:navdata_options',
                default_navdata_options |
                navdata_option_mask(arDroneConstants.options.MAGNETO));
}
```


### Where the traffic is

Some aircraft (lots in Europe and Australia, some in the U.S.)
broadcast their GPS coordinates and other info using a scheme called
[ADS-B](http://en.wikipedia.org/wiki/Automatic_dependent_surveillance-broadcast).
For [$20 you can buy a USB digital TV dongle that can actually pick up
ADS-B
broadcasts](http://www.irrational.net/2012/08/06/tracking-planes-for-20-or-less/).
You now have a virtual radar that can pick up aircraft from up to 100
miles away.

This plugin assumes there is an ADS-B decoder serving SBS-1 style
messages at `localhost:30003`. The instructions below explain how to
run a decoder.


## Running the software

You will need the
[ardrone-webflight](https://github.com/eschnou/ardrone-webflight) and
webflight-traffic repos:

```
git clone git://github.com/eschnou/ardrone-webflight.git
git clone git://github.com/wiseman/webflight-traffic.git
```

Run `npm install` for each:

```
(cd ardrone-webflight && npm install)
(cd webflight-traffic && npm install)
```

Link webflight-traffic into webflight's `plugins` directory:

```
(cd ardrone-webflight/plugins && ln -s ../../webflight-traffic traffic)
```

Copy ardrone-webflight's config.js.example:
```
(cd ardrone-webflight && cp config.js.example config.js)
```

And add `"traffic"` to the `plugins` array in `config.js`, so it looks something like this:
```
var config = {
    plugins: [
      "video-stream"  // Display the video as a native h264 stream decoded in JS 
      , "hud"         // Display the artificial horizon, altimeter, compass, etc.
      , "pilot"       // Pilot the drone with the keyboard
      , "traffic"     // Show ADS-B traffic.
    ]
};

module.exports = config;
```

Now you need to start an ADS-B decoder.
[dump1090](https://github.com/antirez/dump1090) is easy to use--You
can either build it on your laptop, and plug your RTL-SDR dongle in
there, or you can build it for your AR.Drone and run it there, using
the instructions in my blog post, ["Cheap ADS-B on amateur
drones"](http://lemondronor.com/blog/indexphp/2013/4/cheap-ads-b-on-amateur-drones).

