/* Aequi page runtime.
   Small, dependency-free replacement for the design canvas runtime.
   It binds {{ values }} from Component.renderVals() into the page markup,
   shows/hides <sc-if> blocks, wires events and refs, and handles the real URLs
   (/, /team, /partners, /blog, /privacy, /terms). */
(function () {
  'use strict';

  var PATHS = { home: '/', team: '/team', partners: '/partners', blog: '/blog', privacy: '/privacy', terms: '/terms' };
  var HREFS = { navHome: '/', navTeam: '/team', navPartners: '/partners', navBlog: '/blog', navPrivacy: '/privacy', navTerms: '/terms', navSteps: '/#steps', navPricing: '/#pricing', navFaq: '/#faq' };
  var META = window.AEQUI_META || {};

  function pageFromPath(p) {
    p = (p || '/').replace(/\/+$/, '') || '/';
    for (var k in PATHS) { if (PATHS[k] === p) { return k; } }
    return 'home';
  }

  function applyMeta(page) {
    var m = META[page]; if (!m) { return; }
    document.title = m.title;
    var set = function (sel, attr, val) { var el = document.querySelector(sel); if (el && val) { el.setAttribute(attr, val); } };
    set('meta[name="description"]', 'content', m.description);
    set('meta[property="og:title"]', 'content', m.title);
    set('meta[property="og:description"]', 'content', m.description);
    set('meta[property="og:url"]', 'content', m.url);
    set('meta[name="twitter:title"]', 'content', m.title);
    set('meta[name="twitter:description"]', 'content', m.description);
    set('link[rel="canonical"]', 'href', m.url);
  }

  /* ---- base class the Component extends ---- */
  var scheduled = false, current = null, noPush = false;
  window.DCLogic = class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(p) {
      var prev = this.state.page;
      Object.assign(this.state, typeof p === 'function' ? p(this.state) : p);
      if (this.state.page !== prev && prev !== undefined) {
        applyMeta(this.state.page);
        if (!noPush) { try { history.pushState({ page: this.state.page }, '', PATHS[this.state.page] || '/'); } catch (e) {} }
      }
      schedule();
    }
  };

  /* ---- template engine ---- */
  var EXPR = /\{\{\s*([^}]*?)\s*\}\}/g, WHOLE = /^\{\{\s*([^}]*?)\s*\}\}$/;
  var queue = [];

  function ev(k, vals) { if (k === 'true') { return true; } if (k === 'false') { return false; } return vals[k]; }
  function interp(str, vals) {
    var m = str.match(WHOLE);
    if (m) { return ev(m[1], vals); }
    return str.replace(EXPR, function (_, k) { var v = ev(k, vals); return v == null || v === false ? '' : String(v); });
  }

  function mount(tpl, parent, before, vals, comp) {
    var inst = { nodes: [], binds: [], ifs: [] };
    var frag = document.createDocumentFragment();
    tpl.forEach(function (n) { frag.appendChild(n.cloneNode(true)); });
    var tops = Array.prototype.slice.call(frag.childNodes);

    function proc(node) {
      if (node.nodeType === 3) {
        if (node.nodeValue.indexOf('{{') >= 0) { inst.binds.push({ t: 'text', node: node, tpl: node.nodeValue, last: undefined }); }
        return node;
      }
      if (node.nodeType !== 1) { return node; }
      if (node.tagName === 'SC-IF') {
        var m = (node.getAttribute('value') || '').match(WHOLE);
        var anchor = document.createComment('if');
        inst.ifs.push({ anchor: anchor, key: m ? m[1] : 'false', tpl: Array.prototype.slice.call(node.childNodes), inst: null });
        node.replaceWith(anchor);
        return anchor;
      }
      Array.prototype.slice.call(node.attributes).forEach(function (a) {
        var name = a.name, v = a.value;
        if (v.indexOf('{{') < 0) { return; }
        var key = (v.match(WHOLE) || [])[1];
        if (/^on[a-z]+$/.test(name) && key) {
          node.removeAttribute(name);
          node.addEventListener(name.slice(2), function (e) { var f = comp._vals && comp._vals[key]; if (typeof f === 'function') { return f.call(comp, e); } });
          if (name === 'onclick' && HREFS[key] && node.tagName === 'A') { node.setAttribute('href', HREFS[key]); }
        } else if (name === 'ref' && key) {
          node.removeAttribute('ref');
          queue.push({ el: node, key: key });
        } else {
          inst.binds.push({ t: 'attr', node: node, name: name, tpl: v, last: undefined });
        }
      });
      Array.prototype.slice.call(node.childNodes).forEach(proc);
      return node;
    }

    inst.nodes = tops.map(proc);
    parent.insertBefore(frag, before);
    inst.update = function (vals) {
      inst.binds.forEach(function (b) {
        var v = interp(b.tpl, vals);
        if (b.t === 'text') {
          var s = v == null || v === false ? '' : String(v);
          if (s !== b.last) { b.last = s; b.node.nodeValue = s; }
        } else {
          var key = v == null ? null : String(v);
          if (key !== b.last) {
            b.last = key;
            if (key === null) { b.node.removeAttribute(b.name); } else { b.node.setAttribute(b.name, key); }
            if (b.name === 'value' && b.node.tagName === 'INPUT' && b.node.value !== key) { b.node.value = key; }
          }
        }
      });
      inst.ifs.forEach(function (f) {
        var on = !!vals[f.key];
        if (on && !f.inst) { f.inst = mount(f.tpl, f.anchor.parentNode, f.anchor.nextSibling, vals, comp); }
        else if (!on && f.inst) { f.inst.destroy(); f.inst = null; }
        if (f.inst) { f.inst.update(vals); }
      });
    };
    inst.destroy = function () {
      inst.ifs.forEach(function (f) { if (f.inst) { f.inst.destroy(); f.inst = null; } });
      inst.nodes.forEach(function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } });
    };
    /* the refs collected for this instance are queued; run once everything is attached */
    inst.update(vals);
    return inst;
  }

  function flush(vals) {
    var q = queue; queue = [];
    q.forEach(function (r) { var f = vals[r.key]; if (typeof f === 'function' && r.el.isConnected) { try { f(r.el); } catch (e) { if (window.console) { console.error(e); } } } });
  }

  var root = null, tpl = null, host = null;
  function render() {
    scheduled = false;
    var vals = current.renderVals();
    current._vals = vals;
    if (!root) { root = mount(tpl, host, null, vals, current); }
    else { root.update(vals); }
    flush(vals);
    if (queue.length) { flush(vals); }
  }
  function schedule() { if (scheduled || !current) { return; } scheduled = true; Promise.resolve().then(render); }

  window.AequiBoot = function (Component, accent) {
    host = document.getElementById('app');
    var t = document.getElementById('aequi-template');
    tpl = Array.prototype.slice.call(t.content.childNodes);
    current = new Component({ accent: accent });
    current.state.page = pageFromPath(location.pathname);
    applyMeta(current.state.page);
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    window.addEventListener('popstate', function () {
      noPush = true;
      current.setState({ page: pageFromPath(location.pathname) });
      noPush = false;
      setTimeout(function () { var el = document.getElementById('pgtop'); if (el && el.scrollIntoView) { el.scrollIntoView({ behavior: 'auto', block: 'start' }); } }, 90);
    });
    render();
    /* deep link such as /#pricing */
    if (location.hash) { setTimeout(function () { var el = document.getElementById(location.hash.slice(1)); if (el && el.scrollIntoView) { el.scrollIntoView(); } }, 300); }
  };
})();
