const s = (p) => {

  const VerletPhysics2D = toxi.physics2d.VerletPhysics2D,
    VerletParticle2D = toxi.physics2d.VerletParticle2D,
    VerletSpring2D = toxi.physics2d.VerletSpring2D,
    VerletMinDistanceSpring2D = toxi.physics2d.VerletMinDistanceSpring2D,
    Vec2D = toxi.geom.Vec2D,
    Rect = toxi.geom.Rect;

  const options = {
    numNodes: 10,
    particleRadius: 4,
    linkStrokeWeight: 1,
    springStrength: 0.01,
    springLength: 50,
    minDistanceSpringStrength: 0.05,
    minDistanceSpringLength: 30,
  };

  const canvas_s = {x: 640, y:640}; // canvas size

  let wsn,net,physics;

  p.setup = () => {
    p.createCanvas(canvas_s.x, canvas_s.y);
    physics = new VerletPhysics2D();
    physics.setWorldBounds(new Rect(10, 10, canvas_s.x-20, canvas_s.y-20));
    makeGraph();
    wsn = new WSN(net);

    const check = p.select("#simulationUpdate");
    check.changed( () => {
      if( check.checked() ) { p.loop(); }
      else { p.noLoop(); }
    });
  }

  const makeGraph = () => {
    physics.clear();
    const n = options.numNodes;
    net = new Network(n);
    /*
    for(let i=0; i<n/2; i++) {
      for(let j=i+1; j<n/2; j++) {
        net.add_link( i, j );
      }
    }
    for(let i=n/2; i<n; i++) {
      for(let j=i+1; j<n; j++) {
        net.add_link( i, j );
      }
    }
    net.add_link( n/2-1, n/2, 100 );
    net.remove_link( 3, 4 );
    net.remove_link( 3, 1 );
    net.remove_link( 3, 2 );
    */
  }
  p.draw = () => {
    wsn.update();
    physics.update();
    p.background(255);
    
    net.display();
  }

  class WSN {
    constructor(net, p_la=0.05, p_ga=0.0005, p_ld=0.001) {
      this.net = net;
      this._p_la = p_la;
      this._p_ga = p_ga;
      this._p_ld = p_ld;
    }

    update() {
      this.net.for_each_node( (n) => {
        this._LA(n);
      });
      if( ! net._is_consistent() ) {
        throw new Error("must not happen");
      }
      this.net.for_each_node( (n) => {
        this._GA(n);
      });
      if( ! net._is_consistent() ) {
        throw new Error("must not happen");
      }
      this._LD();
      if( ! net._is_consistent() ) {
        throw new Error("must not happen");
      }
    }

    _LA(ni) {
      if( ni.degree() === 0 ) { return; }
      const l_ij = this._edge_selection(ni, null);
      l_ij.update_weight( l_ij.w + 1 );
  
      const nj = (l_ij.n1.id === ni.id) ? l_ij.n2 : l_ij.n1;
      if( nj.degree() === 1 ) { return; }
      const l_jk = this._edge_selection(nj, ni);
      l_jk.update_weight( l_jk.w + 1 );
  
      const nk = (l_jk.n1.id === nj.id) ? l_jk.n2 : l_jk.n1;
      const l_ik = ni.get_link(nk);
      if( l_ik ) {
        l_ik.update_weight( l_ik.w + 1 );
      }
      else {
        if( Math.random() < this._p_la ) {
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
      if( ni.degree() > 0 && Math.random() > this._p_ga ) { return; }
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
        if( Math.random() < this._p_ld ) {
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
      p.fill(0, 150);
      p.stroke(0);
      p.ellipse(this.x, this.y, options.particleRadius, options.particleRadius);
    }
  }

  class Link extends VerletSpring2D {
    constructor(ni, nj, weight) {
      super(ni, nj, options.springLength, options.springStrength);
      if(ni.id < nj.id) { this.n1 = ni; this.n2 = nj; }
      else { this.n1 = nj; this.n2 = ni; }
      this.w = weight;
      this._update_spring();
    }

    _update_spring() {
      const s = options.springStrength * Math.log(this.w+1);
      this.setStrength(s);
    }

    update_weight(w) { this.w = w; this._update_spring(); }

    display() {
      p.stroke(0, 150);
      p.strokeWeight(options.linkStrokeWeight*Math.log(this.w+1));
      p.line(this.n1.x, this.n1.y, this.n2.x, this.n2.y);
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
      const repulsion = new VerletMinDistanceSpring2D(ni,nj, options.minDistanceSpringLength, options.minDistanceSpringStrength);
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

