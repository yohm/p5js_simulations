const s = (p) => {

  const canvas_s = {x: 640, y:640}; // canvas size

  const params = {
    N: 160,
    c: 0.05,
  }
  const node_color = (f) => {
    if(f >= 0) {
      return p.lerpColor( p.color('#007FB1'), p.color('#E3E3E3'), f);
    }
    else {
      return p.lerpColor( p.color('#DA5019'), p.color('#E3E3E3'), -f);
    }
  }
  const link_color = (w) => {
    if(w >= 0) {
      return p.lerpColor( p.color('#F9DB57'), p.color('#E3E3E3'), w);
    }
    else {
      return p.lerpColor( p.color('#40BFB0'), p.color('#E3E3E3'), -w);
    }
  }

  let sim;

  p.setup = () => {
    p.createCanvas(canvas_s.x, canvas_s.y);
    sim = new DG_BS(params.N, params.c);
  }

  p.draw = () => {
    p.background('#FFFFFF');
    // sim.update();
    sim.display(p);
  }

  class Species {
    constructor(birth_t) {
      this.id = birth_t; // use birth_t as id
      this.f = 0;
      this.incoming = new Map();
      this.outgoing = new Set();
      this.pos = {x: Math.random(), y: Math.random()};
      this.vel = {x: rand_norm()*0.001, y: rand_norm()*0.001};
    }

    make_incoming_link(other, weight) {
      this.incoming.set(other, weight);
      this.f += weight;
      other.outgoing.add(this);
    }

    delete_interactions() {
      for(let [other,_] of this.incoming) {
        other.outgoing.delete(this);
      }
      for(let other of this.outgoing) {
        const w = other.incoming.get(this);
        other.incoming.delete(this);
        other.f -= w;
      }
    }

    update_pos() {
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      if(this.pos.x < 0 || this.pos.x > 1) {
        this.vel.x = -this.vel.x;
      }
      if(this.pos.y < 0 || this.pos.y > 1) {
        this.vel.y = -this.vel.y;
      }
    }

    display_links(p) {
      for(let [other, w] of this.incoming) {
        const dx = (other.pos.x-this.pos.x), dy = (other.pos.y-this.pos.y);
        const r = Math.sqrt(dx*dx+dy*dy);
        let x2 = other.pos.x;
        let y2 = other.pos.y;
        const r_th = 0.015;
        if(r > r_th) {
          x2 = ((r-r_th)*this.pos.x + other.pos.x * r_th ) / r;
          y2 = ((r-r_th)*this.pos.y + other.pos.y * r_th ) / r;
        }
        p.stroke(link_color(w));
        p.line(canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, canvas_s.x*x2, canvas_s.y*y2 );
      }
    }

    display_node(p) {
      p.fill( node_color(this.f) );
      p.ellipse( canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, 8 );
    }
  }

  const rand_norm = () => {
    // n = 6 gives a good enough approximation
    return ((Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random()) - 3) / 3;
  }

  class DG_BS {

    constructor(N,c) {
      this.N = N;
      this.c = c;
      this.dx = canvas_s.x / this.N;
      this.species = new Array(this.N);
      this.step = this.N;
      for(let i=0; i<this.N; i++) {
        this.species[i] = new Species(i);
      }
      for(let i=0; i<this.N; i++) {
        for(let j=0; j<this.N; j++) {
          if(Math.random() < this.c) {
            this.species[i].make_incoming_link(this.species[j], rand_norm());
          }
        }
      }

      this.t = 0;
      /*
      this.last_ex = 0;
      this.update_min();
      this.last_idx = this.fmin_idx;
      this.avalanche = 0;
      */
    }

    update_min() {
      let fmin = 1.0;
      let idx = 0;
      for( let i=0; i<this.N; i++) {
        if( this.fs[i] < fmin ) {
          fmin = this.fs[i];
          idx = i;
        }
      }
      this.fmin = fmin;
      this.fmin_idx = idx;
    }

    update() {
      this.t += 1;
      const dt = (this.t - this.last_ex);
      const speed = 0.11;
      this.threshold = speed * Math.log(dt);
      if( this.threshold > this.fmin ) {
        this.extinction(this.fmin_idx);
      }
    }

    near(i,j,dx) {
      let b = (i>j)?i:j;
      let s = (i>j)?j:i;
      if( (b-s) < dx || (s+this.N-b) < dx ) {
        return true;
      }
      else {
        return false;
      }
    }

    extinction(i) {
      this.fs[i] = Math.random();
      this.fs[(i+1)%this.N] = Math.random();
      this.fs[(i-1+this.N)%this.N] = Math.random();
      if( this.near(this.last_idx,i,4) ) {
        this.avalanche += 1;
      }
      else {
        this.avalanche = 1;
      }
      this.update_avalanche_count();
      this.update_min();
      this.last_ex = this.t;
      this.last_idx = i;
    }

    update_avalanche_count() {
      p.select("#avalanche").value(this.avalanche);
    }

    display(p) {
      for(let s of this.species) {
        s.update_pos();
      }
      for(let s of this.species) {
        s.display_links(p);
      }
      for(let s of this.species) {
        s.display_node(p);
      }
    }
  }
};

const myp5 = new p5(s,'bsContainer');
