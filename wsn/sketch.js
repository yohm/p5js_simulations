const s = (p) => {

  const VerletPhysics2D = toxi.physics2d.VerletPhysics2D,
    VerletParticle2D = toxi.physics2d.VerletParticle2D,
    VerletSpring2D = toxi.physics2d.VerletSpring2D,
    VerletMinDistanceSpring2D = toxi.physics2d.VerletMinDistanceSpring2D,
    Vec2D = toxi.geom.Vec2D,
    Rect = toxi.geom.Rect;

  const options = {
    network: {
      num_nodes: 200,
      p_la: 0.05,
      p_ga: 0.0005,
      p_ld: 0.003,
      p_nd: 0.001,
      dw: 1,
      aging: 1
    },
    physics: {
      spring_strength: 0.01,
      spring_length: 44,
      min_distance_spring_strength: 0.1,
      min_distance_spring_length: 55,
    },
    display: {
      node_color: "#BEC7D7",
      node_stroke_weight: 0,
      node_radius: 8,
      link_colors: ["#CBE6F3", "#FFF280", "#EDAB90"].map(s=> p.color(s)),
      link_stroke_weight: 0.25,
      link_mid_weight: 50,
      background_color: "#25283F",
    }
  };

  const canvas_s = {x: 640, y:640}; // canvas size

  let wsn,net,physics;

  p.setup = () => {
    p.frameRate(15);
    p.createCanvas(canvas_s.x, canvas_s.y);
    physics = new VerletPhysics2D();
    physics.setWorldBounds(new Rect(10, 10, canvas_s.x-20, canvas_s.y-20));
    net = new Network(options.network.num_nodes);
    wsn = new WSN(net);

    { // setting callbacks
      {
        const btn = p.select("#start_button");
        const stat = p.select("#running_status");
        let running = false;
        const onclicked = () => {
          if(running) {
            btn.html('<i class="fa fa-play"></i>start');
            running = false;
            stat.html('')
            p.noLoop();
          }
          else {
            btn.html('<i class="fa fa-pause"></i>pause');
            running = true;
            stat.html('<i class="fa fa-spinner fa-spin"></i>')
            p.loop();
          }
        }
        btn.mouseClicked( onclicked );
        onclicked();

        const rbtn = p.select("#reset_button");
        rbtn.mouseClicked( () => {
          p.noLoop();
          net.clear_links();
          wsn = new WSN(net);
          if(running) {
            p.loop();
          }
          else {
            p.redraw();
          }
        });

        const sbtn = p.select("#snapshot_button");
        sbtn.mouseClicked( () => {
          p.saveCanvas("out","png");
        });
      }
      const link_param = (slider_selector, text_selector, parse_param) => {
        const slider = p.select(slider_selector);
        const on_changed = () => { p.select(text_selector).value(parse_param(slider.value())); };
        slider.changed(on_changed);
        on_changed();
        const setter = (val) => {
          slider.value(val);
          on_changed();
        }
        return setter;
      }
      const set_p_la = link_param("#param_p_la", "#param_p_la_text", (v) => {
        return (options.network.p_la = v / 1000.0);
      });
      const set_p_ga = link_param("#param_p_ga", "#param_p_ga_text", (v) => {
        return (options.network.p_ga = v / 10000.0);
      });
      const set_dw = link_param("#param_dw", "#param_dw_text", (v) => {
        return (options.network.dw = v / 10);
      });
      const set_ld = link_param("#param_ld", "#param_ld_text", (v) => {
        return (options.network.p_ld = v / 10000);
      });
      const set_nd = link_param("#param_nd", "#param_nd_text", (v) => {
        return (options.network.p_nd = v / 10000);
      });
      const set_aging = link_param("#param_aging", "#param_aging_text", (v) => {
        return (options.network.aging = 1.0 - (v/1000.0));
      });

      const set_param = (target) => {
        set_p_la(target.p_la);
        set_p_ga(target.p_ga);
        set_dw(target.dw);
        set_ld(target.ld);
        set_nd(target.nd);
        set_aging(target.aging);
      }
      p.select("#set_dw_0").mouseClicked( () => {
        const target = { p_ga: 5, p_la: 50, dw: 0, ld: 50, nd: 0, aging: 0 }
        set_param(target);
      });
      p.select("#set_dw_1").mouseClicked( () => {
        const target = { p_ga: 5, p_la: 50, dw: 10, ld: 50, nd: 0, aging: 0 }
        set_param(target);
      });
      p.select("#set_ld_params").mouseClicked( () => {
        const target = { p_ga: 5, p_la: 50, dw: 10, ld: 50, nd: 0, aging: 0 }
        set_param(target);
      });
      p.select("#set_nd_params").mouseClicked( () => {
        const target = { p_ga: 5, p_la: 50, dw: 10, ld: 0, nd: 20, aging: 0 }
        set_param(target);
      });
      p.select("#set_aging_params").mouseClicked( () => {
        const target = { p_ga: 5, p_la: 50, dw: 10, ld: 0, nd: 0, aging: 10 }
        set_param(target);
      });
    }
  }

  p.draw = () => {
    for(let f=0; f<3; f++) {
      for(let i=0; i<5; i++) {
        wsn.update();
      }
      physics.update();
    }
    p.background(options.display.background_color);
    
    net.display();
    console.log( net.average_degree() );
  }

  class WSN {
    constructor(net) {
      this.net = net;
    }

    update() {
      this.net.for_each_node( (n) => {
        this._LA(n);
      });
      this.net.for_each_node( (n) => {
        this._GA(n);
      });
      this._LD();
      this.net.for_each_node( (n) => {
        this._ND(n);
      });
      this._LinkAging();
    }

    _LA(ni) {
      const dw = options.network.dw;
      if( ni.degree() === 0 ) { return; }
      const l_ij = this._edge_selection(ni, null);
      l_ij.update_weight( l_ij.w + dw );
  
      const nj = (l_ij.n1.id === ni.id) ? l_ij.n2 : l_ij.n1;
      if( nj.degree() === 1 ) { return; }
      const l_jk = this._edge_selection(nj, ni);
      l_jk.update_weight( l_jk.w + dw );
  
      const nk = (l_jk.n1.id === nj.id) ? l_jk.n2 : l_jk.n1;
      const l_ik = ni.get_link(nk);
      if( l_ik ) {
        l_ik.update_weight( l_ik.w + dw );
      }
      else {
        if( Math.random() < options.network.p_la ) {
          this.net.add_link(ni.id, nk.id, 1);
        }
      }
    }

    _edge_selection(ni, n_exc) {
      if( n_exc === null ) {
        if( ni.degree() === 0 ) { return null; }
      }
      else {
        if( ni.degree() <= 1 ) { return null; }
      }

      const exc_id = (n_exc ? n_exc.id : -1);
      const links = [];
      ni.for_each_neighbor( (j,l) => {
        if( j !== exc_id ) { links.push(l); }
      });
      const weights = links.map( (l) => l.w );
      const w_sum = weights.reduce((mem,w)=>mem+w);

      let r = Math.random() * w_sum;
      for(let i=0; i<weights.length; i++) {
        r -= weights[i];
        if( r <= 0.0 ) { return links[i]; }
      }
      throw new Error("must not happen");
    }

    _GA(ni) {
      if( ni.degree() > 0 && Math.random() > options.network.p_ga ) { return; }
      const n = this.net.size();
      let j = Math.floor( Math.random() * (n-1) );
      if( j >= ni.id ) { j += 1; }
      const nj = this.net.node(j);
      if( ! nj.connected_to(ni) ) {
        this.net.add_link(ni.id, nj.id);
      }
    }

    _LD() {
      const removing_links = [];
      this.net.for_each_link( (l) => {
        if( Math.random() < options.network.p_ld ) {
          removing_links.push( [l.n1.id, l.n2.id] );
        }
      });
      for(let ij of removing_links) {
        this.net.remove_link( ij[0], ij[1] );
      }
    }

    _ND(ni) {
      if( Math.random() < options.network.p_nd ) {
        this.net.remove_links_around_node(ni.id);
      }
    }

    _LinkAging() {
      const removing_links = [];
      const th = 0.9;
      this.net.for_each_link( (l) => {
        l.update_weight(l.w*options.network.aging);
        if(l.w < th) {
          removing_links.push( [l.n1.id, l.n2.id] );
        }
      });
      for(let ij of removing_links) {
        this.net.remove_link( ij[0], ij[1] );
      }
    }
  }

  class Node extends VerletParticle2D {
    constructor(_id, pos) {
      super(pos);
      this.id = _id;
      this._edges = new Map();  // (id, Link)
    }

    _add_edge(other_node, link) {
      if(this.connected_to(other_node.id)) { throw new Error("must not happen"); }
      this._edges.set(other_node.id, link);
    }
    _delete_edge(other) { this._edges.delete(other.id); }
    _delete_edge_all() { this._edges = new Map(); }

    for_each_neighbor(fn) {
      for(let [id,link] of this._edges) { fn(id,link); }
    }

    connected_to(other) {
      return this._edges.has(other.id);
    }

    get_link(other) {
      return this._edges.get(other.id);
    }

    degree() {
      return this._edges.size;
    }

    display() {
      p.fill(options.display.node_color);
      p.stroke(options.display.node_stroke_weight);
      p.ellipse(this.x, this.y, options.display.node_radius, options.display.node_radius);
    }
  }

  class Link extends VerletSpring2D {
    constructor(ni, nj, weight) {
      super(ni, nj, options.physics.spring_length, options.physics.spring_strength);
      if(ni.id < nj.id) { this.n1 = ni; this.n2 = nj; }
      else { this.n1 = nj; this.n2 = ni; }
      this.w = weight;
      this._update_spring();
    }

    _update_spring() {
      const s = options.physics.spring_strength * Math.log(this.w+1);
      this.setStrength(s);
    }

    update_weight(w) { this.w = w; this._update_spring(); }

    display() {
      const c = this._calc_color();
      p.stroke(c);
      p.strokeWeight(options.display.link_stroke_weight*Math.log(this.w+1));
      p.line(this.n1.x, this.n1.y, this.n2.x, this.n2.y);
    }

    _calc_color() {
      const w_m = options.display.link_mid_weight;
      if(this.w < w_m) {
        const w = this.w / w_m;
        return p.lerpColor( options.display.link_colors[0], options.display.link_colors[1], w )
      }
      else {
        const w = (this.w-w_m) / w_m;
        return p.lerpColor( options.display.link_colors[1], options.display.link_colors[2], w )
      }
    }
  }

  class Network {
    constructor(n) {
      this._links = [];
      const center = new Vec2D(canvas_s.x/2, canvas_s.y/2);
      this._nodes = new Array(n);
      for(let i=0; i<n; i++) {
        this._nodes[i] = new Node(i, center.add(Vec2D.randomVector()) );
      }
      for( let i=0; i<this._nodes.length; i++) {
        for( let j=i+1; j<this._nodes.length; j++) {
          this._attach_repulsion_spring( this._nodes[i], this._nodes[j] );
        }
      }
    }

    _attach_repulsion_spring(ni, nj) {
      const repulsion = new VerletMinDistanceSpring2D(ni,nj, options.physics.min_distance_spring_length, options.physics.min_distance_spring_strength);
      physics.addSpring(repulsion);
    }

    _is_consistent() {
      let flag = true;
      this.for_each_link( (l) => {
        if( ! l.n1.connected_to(l.n2) || ! l.n2.connected_to(l.n1) ) {
          flag = false;
        }
        if( l.n1 !== this._nodes[l.n1.id] || l.n2 !== this._nodes[l.n2.id] ) {
          flag = false;
        }
      });
      return flag;
    }

    size() { return this._nodes.length; }
    node(i) { return this._nodes[i]; }
    average_degree() {
      let k = 0.0;
      for(let n of this._nodes ) { k += n.degree(); }
      k /= this._nodes.length;
      return k;
    }

    add_link(i, j, w = 1) {
      const ni = this.node(i), nj = this.node(j);
      if( ni.connected_to(nj) ) { throw new Error(`link ${i}-${j} already exists`); }
      const s = physics.getSpring(ni,nj);
      if( s !== null ) { physics.removeSpring(s); }

      const l = new Link(ni, nj, w);
      this._links.push(l);
      physics.addSpring(l);
      ni._add_edge(nj, l);
      nj._add_edge(ni, l);
      // if( ! this._is_consistent() ) {
      //   throw new Error("must not happen");
      // }
      return l;
    }

    link(i, j) { return this.node(i).get_link( this.node(j) ); }

    remove_link(i, j) {
      const l = this.link(i,j)
      if(!l) { throw new Error(`link ${i}-${j} does not exists`); }
      const n1 = l.n1, n2 = l.n2;
      n1._delete_edge(n2);
      n2._delete_edge(n1);
      physics.removeSpring(l);
      this._attach_repulsion_spring(n1,n2);
      this._links = this._links.filter( (x)=> x !== l );
      // if( ! this._is_consistent() ) {
      //   throw new Error("must not happen");
      // }
    }

    remove_links_around_node(i) {
      const ni = this.node(i);
      const removing_links = [];
      ni.for_each_neighbor( (j,l) => {
        const nj = this.node(j);
        nj._delete_edge(ni);
        removing_links.push(l);
        physics.removeSpring(l);
        this._attach_repulsion_spring(ni,nj);
      });
      this._links = this._links.filter( (l) => !removing_links.includes(l) )
      ni._delete_edge_all();

      // if( ! this._is_consistent() ) {
      //   throw new Error("must not happen");
      // }
    }

    clear_links() {
      this.for_each_node( (n) => {
        this.remove_links_around_node(n.id);
      });
    }

    for_each_node(fn) {
      for(let n of this._nodes ) { fn(n); }
    }

    for_each_link(fn) {
      for(let l of this._links ) { fn(l); }
    }

    display() {
      for(const l of this._links ) { l.display(); }
      for(const n of this._nodes ) { n.display(); }
    }
  }
}

const myp5 = new p5(s,'modelContainer');

