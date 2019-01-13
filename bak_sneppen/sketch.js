const s = (p) => {

  const canvas_s = {x: 640, y:640}; // canvas size

  const params = {
    N: 160
  }

  let sim;

  p.setup = () => {
    p.createCanvas(canvas_s.x, canvas_s.y);
  
    sim = new BakSneppen(params.N);
  }

  p.draw = () => {
    p.background(245);
    sim.update();
    sim.render(p);
  }

  class BakSneppen {

    constructor(N) {
      this.N = N;
      this.dx = canvas_s.x / this.N;
      this.fs = Array(this.N);    // fitnesses
      //Math.seedrandom('seed string');
      for(let i=0; i<this.N; i++) {
        this.fs[i] = 0.5 * Math.random() + 0.5;
      }
      this.t = 0;
      this.last_ex = 0;
      this.update_min();
      this.last_idx = this.fmin_idx;
      this.avalanche = 0;
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


    render(p) {
      for(let i=0; i<this.N; i++) {
        p.fill('#81D674');
        if( i==this.last_idx || (i-1+this.N)%this.N==this.last_idx || (i+1)%this.N==this.last_idx ) {
          p.fill('#E06A3B');
        }
        p.rect(i*this.dx, 0, this.dx, this.fs[i] * canvas_s.y);
        p.line(0, this.threshold*canvas_s.y, canvas_s.x, this.threshold*canvas_s.y);
      }
    }
  }
};

const myp5 = new p5(s,'bsContainer');

