var s = function(p) {

  var canvas_s = {x: 640, y:640}; // canvas size

  var params = {
    p: 0.5,
    L: 160
  }

  var lattice;

  p.setup = function() {
    p.createCanvas(canvas_s.x, canvas_s.y);
  
    lattice = new Percolation(params.L, params.L);
    p.noLoop();
    p.stroke(200);
    p.strokeWeight(0.8);

    var slider = p.select("#param_p");
    slider.changed( () => {
      console.log(slider.value());
      lattice.refresh_sites( slider.value()/100.0 );
      p.redraw();
    });
  }

  p.draw = function() {
    p.background(245);
    lattice.render(p);
  }

  class Percolation {

    constructor(lx, ly) {
      this.lx = lx;
      this.ly = ly;
      this.dx = canvas_s.x / this.lx;
      this.dy = canvas_s.y / this.ly;
      this.sites = [];    // 0: unoccupied, -1: occupied but not labeled, >0: labeled
      this.rs = [];
      Math.seedrandom('seed string');
      for(var i=0; i<this.ly; i++) {
        let a = Array(this.lx);
        a.fill(0);
        this.sites.push(a);
        let r = Array(this.lx);
        for(var x=0; x<this.lx; x++) {
          r[x] = Math.random();
        }
        this.rs.push(r);
      }

      this.refresh_sites(0.3);

      this.colors = Array(10);
      for( var i=0; i<this.colors.length; i++ ) {
        this.colors[i] = 'hsl(' + i*10 + ', 100%, 85%)';
      }
    }

    refresh_sites(th) {
      for(var y=0; y<this.ly; y++) {
        for(var x=0; x<this.lx; x++) {
          this.sites[y][x] = ( this.rs[y][x] < th ) ? -1 : 0;
        }
      }
      this.connected_component_labeling();
      this.largest_l = this.find_largest_connected_component();
    }

    connected_component_labeling() {
      var label = 1;
      for(var y=0; y<this.ly; y++) {
        for(var x=0; x<this.lx; x++) {
          if( this.sites[y][x] == -1 ) { this.labeling(x, y, label); label += 1; }
        }
      }
    }

    labeling(x, y, l) {
      var q = [];
      let traverse_neighbors = (x,y) => {
        this.sites[y][x] = l;
        let right = (x+1)%this.lx
        if( this.sites[y][right] == -1 ) { q.push( [right,y] ); }
        let left = (x-1+this.lx)%this.lx;
        if( this.sites[y][left] == -1 ) { q.push( [left,y] ); }
        let top = (y+1)%this.ly;
        if( this.sites[top][x] == -1 ) { q.push( [x,top] ); }
        let bottom = (y-1+this.ly)%this.ly;
        if( this.sites[bottom][x] == -1 ) { q.push( [x,bottom] ); }
      }
      traverse_neighbors(x, y);
      while( q.length > 0 ) {
        let xy = q.pop();
        traverse_neighbors( xy[0], xy[1] );
      }
    }

    find_largest_connected_component() {
      let sizes = {};
      for(var y=0; y<this.ly; y++) {
        for(var x=0; x<this.lx; x++) {
          let l = this.sites[y][x];
          if( l > 0 ) {
            sizes[l] = (sizes[l]|0) + 1;
          }
        }
      }

      var largest = 0;
      var largest_l = 0;
      for(let l in sizes) {
        if( sizes[l] > largest ) {
          largest_l = l;
          largest = sizes[l];
        }
      }
      return largest_l;
    }


    render(p) {
      for(var y=0; y<this.ly; y++) {
        for(var x=0; x<this.lx; x++) {
          if( this.sites[y][x] > 0 ) {
            let c = this.colors[ this.sites[y][x] % this.colors.length ];
            p.fill(c);
            if( this.sites[y][x] == this.largest_l ) { p.fill('black'); }
            p.rect(x*this.dx, y*this.dy, this.dx, this.dy);
          }
        }
      }
    }
  }
}

var myp5 = new p5(s,'percolationContainer');

