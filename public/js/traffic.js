(function(window, document) {
  console.log('Loading traffic overlay plugin');


  var TrafficOverlay  = function(cockpit) {
    console.log('Initializing traffic overlay plugin');

    // Create a canvas overlay.
    $('#cockpit').append('<canvas id="traffic"></canvas>');
    this.trafficJquery = $('#traffic');
    this.ctx = this.trafficJquery.get(0).getContext('2d');
    this.cockpit = cockpit;
    // Someday there should be a way for the drone to know its
    // location--either GPS or geolocation based on wifi SSIDs.  Until
    // then, this is just an arbitrary default location.
    this.dronePosition = {
      lat: 37.786930,
      lon: -122.399614
    };
    this.traffic = {};

    // Update when drone telemetry comes in.
    this.cockpit.socket.on('navdata', this.handleNavdata_.bind(this));
    // Update when traffic data comes in.
    this.cockpit.socket.on('traffic', this.handleTraffic_.bind(this));
    // Bind on window events to resize.
    $(window).resize(this.render.bind(this));
  };

  TrafficOverlay.prototype.handleTraffic_ = function(traffic) {
    this.traffic = traffic;
    requestAnimationFrame(this.render.bind(this));
  }

  TrafficOverlay.prototype.handleNavdata_ = function(navdata) {
    this.navdata = navdata;
    requestAnimationFrame(this.render.bind(this));
  };

  TrafficOverlay.prototype.render = function() {
    if (this.navdata) {
      this.ctx.canvas.width = this.trafficJquery.innerWidth();
      this.ctx.canvas.height = this.trafficJquery.innerHeight();
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
      this.drawTraffic();
    }
  };

  TrafficOverlay.prototype.drawTraffic = function drawAircraft() {
    var fovX = 60;
    var fovY = 35;
    var width = this.ctx.canvas.width;
    var height = this.ctx.canvas.height;
    var pitch = this.navdata.demo.rotation.pitch;
    var roll = this.navdata.demo.rotation.roll;
    this.ctx.font = '12px Arial';
    // Filter out aircraft without a position and compute distance &
    // bearing info.
    var aircrafts = [];
    for (var key in this.traffic) {
      var aircraft = this.traffic[key];
      if (aircraft.lat && aircraft.lon) {
        aircraft.targeting = this.targetInfo(this.dronePosition, aircraft);
        aircrafts.push(aircraft);
      }
    }
    // Sort closest last.
    aircrafts.sort(function(a, b) {
      return b.targeting.range - a.targeting.range;
    });
    this.ctx.translate(width / 2, height / 2);
    // Um, we don't currently handle roll--keep that axis level for
    //best results. :)
    // this.ctx.rotate(-roll * Math.PI / 180);
    for (var i = 0; i < aircrafts.length; i++) {
      var aircraft = aircrafts[i];
      if (aircraft.lat && aircraft.lon) {
        var targetInfo = aircraft.targeting;
        var hdg = this.navdata.magneto.heading.fusionUnwrapped;
        var theta = this.normalizeAngle(targetInfo.bearing - hdg);
        var phi = Math.atan2(aircraft.altitude, targetInfo.range) * 180 / Math.PI;
        var x = (theta / fovX) * width;
        var y = -(this.normalizeAngle(phi - pitch) / fovY) * height;

        this.ctx.fillStyle = 'black';
        this.roundRect(x - 75, y, 150, 60, 5, 'black');
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(
          (aircraft.callsign || '[unk]') + ' (' + aircraft.hex_ident + ')',
          x - 70,
          y + 19);
        this.ctx.fillText('SPD ' + aircraft.ground_speed + ' kts', x - 70,  y + 36);
        this.ctx.fillText('ALT ' + aircraft.altitude + ' ft' +
                          '  DST ' + Math.round(targetInfo.range / 5280) + ' mi',
                          x - 70,  y + 53);

        this.ctx.fillStyle = 'red';
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - 5, y + 5);
        this.ctx.lineTo(x + 5, y + 5);
        this.ctx.fill();
      }
    }
    //this.ctx.rotate(roll * Math.PI / 180);
    //this.ctx.translate(width / 2, height / 2);
  };

  TrafficOverlay.prototype.toRad = function toRad(a) {
    return a * Math.PI / 180;
  };

  TrafficOverlay.prototype.targetInfo = function targetInfo(p1, p2) {
    var R = 3959 * 5280; // feet
    var dLat = this.toRad(p2.lat - p1.lat);
    var dLon = this.toRad(p2.lon - p1.lon)
    var lat1 = this.toRad(p1.lat);
    var lat2 = this.toRad(p2.lat);

    var a = (Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.sin(dLon/2) * Math.sin(dLon/2) *
             Math.cos(lat1) * Math.cos(lat2));
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = (Math.cos(lat1)*Math.sin(lat2) -
             Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon));
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    return {
      range: d,
      bearing: brng
    };
  };

  TrafficOverlay.prototype.normalizeAngle = function(a) {
    if (a > 180) {
      return this.normalizeAngle(a - 360);
    } else if (a < -180) {
      return this.normalizeAngle(a + 360);
    } else {
      return a;
    }
  };

  /**
   * Draws a rounded rectangle using the current state of the canvas.
   * If you omit the last three params, it will draw a rectangle
   * outline with a 5 pixel border radius
   * @param {CanvasRenderingContext2D} ctx
   * @param {Number} x The top left x coordinate
   * @param {Number} y The top left y coordinate
   * @param {Number} width The width of the rectangle
   * @param {Number} height The height of the rectangle
   * @param {Number} radius The corner radius. Defaults to 5;
   * @param {Boolean} fill Whether to fill the rectangle. Defaults to false.
   * @param {Boolean} stroke Whether to stroke the rectangle. Defaults to true.
   */
  TrafficOverlay.prototype.roundRect = function roundRect(x, y, width, height, radius, fill, stroke) {
    if (typeof stroke == "undefined" ) {
      stroke = true;
    }
    if (typeof radius === "undefined") {
      radius = 5;
    }
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (stroke) {
      ctx.stroke();
    }
    if (fill) {
      ctx.fill();
    }
  };


  window.Cockpit.plugins.push(TrafficOverlay);
}(window, document));
