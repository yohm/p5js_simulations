var s = function(p) {

  var canvas_s = {x: 640, y:640}; // canvas size
  var legend_s = {x: 120, y:640}; // size of legend area
  var running_flag = false;
  var sim;

  p.setup = function() {
    Math.seedrandom('seed string');
    p.frameRate(4);
    p.createCanvas(canvas_s.x + legend_s.x, canvas_s.y);
    var net = new Network(1000);
    net.add_geographic_random_links( 1.0, 0.033 );
    sim = new WattsModel(net);
    show_legends();
    var start = p.select("#start_button");
    var slider = p.select("#param_init_i");
    start.mouseClicked( () => {
      if(running_flag == false) {
        running_flag = true;
        start.html("<i class=\"fa fa-spinner fa-spin\"></i> シミュレーション中");
        start.attribute("disabled", true);
        slider.attribute("disabled", true);
        sim.reset_state();
        sim.params.init_i = Number( p.select("#param_init_i").value() );
        sim.set_initial_state();
        redraw_net(p);
      }
    });
    slider.changed( () => {
      sim.reset_state();
      sim.params.init_i = Number( p.select("#param_init_i").value() );
      sim.set_initial_state();
      redraw_net(p);
    });
    redraw_net(p);
  }

  function redraw_net(p) {
    p.noStroke();
    p.fill( p.color("#FFFFFF") );
    p.rect(0, 0, canvas_s.x, canvas_s.y);
    sim.net.display(p);
  }


  p.draw = function() {
    if( running_flag ) {
      let done = sim.update();
      if( done ) {
        running_flag = false;
        var start = p.select("#start_button");
        var slider = p.select("#param_init_i");
        start.html("<i class=\"fa fa-play\"></i> 再実行する" );
        start.removeAttribute("disabled");
        slider.removeAttribute("disabled");
      }
    }
    sim.display(p);
    p.select("#num_i").value( sim.num_infected() );
  }

  var node_colors = ["#9ACDE7", "#DA5019"];
  var node_states = ["なし", "tweet"];

  function show_legends() {
    var origin = {x: canvas_s.x, y: 0};
    for( let i in node_colors ) {
      var c = p.color( node_colors[i] );
      p.noStroke();
      p.fill(c);
      p.ellipse( canvas_s.x + 20, i*30 + 20, 8, 8 );
      p.fill("#000000");
      p.textSize(20);
      p.textAlign(p.LEFT, p.CENTER);
      p.text( node_states[i], canvas_s.x + 28, i*30+20);
    }
  }

  class Node {
    constructor(x,y) {
      this.x = x;
      this.y = y;
      this.neighbors = [];
      this.state = 0;  // 0:susceptible, 1: infected
    }

    display(p) {
      var c = p.color( node_colors[this.state] );
      p.stroke("#E3E3E3");
      p.fill(c);
      let s = (this.state == 1) ? 8 : 6;
      p.ellipse( this.x*canvas_s.x, this.y*canvas_s.y, s, s);
    }

    distance(other) {
      var dx = this.x - other.x;
      var dy = this.y - other.y;
      return Math.sqrt(dx*dx+dy*dy);
    }
  }

  class Link {
    constructor(_n1,_n2) {
      this.n1 = _n1;
      this.n2 = _n2;
    }

    display(p) {
      p.stroke("#E3E3E3");
      var dx = Math.abs(this.n1.x-this.n2.x);
      var dy = Math.abs(this.n1.y-this.n2.y);
      if( dx >= 0.5 && dy >= 0.5 ) {
        var n1_mirror_x = (this.n1.x > 0.5) ? this.n1.x-1.0 : this.n1.x+1.0;
        var n2_mirror_x = (this.n2.x > 0.5) ? this.n2.x-1.0 : this.n2.x+1.0;
        var n1_mirror_y = (this.n1.y > 0.5) ? this.n1.y-1.0 : this.n1.y+1.0;
        var n2_mirror_y = (this.n2.y > 0.5) ? this.n2.y-1.0 : this.n2.y+1.0;
        this._draw_line(p, this.n1.x, this.n1.y, n2_mirror_x, n2_mirror_y);
        this._draw_line(p, this.n2.x, this.n2.y, n1_mirror_x, n1_mirror_y);
        this._draw_line(p, this.n2.x, n2_mirror_y, n1_mirror_x, this.n1.y);
        this._draw_line(p, this.n1.x, n1_mirror_y, n2_mirror_x, this.n2.y);
      }
      else if( dx >= 0.5 ) {
        var n1_mirror_x = (this.n1.x > 0.5) ? this.n1.x-1.0 : this.n1.x+1.0;
        var n2_mirror_x = (this.n2.x > 0.5) ? this.n2.x-1.0 : this.n2.x+1.0;
        this._draw_line(p, this.n1.x, this.n1.y, n2_mirror_x, this.n2.y);
        this._draw_line(p, this.n2.x, this.n2.y, n1_mirror_x, this.n1.y);
      }
      else if( dy >= 0.5 ) {
        var n1_mirror_y = (this.n1.y > 0.5) ? this.n1.y-1.0 : this.n1.y+1.0;
        var n2_mirror_y = (this.n2.y > 0.5) ? this.n2.y-1.0 : this.n2.y+1.0;
        this._draw_line(p, this.n1.x, this.n1.y, this.n2.x, n2_mirror_y);
        this._draw_line(p, this.n2.x, this.n2.y, this.n1.x, n1_mirror_y);
      }
      else {
        this._draw_line(p, this.n1.x, this.n1.y, this.n2.x, this.n2.y);
      }
    }

    _draw_line(p,x1,y1,x2,y2) {
      p.line(x1*canvas_s.x, y1*canvas_s.y, x2*canvas_s.x, y2*canvas_s.y);
    }
  }

  class Network {
    constructor(n) {
      this.nodes = [];
      this.links = [];
      for( var i=0; i<n; i++) {
        var node = new Node( Math.random(), Math.random() );
        this.nodes.push(node);
      }
    }

    add_link(i, j) {
      var n1 = this.nodes[i];
      var n2 = this.nodes[j];
      n1.neighbors.push(n2);
      n2.neighbors.push(n1);
      var l = new Link(n1,n2);
      this.links.push(l);
    }

    add_geographic_random_links(alpha, r) {
      for( var i=0; i < this.nodes.length; i++ ) {
        var ni = this.nodes[i];
        for( var j=0; j < this.nodes.length; j++ ) {
          if( i >= j ) { continue; }
          var nj = this.nodes[j];
          var d = ni.distance(nj);
          if( Math.random() < Math.exp( - d / r ) * alpha ) {
            this.add_link(i,j);
          }
        }
      }
    }

    display(p) {
      for( var i=0; i < this.links.length; i++ ) {
        this.links[i].display(p);
      }
      for( var i=0; i < this.nodes.length; i++ ) {
        this.nodes[i].display(p);
      }
    }
  }

  class WattsModel {
    constructor(net) {
      this.net = net;
      this.params = {
        phi: 0.334,
        init_i: 10
      }
      this.t = 0;
    }

    reset_state() {
      for( let ni of this.net.nodes ) {
        ni.state = 0;
      }
      this.t = 0;
    }

    set_initial_state() {
      var nodes = this.net.nodes;
      for( let i=0; i < this.params.init_i; i++) {
        nodes[i].state = 1;
      }
    }

    num_infected() {
      let count = 0;
      for( let ni of this.net.nodes ) {
        if( ni.state == 1 ) { count += 1; }
      }
      return count;
    }

    update() {
      let done = true;
      for( let i in this.net.nodes ) {
        let ni = this.net.nodes[i];
        if( ni.state == 0 ) {
          let k = ni.neighbors.length;
          let num_i = 0;
          for( let nj of ni.neighbors ) {
            if( nj.state == 1 ) {
              num_i += 1;
            }
          }
          if( num_i / k > this.params.phi ) {
            ni.state = 1;
            done = false;
          }
        }
      }
      return done;
    }

    count_nodes( state ) {
      var count = 0;
      for( let n of this.net.nodes ) {
        if( n.state == state ) {
          count += 1;
        }
      }
      return count;
    }

    display(p) {
      for( let ni of this.net.nodes ) {
        ni.display(p);
      }
    }
  }
}

var myp5 = new p5(s,'modelContainer');

