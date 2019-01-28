const _x = (p) => {

  const canvas_s = {x: 640, y:640}; // canvas size

  const params = {
    N0: 50,
    c: 0.2,
    mu: 0.1,
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
    sim = new DG_BS(params);

    const link_param = (slider_selector, text_selector, parse_param) => {
      const slider = p.select(slider_selector);
      const on_changed = () => { p.select(text_selector).value(parse_param(slider.value())); };
      slider.changed(on_changed);
      on_changed();
    }
    link_param("#param_mu", "#param_mu_text", (v) => {
      if(v < -4) {params.mu = 0; }
      else { params.mu = 10**v; }
      sim.update_min();
      return params.mu;
    });
  }

  p.draw = () => {
    p.background("#25283F");
    sim.update();
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
        p.strokeWeight(0.3);
        p.stroke(link_color(w));
        /*
        const dx = (other.pos.x-this.pos.x), dy = (other.pos.y-this.pos.y);
        const r = Math.sqrt(dx*dx+dy*dy);
        let x2 = other.pos.x;
        let y2 = other.pos.y;
        const r_th = 0.02;
        if(r > r_th) {
          x2 = ((r-r_th)*this.pos.x + other.pos.x * r_th ) / r;
          y2 = ((r-r_th)*this.pos.y + other.pos.y * r_th ) / r;
        }
        p.line(canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, canvas_s.x*x2, canvas_s.y*y2 );
        */
        p.line(canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, canvas_s.x*other.pos.x, canvas_s.y*other.pos.y);
      }
    }

    display_node(p) {
      p.fill( node_color(this.f) );
      p.noStroke();
      p.ellipse( canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, 8 );
    }

    display_dead_node(p, radius) {
      p.fill("#FFE600");
      p.ellipse(canvas_s.x*this.pos.x, canvas_s.y*this.pos.y, radius);
    }
  }

  const rand_norm = () => {
    // n = 6 gives a good enough approximation
    return ((Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random()) - 3) / 3;
  }

  class DG_BS {

    constructor(params) {
      this.params = params;
      this.species = new Set();
      this.dying = new Set();
      this.step = this.params.N0;
      for(let i=0; i<this.params.N0; i++) {
        this.species.add(new Species(i));
      }
      for(let si of this.species) {
        for(let sj of this.species) {
          if(si === sj) { continue; }
          if(Math.random() < this.params.c) {
            si.make_incoming_link(sj, rand_norm());
          }
        }
      }

      this.t = 0;
      this.last_event = 0;
      this.update_min();
      this.avalanche = 0;
      this.dt_from_last_extinction = 0;
    }

    update_min() {
      let fmin = 1000.0;
      let min_s = null;
      for(let s of this.species) {
        if(s.f < fmin) {
          fmin = s.f;
          min_s = s;
        }
      }
      this.fmin = fmin;
      this.min_species = min_s;
      this.f_mig = this.params.mu * (this.species.size - this.params.N0);
    }

    update() {
      this.t += 1;
      const dt = (this.t - this.last_event);
      const speed = 0.04; // == f0
      const threshold = speed * Math.log(dt/20);
      if(this.fmin < this.f_mig) {
        if( threshold > this.fmin ) {
          this.extinction(this.min_species);
          this.dt_from_last_extinction += Math.exp(this.fmin/speed);
          if(this.dt_from_last_extinction > 1) { this.avalanche = 1; }
          else { this.avalanche += 1;}
          this.dt_from_last_extinction = 0;
          this.last_event = this.t;
        }
      }
      else {
        if( threshold > this.f_mig ) {
          this.dt_from_last_extinction += Math.exp(this.f_mig/speed);
          this.add_one_species();
          this.step += 1;
          this.last_event = this.t;
        }
      }
    }

    extinction(min_species) {
      min_species.delete_interactions();
      this.species.delete(min_species);
      this.dying.add(min_species);
      min_species.dead_t = this.t;
      this.update_min();
      this.update_avalanche_count();
      this.update_n_species();
    }

    add_one_species() {
      let si = new Species(this.step);
      for(let sj of this.species) {
        if( Math.random() < this.params.c ) {
          si.make_incoming_link(sj, rand_norm());
        }
        if( Math.random() < this.params.c ) {
          sj.make_incoming_link(si, rand_norm());
        }
      }
      this.species.add(si);
      this.update_min();
      this.update_n_species();
    }

    update_avalanche_count() {
      p.select("#avalanche").value(this.avalanche);
    }

    update_n_species() {
      p.select("#n_species").value(this.species.size);
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
      for(let s of this.dying) {
        const r = 24 - 0.5 * (this.t - s.dead_t);
        if(r > 0) { s.display_dead_node(p,r); }
        else { this.dying.delete(s); }
      }
    }
  }
};

const myp5 = new p5(_x,'bsContainer');
