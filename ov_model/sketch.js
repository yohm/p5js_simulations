class OVmodel {
  constructor( num_cars ) {
    this.params = {
      car_a: 1.0,
      num_cars: num_cars,
      max_v: 1.0,
      lane_length: 20.0,
      car_size: 0.25,
      dt: 0.01
    };

    this.cars = [];
    for( var i=0; i<num_cars; i++) {
      var pos = (i*0.9 + 0.4*Math.random() ) * this.params.lane_length / num_cars;
      var v = 1.0 + 0.5 * Math.random();
      var c = new Car(this, pos, v);
      this.cars.push(c);
    }
    for( var i=0; i<num_cars; i++) {
      this.cars[i].set_front_car( this.cars[(i+1)%num_cars] );
    }
  }

  update() {
    for( var i=0; i<this.cars.length; i++) {
      this.cars[i].calc_dv_dx();
    }
    for( var i=0; i<this.cars.length; i++) {
      this.cars[i].update();
    }
  }

  ave_flow() {
    var sum = 0.0;
    for( var i=0; i<this.cars.length; i++ ) { sum += this.cars[i].vel; }
    return sum;
  }

  display(p, car_img, slow_car_img) {
    p.background(255);
    p.noFill();
    p.stroke(0,0,0);
    var road_diameter = p.width * 0.9;
    p.ellipse( p.width*0.5, p.height*0.5, road_diameter, road_diameter);
    p.noStroke();

    for( var i=0; i<this.cars.length; i++) {
      this.cars[i].display(p, car_img, slow_car_img, road_diameter*0.5);
    }
  }
}

class Car {
  constructor(ov_model, pos, vel=0.1) {
    this.ov = ov_model;
    this.pos = pos;
    this.vel = vel;
    this.braking = false;
  }

  set_front_car( front ) {
    this.front = front;
  }

  calc_dv_dx() {
    var d = this.front.pos - this.pos;
    var l = this.ov.params.lane_length;
    if( d < 0.0 ) { d += l; }
    if( this.front === this ) { d = l; }
    var dt = this.ov.params.dt;
    this.dv = this.ov.params.car_a * (this.V(d-this.ov.params.car_size) - this.vel ) * dt;
    this.dx = this.vel * dt;
    if( this.dx >= d ) { this.dx = d*0.9; } // to avoid overtaking
    if( this.dv <= -0.01*dt || this.vel < 0.1 ) { this.braking = true; }
    else { this.braking = false; }
  }

  update() {
    this.vel += this.dv;
    this.pos += this.dx;
    var l = this.ov.params.lane_length;
    if( this.pos > l ) { this.pos -= l; }
  }

  V(dx) {
    return this.ov.params.max_v * (Math.tanh(dx/this.ov.params.max_v-2.0) + Math.tanh(2.0));
  }

  display(p, car_img, slow_car_img, road_r) {
    var theta = this.pos / this.ov.params.lane_length * 2.0 * Math.PI;
    var x = p.width/2.0 + road_r * Math.cos(theta);
    var y = p.height/2.0 + road_r * Math.sin(theta);
    p.push();
    p.translate(x,y);
    p.rotate(theta - p.PI/2.0 - 0.1);
    var s = 50;
    var img = this.braking ? slow_car_img : car_img;
    p.image(img, 0, -s+12, s, s);
    p.pop();
  }
}

var s = function( p ) {

  var canvas_s = {x: 640, y:640}; // canvas size
  var t_per_frame = 3;

  var ov_model;
  var car_img;
  var slow_car_img;
  var souko_img;
  var omise_img;
  var flow;

  function set_inputs() {
    function make_slider( slider_id, text_id, init_value, callback ) {
      var slider = p.select(slider_id);
      var text = p.select(text_id);
      slider.value(init_value);
      text.value(init_value);
      slider.changed( () => {
        var v = slider.value();
        callback(v);
        text.value(v);
      });
      return slider;
    }
    make_slider("#param_numcar", "#param_numcar_text", ov_model.params.num_cars, (v) => { ov_model = new OVmodel(v); } );
  }

  p.preload = function() {
    car_img = p.loadImage("./truck.png");
    slow_car_img = p.loadImage("./truck_brake.png");
    souko_img = p.loadImage("./souko_building.png");
    omise_img = p.loadImage("./omise_shop_tatemono.png");
  }

  p.setup = function() {
    ov_model = new OVmodel(1);
    set_inputs();
    p.createCanvas(canvas_s.x, canvas_s.y);
    flow = p.select("#traffic_flow");
  }

  p.draw = function() {
    for( var t=0; t<t_per_frame; t++) { ov_model.update(); }
    ov_model.display(p, car_img, slow_car_img);
    flow.value( ov_model.ave_flow().toFixed(1) );
    p.image(souko_img, 520, 20, 120, 120);
    p.image(omise_img, 40, 540, 100, 100);

  }
}

var myp5 = new p5(s,'ovModelContainer');

