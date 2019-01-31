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
    sim.display(p);
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
      const speed = 0.075;
      const dt0 = 0.08;
      this.threshold = speed * Math.log(dt/dt0);
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
      const positions = this.fs.map( (f,idx) => {
        return [(idx+0.5)*this.dx, (1.0-this.fs[idx])*canvas_s.y];
      });

      {
        p.fill('#F9DFD5');
        p.noStroke();
        p.rect( this.dx*(this.last_idx-1), 0, 3*this.dx, canvas_s.y);
      }
      p.stroke(p.color('#DEDFEF'));
      for(let i=0; i<this.N-1; i++) {
        const p1 = positions[i];
        const p2 = positions[(i+1)%this.N];
        p.line(p1[0], p1[1], p2[0], p2[1]);
      }

      for(let i=0; i<this.N; i++) {
        if( i==this.last_idx || (i-1+this.N)%this.N==this.last_idx || (i+1)%this.N==this.last_idx ) {
          p.fill('#E06A3B');
        } else {
          p.fill('#81D674');
        }
        p.ellipse(positions[i][0], positions[i][1], 8, 8);
      }
      const ty = (1.0-this.threshold)*canvas_s.y;
      p.line(0, ty, canvas_s.x, ty);
    }
  }
};

const myp5 = new p5(s,'bsContainer');
