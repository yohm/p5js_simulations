var s = function(p) {

  var canvas_s = {x: 640, y:640}; // canvas size

  var params = {
    align: 0.0,
    separation: 0.0,
    cohesion: 0.0,
    num_boids: 100
  }

  var flock;

  function set_callbacks() {
    function set_checkbox( checkbox_id, callback ) {
      var checkbox = p.select(checkbox_id);
      checkbox.changed( () => {
        callback( checkbox.checked() );
      });
      return checkbox;
    }
    set_checkbox('#check_cohesion', (b) => { params.cohesion = b ? 1.0 : 0.0 } );
    set_checkbox('#check_separation', (b) => { params.separation = b ? 1.5 : 0.0 } );
    set_checkbox('#check_align', (b) => { params.align = b ? 1.0 : 0.0 } );
  }

  p.setup = function() {
    p.createCanvas(canvas_s.x, canvas_s.y);
    set_callbacks();
  
    flock = new Flock();
    // Add an initial set of boids into the system
    for (var i = 0; i < params.num_boids; i++) {
      var b = new Boid(Math.random()*p.width,Math.random()*p.height);
      flock.addBoid(b);
    }
  }

  p.draw = function() {
    p.background(51);
    flock.run();
  }

  class Flock {

    constructor() {
      this.boids = [];
    }

    run() {
      for (var i = 0; i < this.boids.length; i++) {
        this.boids[i].run(this.boids);  // Passing the entire list of boids to each boid individually
      }
    }

    addBoid(b) {
      this.boids.push(b);
    }
  }

  class Boid {
    
    constructor(x,y) {
      this.acceleration = p.createVector(0,0);
      this.velocity = p.createVector(p.random(-1,1),p.random(-1,1));
      this.position = p.createVector(x,y);
      this.r = 3.0;
      this.maxspeed = 3;    // Maximum speed
      this.maxforce = 0.05; // Maximum steering force
    }

    run(boids) {
      this.flock(boids);
      this.update();
      this.borders();
      this.render();
    }

    applyForce(force) {
      this.acceleration.add(force);
    }

    flock(boids) {
      var sep = this.separate(boids);   // Separation
      var ali = this.align(boids);      // Alignment
      var coh = this.cohesion(boids);   // Cohesion
      // Arbitrarily weight these forces
      sep.mult(params.separation);
      ali.mult(params.align);
      coh.mult(params.cohesion);
      // Add the force vectors to acceleration
      this.applyForce(sep);
      this.applyForce(ali);
      this.applyForce(coh);
    }

    update() {
      // Update velocity
      this.velocity.add(this.acceleration);
      // Limit speed
      this.velocity.limit(this.maxspeed);
      this.position.add(this.velocity);
      // Reset accelertion to 0 each cycle
      this.acceleration.mult(0);
    }

    seek(target) {
      var desired = p5.Vector.sub(target,this.position);  // A vector pointing from the location to the target
      // Normalize desired and scale to maximum speed
      desired.normalize();
      desired.mult(this.maxspeed);
      // Steering = Desired minus Velocity
      var steer = p5.Vector.sub(desired,this.velocity);
      steer.limit(this.maxforce);  // Limit to maximum steering force
      return steer;
    }

    render() {
      // Draw a triangle rotated in the direction of velocity
      var theta = this.velocity.heading() + p.radians(90);
      p.fill(127);
      p.stroke(200);
      p.push();
      p.translate(this.position.x,this.position.y);
      p.rotate(theta);
      p.beginShape();
      p.vertex(0, -this.r*2);
      p.vertex(-this.r, this.r*2);
      p.vertex(this.r, this.r*2);
      p.endShape(p.CLOSE);
      p.pop();
    }

    borders() {
      if (this.position.x < -this.r)  this.position.x = p.width +this.r;
      if (this.position.y < -this.r)  this.position.y = p.height+this.r;
      if (this.position.x > p.width +this.r) this.position.x = -this.r;
      if (this.position.y > p.height+this.r) this.position.y = -this.r;
    }

    separate(boids) {
      var desiredseparation = 25.0;
      var steer = p.createVector(0,0);
      var count = 0;
      // For every boid in the system, check if it's too close
      for (var i = 0; i < boids.length; i++) {
        var d = p5.Vector.dist(this.position,boids[i].position);
        // If the distance is greater than 0 and less than an arbitrary amount (0 when you are yourself)
        if ((d > 0) && (d < desiredseparation)) {
          // Calculate vector pointing away from neighbor
          var diff = p5.Vector.sub(this.position,boids[i].position);
          diff.normalize();
          diff.div(d);        // Weight by distance
          steer.add(diff);
          count++;            // Keep track of how many
        }
      }
      // Average -- divide by how many
      if (count > 0) {
        steer.div(count);
      }

      // As long as the vector is greater than 0
      if (steer.mag() > 0) {
        // Implement Reynolds: Steering = Desired - Velocity
        steer.normalize();
        steer.mult(this.maxspeed);
        steer.sub(this.velocity);
        steer.limit(this.maxforce);
      }
      return steer;
    }

    align(boids) {
      var neighbordist = 50;
      var sum = p.createVector(0,0);
      var count = 0;
      for (var i = 0; i < boids.length; i++) {
        var d = p5.Vector.dist(this.position,boids[i].position);
        if ((d > 0) && (d < neighbordist)) {
          sum.add(boids[i].velocity);
          count++;
        }
      }
      if (count > 0) {
        sum.div(count);
        sum.normalize();
        sum.mult(this.maxspeed);
        var steer = p5.Vector.sub(sum,this.velocity);
        steer.limit(this.maxforce);
        return steer;
      } else {
        return p.createVector(0,0);
      }
    }

    cohesion(boids) {
      var neighbordist = 50;
      var sum = p.createVector(0,0);   // Start with empty vector to accumulate all locations
      var count = 0;
      for (var i = 0; i < boids.length; i++) {
        var d = p5.Vector.dist(this.position,boids[i].position);
        if ((d > 0) && (d < neighbordist)) {
          sum.add(boids[i].position); // Add location
          count++;
        }
      }
      if (count > 0) {
        sum.div(count);
        return this.seek(sum);  // Steer towards the location
      } else {
        return p.createVector(0,0);
      }
    }
  }
}

var myp5 = new p5(s,'boidModelContainer');

