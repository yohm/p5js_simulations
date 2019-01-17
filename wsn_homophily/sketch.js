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
      aging: 1,
      q: 2,
      F: 4
    },
    physics: {
      spring_strength: 0.01,
      spring_length: 44,
      min_distance_spring_strength: 0.1,
      min_distance_spring_length: 55,
    },
    display: {
      node_color: "#555555",
      node_stroke_weight: 0,
      node_radius: 10,
      link_colors: ["#CBE6F3", "#FFF280", "#EDAB90"].map(s=> p.color(s)),
      link_stroke_weight: 0.25,
      link_mid_weight: 200,
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
    wsn = new WSNHomophily(net,options.network.q, options.network.F);

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
          wsn = new WSNHomophily(net,options.network.q, options.network.F);
          if(running) {
            p.loop();
          }
          else {
            p.redraw();
          }
        })
      }
      const link_param = (slider_selector, text_selector, parse_param) => {
        const slider = p.select(slider_selector);
        const on_changed = () => { p.select(text_selector).value(parse_param(slider.value())); };
        slider.changed(on_changed);
        on_changed()
      }
      link_param("#param_p_la", "#param_p_la_text", (v) => {
        return (options.network.p_la = v / 1000.0);
      });
      link_param("#param_p_ga", "#param_p_ga_text", (v) => {
        return (options.network.p_ga = v / 10000.0);
      });
      link_param("#param_dw", "#param_dw_text", (v) => {
        return (options.network.dw = v / 10);
      });
      link_param("#param_ld", "#param_ld_text", (v) => {
        return (options.network.p_ld = v / 10000);
      });
      link_param("#param_nd", "#param_nd_text", (v) => {
        return (options.network.p_nd = v / 10000);
      });
      link_param("#param_aging", "#param_aging_text", (v) => {
        return (options.network.aging = 1.0 - (v/1000.0));
      });
      link_param("#param_q", "#param_q_text", (v) => {
        options.network.q = v;
        wsn = new WSNHomophily(net,options.network.q, options.network.F);
        return v;
      });
      link_param("#param_F", "#param_F_text", (v) => {
        options.network.F = v;
        wsn = new WSNHomophily(net,options.network.q, options.network.F);
        return v;
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
    
    wsn.display();
  }

  class WSNHomophily {
    constructor(net, q, F) {
      this.net = net;
      const n = this.net.size()
      this.traits = new Array(n);
      this.q = q;
      this.F = F;
      for(let i=0; i<n; i++) {
        this.traits[i] = new Array(F).fill().map( ()=> Math.floor(Math.random()*q));
      }

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
      const f = Math.floor(Math.random()*this.F);
      const l_ij = this._edge_selection(ni, null, f);
      if( l_ij === null ) { return; }
      l_ij.update_weight( l_ij.w + dw );
  
      const nj = (l_ij.n1.id === ni.id) ? l_ij.n2 : l_ij.n1;
      const l_jk = this._edge_selection(nj, ni, f);
      if( l_jk === null ) { return; }
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

    _links_with_same_trait(ni, f, exc_id) {
      const i = ni.id;
      const t = this.traits[i][f];
      const links = [];
      ni.for_each_neighbor( (j,l) => {
        if( this.traits[j][f] == t && j !== exc_id ) { links.push(l); }
      });
      return links;
    }

    _edge_selection(ni, n_exc, f) {
      const exc_id = (n_exc ? n_exc.id : -1);
      const links = this._links_with_same_trait(ni, f, exc_id);
      if( n_exc === null ) {
        if( links.length === 0 ) { return null; }
      }
      else {
        if( links.length <= 1 ) { return null; }
      }

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
      const f = Math.floor(Math.random()*this.F);
      const links_at_f = this._links_with_same_trait(ni,f,-1);
      if( links_at_f.length > 0 && Math.random() > options.network.p_ga ) { return; }

      const i = ni.id;
      const cand = [];
      for(let j=0; j<this.net.size(); j++) {
        if( j==i ) { continue; }
        if( this.traits[i][f] == this.traits[j][f] ) { cand.push(j); }
      }
      let r = Math.floor( Math.random() * cand.length );
      const j = cand[r];
      const nj = this.net.node(j);
      if( ! nj.connected_to(ni) ) {
        this.net.add_link(i, j);
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

    display() {
      if( ! this.colors ) {
        const nc = this.q ** this.F;
        const hsls = Array(nc).fill().map( (_,i) => `hsl(${Math.floor(360/nc*i)}, 100%, 80%)` );
        this.colors = hsls.map((s)=>p.color(s));
      }
      const trait_to_color = (trait) => {
        let tid = 0;
        for(let f=0; f<this.F; f++) { tid += this.q**f * trait[f]; }
        return this.colors[tid];
      }
      this.net.for_each_link( (l) => l.display() );
      this.net.for_each_node( (n) => {
        const c = trait_to_color( this.traits[n.id] );
        n.display(c);
      });
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

    display(color, radius) {
      const c = color || options.display.node_color;
      const r = radius || options.display.node_radius;
      p.fill(c);
      p.stroke(options.display.node_stroke_weight);
      p.ellipse(this.x, this.y, r, r);
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
      for(const n of this._nodes ) { n.display(); }
      for(const l of this._links ) { l.display(); }
    }
  }
}

const myp5 = new p5(s,'modelContainer');

