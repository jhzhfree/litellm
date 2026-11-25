(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,[586448,e=>{var t=e.i(271645),i=e.i(540143),r=e.i(869230),n=e.i(915823),s=e.i(619273);function a(e,t){let i=new Set(t);return e.filter(e=>!i.has(e))}var o=class extends n.f{#e;#t;#i;#r;#n;#s;#a;#o;#l;#u=[];constructor(e,t,i){super(),this.#e=e,this.#r=i,this.#i=[],this.#n=[],this.#t=[],this.setQueries(t)}onSubscribe(){1===this.listeners.size&&this.#n.forEach(e=>{e.subscribe(t=>{this.#d(e,t)})})}onUnsubscribe(){this.listeners.size||this.destroy()}destroy(){this.listeners=new Set,this.#n.forEach(e=>{e.destroy()})}setQueries(e,t){this.#i=e,this.#r=t,i.f.batch(()=>{let e=this.#n,t=this.#p(this.#i);t.forEach(e=>e.observer.setOptions(e.defaultedQueryOptions));let i=t.map(e=>e.observer),r=i.map(e=>e.getCurrentResult()),n=e.length!==i.length,o=i.some((t,i)=>t!==e[i]),l=n||o,u=!!l||r.some((e,t)=>{let i=this.#t[t];return!i||!(0,s.U)(e,i)});(l||u)&&(l&&(this.#u=t,this.#n=i),this.#t=r,this.hasListeners()&&(l&&(a(e,i).forEach(e=>{e.destroy()}),a(i,e).forEach(e=>{e.subscribe(t=>{this.#d(e,t)})})),this.#f()))})}getCurrentResult(){return this.#t}getQueries(){return this.#n.map(e=>e.getCurrentQuery())}getObservers(){return this.#n}getOptimisticResult(e,t){let i=this.#p(e),r=i.map(e=>e.observer.getOptimisticResult(e.defaultedQueryOptions)),n=i.map(e=>e.defaultedQueryOptions.queryHash);return[r,e=>this.#c(e??r,t,n),()=>this.#h(r,i)]}#h(e,t){return t.map((i,r)=>{let n=e[r];return i.defaultedQueryOptions.notifyOnChangeProps?n:i.observer.trackResult(n,e=>{t.forEach(t=>{t.observer.trackProp(e)})})})}#c(e,t,i){if(t){let r=this.#l,n=void 0!==i&&void 0!==r&&(r.length!==i.length||i.some((e,t)=>e!==r[t]));return(!this.#s||this.#t!==this.#o||n||t!==this.#a)&&(this.#a=t,this.#o=this.#t,void 0!==i&&(this.#l=i),this.#s=(0,s.B)(this.#s,t(e))),this.#s}return e}#m(){return this.#r?.combine!==void 0&&this.#n.some((e,t)=>e.options.suspense&&this.#t[t]?.data===void 0)}#p(e){let t=new Map;this.#n.forEach(e=>{let i=e.options.queryHash;if(!i)return;let r=t.get(i);r?r.push(e):t.set(i,[e])});let i=[];return e.forEach(e=>{let n=this.#e.defaultQueryOptions(e),s=t.get(n.queryHash)?.shift()??new r.f(this.#e,n);i.push({defaultedQueryOptions:n,observer:s})}),i}#d(e,t){let i=this.#n.indexOf(e);if(-1!==i){var r;let e;this.#t=(r=this.#t,(e=r.slice(0))[i]=t,e),this.#f()}}#f(){if(this.hasListeners()){let e=this.#h(this.#t,this.#u),t=this.#m(),r=this.#s,n=t?r:this.#c(e,this.#r?.combine);(t||r!==n)&&i.f.batch(()=>{this.listeners.forEach(e=>{e(this.#t)})})}}},l=e.i(912598),u=e.i(381384),d=e.i(673664),p=e.i(427001),f=e.i(254440);e.s(["f",0,function({queries:e,...n},a){let c=(0,l.d)(a),h=(0,u.f)(),m=(0,d.p)(),g=t.useMemo(()=>e.map(e=>{let t=c.defaultQueryOptions(e);return t._optimisticResults=h?"isRestoring":"optimistic",t}),[e,c,h]);g.forEach(e=>{(0,f.p)(e);let t=c.getQueryCache().get(e.queryHash);(0,p.l)(e,m,t)}),(0,p.E)(m);let[_]=t.useState(()=>new o(c,g,n)),[y,b,v]=_.getOptimisticResult(g,n.combine),x=!h&&!1!==n.subscribed;t.useSyncExternalStore(t.useCallback(e=>x?_.subscribe(i.f.batchCalls(e)):s.z,[_,x]),()=>_.getCurrentResult(),()=>_.getCurrentResult()),t.useEffect(()=>{_.setQueries(g,n)},[g,n,_]);let w=y.some((e,t)=>(0,f.Q)(g[t],e))?y.flatMap((e,t)=>{let i=g[t];if(i&&(0,f.Q)(i,e)){let e=new r.f(c,i);return(0,f.X)(i,e,m)}return[]}):[];if(w.length>0)throw Promise.all(w);let k=y.find((e,t)=>{let i=g[t];return i&&(0,p.P)({result:e,errorResetBoundary:m,throwOnError:i.throwOnError,query:c.getQueryCache().get(i.queryHash),suspense:i.suspense})});if(k?.error)throw k.error;return b(v())}],586448)},269638,e=>{let t=(0,e.i(475254).f)("circle-check-big",[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]]);e.s(["f",0,t],269638)},595468,e=>{var t=e.i(123287);e.s(["f",()=>t.f])},101048,e=>{var t=e.i(123287);e.s(["f",()=>t.f])},798031,e=>{let t=(0,e.i(475254).f)("circle-x",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]);e.s(["f",0,t])},832724,e=>{var t=e.i(798031);e.s(["f",()=>t.f])},339402,e=>{let t=(0,e.i(475254).f)("code",[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]]);e.s(["f",0,t])},758472,e=>{var t=e.i(339402);e.s(["f",()=>t.f])},133073,e=>{let t=(0,e.i(475254).f)("database-zap",[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 15 21.84",key:"14ibmq"}],["path",{d:"M21 5V8",key:"1marbg"}],["path",{d:"M21 12L18 17H22L19 22",key:"zafso"}],["path",{d:"M3 12A9 3 0 0 0 14.59 14.87",key:"1y4wr8"}]]);e.s(["f",0,t],133073)},77705,e=>{let t=(0,e.i(475254).f)("eye-off",[["path",{d:"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",key:"ct8e1f"}],["path",{d:"M14.084 14.158a3 3 0 0 1-4.242-4.242",key:"151rxh"}],["path",{d:"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",key:"13bj9a"}],["path",{d:"m2 2 20 20",key:"1ooewy"}]]);e.s(["f",0,t],77705)},286536,e=>{let t=(0,e.i(475254).f)("eye",[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);e.s(["f",0,t],286536)},221345,e=>{let t=(0,e.i(475254).f)("link",[["path",{d:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",key:"1cjeqo"}],["path",{d:"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",key:"19qd67"}]]);e.s(["f",0,t],221345)},63804,e=>{let t=(0,e.i(475254).f)("list-checks",[["path",{d:"m3 17 2 2 4-4",key:"1jhpwq"}],["path",{d:"m3 7 2 2 4-4",key:"1obspn"}],["path",{d:"M13 6h8",key:"15sg57"}],["path",{d:"M13 12h8",key:"h98zly"}],["path",{d:"M13 18h8",key:"oe0vm4"}]]);e.s(["f",0,t],63804)},270756,e=>{let t=(0,e.i(475254).f)("lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]);e.s(["f",0,t],270756)},686311,e=>{let t=(0,e.i(475254).f)("message-square",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);e.s(["f",0,t],686311)},387951,382373,e=>{var t=e.i(475254);let i=(0,t.f)("mic",[["path",{d:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",key:"131961"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["line",{x1:"12",x2:"12",y1:"19",y2:"22",key:"x3vr5v"}]]);e.s(["f",0,i],387951);let r=(0,t.f)("volume-2",[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["path",{d:"M16 9a5 5 0 0 1 0 6",key:"1q6k2b"}],["path",{d:"M19.364 18.364a9 9 0 0 0 0-12.728",key:"ijwkga"}]]);e.s(["f",0,r],382373)},299023,e=>{let t=(0,e.i(475254).f)("minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]);e.s(["f",0,t],299023)},64763,e=>{let t=(0,e.i(475254).f)("panel-right",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M15 3v18",key:"14nvp0"}]]);e.s(["f",0,t],64763)},82735,892034,223305,e=>{let t=(0,e.i(475254).f)("paperclip",[["path",{d:"m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",key:"1miecu"}]]);e.s(["f",0,t],82735),e.s(["f",0,function(e){if("number"==typeof e)return Number.isFinite(e)?e:void 0;if("string"!=typeof e)return;let t=e.trim();if(""===t)return;let i=Number(t);return Number.isFinite(i)?i:void 0}],892034);var i=e.i(84712);e.s(["f",0,e=>async(t,r)=>{let n=await (0,i.f)(t,r);return e(n.headers),n}],223305)},431343,e=>{let t=(0,e.i(475254).f)("play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]]);e.s(["f",0,t],431343)},996781,784875,e=>{var t=e.i(475254);let i=(0,t.f)("repeat",[["path",{d:"m17 2 4 4-4 4",key:"nntrym"}],["path",{d:"M3 11v-1a4 4 0 0 1 4-4h14",key:"84bu3i"}],["path",{d:"m7 22-4-4 4-4",key:"1wqhfi"}],["path",{d:"M21 13v1a4 4 0 0 1-4 4H3",key:"1rx37r"}]]);e.s(["f",0,i],996781);let r=(0,t.f)("scan-search",[["path",{d:"M3 7V5a2 2 0 0 1 2-2h2",key:"aa7l1z"}],["path",{d:"M17 3h2a2 2 0 0 1 2 2v2",key:"4qcy5o"}],["path",{d:"M21 17v2a2 2 0 0 1-2 2h-2",key:"6vwrx8"}],["path",{d:"M7 21H5a2 2 0 0 1-2-2v-2",key:"ioqczr"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}],["path",{d:"m16 16-1.9-1.9",key:"1dq9hf"}]]);e.s(["f",0,r],784875)},991810,e=>{let t=(0,e.i(475254).f)("rotate-cw",[["path",{d:"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8",key:"1p45f6"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}]]);e.s(["f",0,t],991810)},514764,e=>{let t=(0,e.i(475254).f)("send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]);e.s(["f",0,t],514764)},661263,e=>{let t=(0,e.i(475254).f)("split",[["path",{d:"M16 3h5v5",key:"1806ms"}],["path",{d:"M8 3H3v5",key:"15dfkv"}],["path",{d:"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3",key:"1qrqzj"}],["path",{d:"m15 9 6-6",key:"ko1vev"}]]);e.s(["f",0,t],661263)},823429,e=>{let t=(0,e.i(475254).f)("square-pen",[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]]);e.s(["f",0,t])},110031,e=>{var t=e.i(823429);e.s(["f",()=>t.f])},417835,e=>{let t=(0,e.i(475254).f)("timer",[["line",{x1:"10",x2:"14",y1:"2",y2:"2",key:"14vaq8"}],["line",{x1:"12",x2:"15",y1:"14",y2:"11",key:"17fdiu"}],["circle",{cx:"12",cy:"14",r:"8",key:"1e1u0o"}]]);e.s(["f",0,t],417835)},569074,e=>{let t=(0,e.i(475254).f)("upload",[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]]);e.s(["f",0,t],569074)},923426,e=>{let t=(0,e.i(475254).f)("user-round",[["circle",{cx:"12",cy:"8",r:"5",key:"1hypcn"}],["path",{d:"M20 21a8 8 0 0 0-16 0",key:"rfgkzh"}]]);e.s(["f",0,t],923426)},605500,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"Image",{enumerable:!0,get:function(){return b}});let r=e.r(555682),n=e.r(190809),s=e.r(843476),a=n._(e.r(271645)),o=r._(e.r(174080)),l=r._(e.r(325633)),u=e.r(908927),d=e.r(65856),p=e.r(49381),f=r._(e.r(1948)),c=e.r(818581);function h(e,t,i,r,n,s,a){let o=e?.src;e&&e["data-loaded-src"]!==o&&(e["data-loaded-src"]=o,("decode"in e?e.decode():Promise.resolve()).catch(()=>{}).then(()=>{if(e.parentElement&&e.isConnected){if("empty"!==t&&n(!0),i?.current){let t=new Event("load");Object.defineProperty(t,"target",{writable:!1,value:e});let r=!1,n=!1;i.current({...t,nativeEvent:t,currentTarget:e,target:e,isDefaultPrevented:()=>r,isPropagationStopped:()=>n,persist:()=>{},preventDefault:()=>{r=!0,t.preventDefault()},stopPropagation:()=>{n=!0,t.stopPropagation()}})}r?.current&&r.current(e)}}))}function m(e){return a.use?{fetchPriority:e}:{fetchpriority:e}}"u"<typeof window&&(globalThis.__NEXT_IMAGE_IMPORTED=!0);let g="u"<typeof window?a.useEffect:a.useLayoutEffect,_=(0,a.forwardRef)(({src:e,srcSet:t,sizes:i,height:r,width:n,decoding:o,className:l,style:u,fetchPriority:d,placeholder:p,loading:f,unoptimized:_,fill:y,onLoadRef:b,onLoadingCompleteRef:v,setBlurComplete:x,setShowAltText:w,sizesInput:k,onLoad:E,onError:j,...O},S)=>{let C=(0,a.useRef)(!1),R=(0,a.useRef)(null);g(()=>{let{current:e}=C,{current:t}=R;e||null===t||(j&&(t.src=t.src),t.complete&&h(t,p,b,v,x,_,k),C.current=!0)},[e,p,b,v,j,_,k]);let I=(0,c.useMergedRef)(S,R);return(0,s.jsx)("img",{...O,...m(d),loading:f,width:n,height:r,decoding:o,"data-nimg":y?"fill":"1",className:l,style:u,sizes:i,srcSet:t,src:e,ref:I,onLoad:e=>{h(e.currentTarget,p,b,v,x,_,k)},onError:e=>{w(!0),"empty"!==p&&x(!0),j&&j(e)}})});function y({isAppRouter:e,imgAttributes:t}){let i={as:"image",imageSrcSet:t.srcSet,imageSizes:t.sizes,crossOrigin:t.crossOrigin,referrerPolicy:t.referrerPolicy,...m(t.fetchPriority)};return e&&o.default.preload?(o.default.preload(t.src,i),null):(0,s.jsx)(l.default,{children:(0,s.jsx)("link",{rel:"preload",href:t.srcSet?void 0:t.src,...i},"__nimg-"+t.src+t.srcSet+t.sizes)})}let b=(0,a.forwardRef)((e,t)=>{let i=(0,a.useContext)(d.RouterContext),r=(0,p.useImageConfig)(),{onLoad:n,onLoadingComplete:o}=e,l=(0,a.useRef)(n);(0,a.useEffect)(()=>{l.current=n},[n]);let c=(0,a.useRef)(o);(0,a.useEffect)(()=>{c.current=o},[o]);let[h,m]=(0,a.useState)(!1),[g,b]=(0,a.useState)(!1),{props:v,meta:x}=(0,u.getImgProps)(e,{defaultLoader:f.default,imgConf:r,blurComplete:h,showAltText:g});return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(_,{...v,unoptimized:x.unoptimized,placeholder:x.placeholder,fill:x.fill,onLoadRef:l,onLoadingCompleteRef:c,setBlurComplete:m,setShowAltText:b,sizesInput:e.sizes,ref:t}),x.preload?(0,s.jsx)(y,{isAppRouter:!i,imgAttributes:v}):null]})});("function"==typeof i.default||"object"==typeof i.default&&null!==i.default)&&void 0===i.default.__esModule&&(Object.defineProperty(i.default,"__esModule",{value:!0}),Object.assign(i.default,i),t.exports=i.default)},325164,e=>{var t=e.i(605500);e.s(["default",()=>t.Image])},49381,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"useImageConfig",{enumerable:!0,get:function(){return o}});let r=e.r(271645),n=e.r(987690),s=e.r(918556),a={deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],qualities:[75],path:"/_next/image/",loader:"default",dangerouslyAllowSVG:!1,unoptimized:!0};function o(){let e=(0,r.useContext)(s.ImageConfigContext);return(0,n.prepareImageConfig)(a,e)}("function"==typeof i.default||"object"==typeof i.default&&null!==i.default)&&void 0===i.default.__esModule&&(Object.defineProperty(i.default,"__esModule",{value:!0}),Object.assign(i.default,i),t.exports=i.default)},670965,(e,t,i)=>{function r(e,t){let i=e||75;return t?.qualities?.length?t.qualities.reduce((e,t)=>Math.abs(t-i)<Math.abs(e-i)?t:e,t.qualities[0]):i}Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"findClosestQuality",{enumerable:!0,get:function(){return r}})},908927,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"getImgProps",{enumerable:!0,get:function(){return l}});let r=e.r(543369),n=e.r(488143),s=["-moz-initial","fill","none","scale-down",void 0];function a(e){return void 0!==e.default}function o(e){return void 0===e?e:"number"==typeof e?Number.isFinite(e)?e:0/0:"string"==typeof e&&/^[0-9]+$/.test(e)?parseInt(e,10):0/0}function l({src:e,sizes:t,unoptimized:i=!1,priority:u=!1,preload:d=!1,loading:p,className:f,quality:c,width:h,height:m,fill:g=!1,style:_,overrideSrc:y,onLoad:b,onLoadingComplete:v,placeholder:x="empty",blurDataURL:w,fetchPriority:k,decoding:E="async",layout:j,objectFit:O,objectPosition:S,lazyBoundary:C,lazyRoot:R,...I},M){var z;let P,A,{imgConf:$,showAltText:T,blurComplete:D,defaultLoader:q}=M;if(void 0===q)throw Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config");let L=I.loader||q;delete I.loader,delete I.srcSet;let N="__next_img_default"in L;if(N){if("custom"===$.loader)throw Error(`Image with src "${e}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`)}else{let e=L;L=t=>{let{config:i,...r}=t;return e(r)}}if(j){"fill"===j&&(g=!0);let e={intrinsic:{maxWidth:"100%",height:"auto"},responsive:{width:"100%",height:"auto"}}[j];e&&(_={..._,...e});let i={responsive:"100vw",fill:"100vw"}[j];i&&!t&&(t=i)}let F="",U=o(h),H=o(m);if((z=e)&&"object"==typeof z&&(a(z)||void 0!==z.src)){let t=a(e)?e.default:e;if(!t.src)throw Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(t)}`);if(!t.height||!t.width)throw Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(t)}`);if(P=t.blurWidth,A=t.blurHeight,w=w||t.blurDataURL,F=t.src,!g)if(U||H){if(U&&!H){let e=U/t.width;H=Math.round(t.height*e)}else if(!U&&H){let e=H/t.height;U=Math.round(t.width*e)}}else U=t.width,H=t.height}let Q=!u&&!d&&("lazy"===p||void 0===p);(!(e="string"==typeof e?e:F)||e.startsWith("data:")||e.startsWith("blob:"))&&(i=!0,Q=!1),$.unoptimized&&(i=!0),N&&!$.dangerouslyAllowSVG&&e.split("?",1)[0].endsWith(".svg")&&(i=!0);let B=o(c),W=Object.assign(g?{position:"absolute",height:"100%",width:"100%",left:0,top:0,right:0,bottom:0,objectFit:O,objectPosition:S}:{},T?{}:{color:"transparent"},_),V=D||"empty"===x?null:"blur"===x?`url("data:image/svg+xml;charset=utf-8,${(0,n.getImageBlurSvg)({widthInt:U,heightInt:H,blurWidth:P,blurHeight:A,blurDataURL:w||"",objectFit:W.objectFit})}")`:`url("${x}")`,K=s.includes(W.objectFit)?"fill"===W.objectFit?"100% 100%":"cover":W.objectFit,G=V?{backgroundSize:K,backgroundPosition:W.objectPosition||"50% 50%",backgroundRepeat:"no-repeat",backgroundImage:V}:{},Y=function({config:e,src:t,unoptimized:i,width:n,quality:s,sizes:a,loader:o}){if(i){if(t.startsWith("/")&&!t.startsWith("//")){let e=(0,r.getDeploymentId)();if(t.includes("/_next/static/immutable")&&!(0,r.getAssetToken)())e=void 0;else if(e){let i=t.indexOf("?");if(-1!==i){let r=new URLSearchParams(t.slice(i+1));r.get("dpl")||(r.append("dpl",e),t=t.slice(0,i)+"?"+r.toString())}else t+=`?dpl=${e}`}}return{src:t,srcSet:void 0,sizes:void 0}}let{widths:l,kind:u}=function({deviceSizes:e,allSizes:t},i,r){if(r){let i=/(^|\s)(1?\d?\d)vw/g,n=[];for(let e;e=i.exec(r);)n.push(parseInt(e[2]));if(n.length){let i=.01*Math.min(...n);return{widths:t.filter(t=>t>=e[0]*i),kind:"w"}}return{widths:t,kind:"w"}}return"number"!=typeof i?{widths:e,kind:"w"}:{widths:[...new Set([i,2*i].map(e=>t.find(t=>t>=e)||t[t.length-1]))],kind:"x"}}(e,n,a),d=l.length-1;return{sizes:a||"w"!==u?a:"100vw",srcSet:l.map((i,r)=>`${o({config:e,src:t,quality:s,width:i})} ${"w"===u?i:r+1}${u}`).join(", "),src:o({config:e,src:t,quality:s,width:l[d]})}}({config:$,src:e,unoptimized:i,width:U,quality:B,sizes:t,loader:L}),J=Q?"lazy":p;return{props:{...I,loading:J,fetchPriority:k,width:U,height:H,decoding:E,className:f,style:{...W,...G},sizes:Y.sizes,srcSet:Y.srcSet,src:y||Y.src},meta:{unoptimized:i,preload:d||u,placeholder:x,fill:g}}}},325633,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0});var r={default:function(){return m},defaultHead:function(){return p}};for(var n in r)Object.defineProperty(i,n,{enumerable:!0,get:r[n]});let s=e.r(555682),a=e.r(190809),o=e.r(843476),l=a._(e.r(271645)),u=s._(e.r(898879)),d=e.r(742732);function p(){return[(0,o.jsx)("meta",{charSet:"utf-8"},"charset"),(0,o.jsx)("meta",{name:"viewport",content:"width=device-width"},"viewport")]}function f(e,t){return"string"==typeof t||"number"==typeof t?e:t.type===l.default.Fragment?e.concat(l.default.Children.toArray(t.props.children).reduce((e,t)=>"string"==typeof t||"number"==typeof t?e:e.concat(t),[])):e.concat(t)}let c=["name","httpEquiv","charSet","itemProp"];function h(e){let t,i,r,n;return e.reduce(f,[]).reverse().concat(p().reverse()).filter((t=new Set,i=new Set,r=new Set,n={},e=>{let s=!0,a=!1;if(e.key&&"number"!=typeof e.key&&e.key.indexOf("$")>0){a=!0;let i=e.key.slice(e.key.indexOf("$")+1);t.has(i)?s=!1:t.add(i)}switch(e.type){case"title":case"base":i.has(e.type)?s=!1:i.add(e.type);break;case"meta":for(let t=0,i=c.length;t<i;t++){let i=c[t];if(e.props.hasOwnProperty(i))if("charSet"===i)r.has(i)?s=!1:r.add(i);else{let t=e.props[i],r=n[i]||new Set;("name"!==i||!a)&&r.has(t)?s=!1:(r.add(t),n[i]=r)}}}return s})).reverse().map((e,t)=>{let i=e.key||t;return l.default.cloneElement(e,{key:i})})}let m=function({children:e}){let t=(0,l.useContext)(d.HeadManagerContext);return(0,o.jsx)(u.default,{reduceComponentsToState:h,headManager:t,children:e})};("function"==typeof i.default||"object"==typeof i.default&&null!==i.default)&&void 0===i.default.__esModule&&(Object.defineProperty(i.default,"__esModule",{value:!0}),Object.assign(i.default,i),t.exports=i.default)},488143,(e,t,i)=>{function r({widthInt:e,heightInt:t,blurWidth:i,blurHeight:n,blurDataURL:s,objectFit:a}){let o=i?40*i:e,l=n?40*n:t,u=o&&l?`viewBox='0 0 ${o} ${l}'`:"";return`%3Csvg xmlns='http://www.w3.org/2000/svg' ${u}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${u?"none":"contain"===a?"xMidYMid":"cover"===a?"xMidYMid slice":"none"}' style='filter: url(%23b);' href='${s}'/%3E%3C/svg%3E`}Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"getImageBlurSvg",{enumerable:!0,get:function(){return r}})},918556,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"ImageConfigContext",{enumerable:!0,get:function(){return s}});let r=e.r(555682)._(e.r(271645)),n=e.r(987690),s=r.default.createContext(n.imageConfigDefault)},987690,(e,t,i)=>{Object.defineProperty(i,"__esModule",{value:!0});var r={VALID_LOADERS:function(){return s},imageConfigDefault:function(){return u},prepareImageConfig:function(){return l}};for(var n in r)Object.defineProperty(i,n,{enumerable:!0,get:r[n]});let s=["default","imgix","cloudinary","akamai","custom"],a={},o=new WeakMap;function l(e,t){let i=e??a,r=t??a,n=o.get(i);if(n){let e=n.get(r);if(e)return e}let s=e||t||u,l=[...s.deviceSizes].sort((e,t)=>e-t),d=[...s.imageSizes],p={deviceSizes:l,imageSizes:d,allSizes:[...l,...d].sort((e,t)=>e-t),qualities:void 0===s.qualities?void 0:[...s.qualities].sort((e,t)=>e-t),path:s.path,loader:s.loader,dangerouslyAllowSVG:s.dangerouslyAllowSVG,unoptimized:s.unoptimized,domains:s.domains,remotePatterns:s.remotePatterns,localPatterns:"u"<typeof window&&void 0!==t?t.localPatterns:s.localPatterns,output:s.output};return n||(n=new WeakMap,o.set(i,n)),n.set(r,p),p}let u={deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],path:"/_next/image",loader:"default",loaderFile:"",domains:[],disableStaticImages:!1,minimumCacheTTL:14400,formats:["image/webp"],maximumDiskCacheSize:void 0,maximumRedirects:3,maximumResponseBody:5e7,dangerouslyAllowLocalIP:!1,dangerouslyAllowSVG:!1,contentSecurityPolicy:"script-src 'none'; frame-src 'none'; sandbox;",contentDispositionType:"attachment",localPatterns:void 0,remotePatterns:[],qualities:[75],unoptimized:!1,customCacheHandler:!1}},1948,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"default",{enumerable:!0,get:function(){return a}});let r=e.r(670965),n=e.r(543369);function s({config:e,src:t,width:i,quality:a}){let o=(0,n.getDeploymentId)();if(t.startsWith("/")&&!t.startsWith("//"))if(t.includes("/_next/static/immutable")&&!(0,n.getAssetToken)())o=void 0;else{let e=t.indexOf("?");if(-1!==e){let i=new URLSearchParams(t.slice(e+1)),r=i.get("dpl");if(r){o=r,i.delete("dpl");let n=i.toString();t=t.slice(0,e)+(n?"?"+n:"")}}}if(t.startsWith("/")&&t.includes("?")&&e.localPatterns?.length===1&&"**"===e.localPatterns[0].pathname&&""===e.localPatterns[0].search)throw Error(`Image with src "${t}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`);let l=(0,r.findClosestQuality)(a,e);return`${e.path}?url=${encodeURIComponent(t)}&w=${i}&q=${l}${t.startsWith("/")&&o?`&dpl=${o}`:""}`}s.__next_img_default=!0;let a=s},65856,(e,t,i)=>{e.i(247167),Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"RouterContext",{enumerable:!0,get:function(){return r}});let r=(e.r(555682)._(e.r(271645))).default.createContext(null)},898879,(e,t,i)=>{Object.defineProperty(i,"__esModule",{value:!0}),Object.defineProperty(i,"default",{enumerable:!0,get:function(){return o}});let r=e.r(271645),n="u"<typeof window,s=n?()=>{}:r.useLayoutEffect,a=n?()=>{}:r.useEffect;function o(e){let{headManager:t,reduceComponentsToState:i}=e;function o(){if(t&&t.mountedInstances){let e=r.Children.toArray(Array.from(t.mountedInstances).filter(Boolean));t.updateHead(i(e))}}return n&&(t?.mountedInstances?.add(e.children),o()),s(()=>(t?.mountedInstances?.add(e.children),()=>{t?.mountedInstances?.delete(e.children)})),s(()=>(t&&(t._pendingUpdate=o),()=>{t&&(t._pendingUpdate=o)})),a(()=>(t&&t._pendingUpdate&&(t._pendingUpdate(),t._pendingUpdate=null),()=>{t&&t._pendingUpdate&&(t._pendingUpdate(),t._pendingUpdate=null)})),null}},563458,e=>{var t=e.i(722219);e.s(["z",0,t])},835460,e=>{var t=e.i(722219);e.s(["z",0,t])},518058,e=>{var t=e.i(722219);e.s(["z",0,t])},864261,e=>{var t=e.i(751247),i=e.i(135214),r=e.i(441228);e.s(["f",0,e=>{let{userRole:n}=(0,i.f)(),s=(0,r.f)();return(0,t.q)(n,e,s)}])},909947,e=>{var t=e.i(865361);e.s(["f",0,e=>{let i,{apiKeySource:r,accessToken:n,apiKey:s,inputMessage:a,chatHistory:o,selectedTags:l,selectedVectorStores:u,selectedGuardrails:d,selectedPolicies:p,selectedVoice:f,endpointType:c,selectedModel:h,selectedSdk:m,proxySettings:g,customHeaders:_}=e,y="session"===r?n:s,b=window.location.origin,v=g?.LITELLM_UI_API_DOC_BASE_URL;v&&v.trim()?b=v:g?.PROXY_BASE_URL&&(b=g.PROXY_BASE_URL);let x=a||"Your prompt here",w=x.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n"),k=o.filter(e=>!e.isImage).map(({role:e,content:t})=>({role:e,content:t})),E={};l.length>0&&(E.tags=l),u.length>0&&(E.vector_stores=u),d.length>0&&(E.guardrails=d),p.length>0&&(E.policies=p);let j=h||"your-model-name",O=_&&Object.keys(_).length>0?`,
	default_headers=${JSON.stringify(_,null,2).replace(/\n/g,"\n	")}`:"",S="azure"===m?`import openai

client = openai.AzureOpenAI(
	api_key="${y||"YOUR_AI_GATEWAY_API_KEY"}",
	azure_endpoint="${b}",
	api_version="2024-02-01"${O}
)`:`import openai

client = openai.OpenAI(
	api_key="${y||"YOUR_AI_GATEWAY_API_KEY"}",
	base_url="${b}"${O}
)`;switch(c){case t.Q.CHAT:{let e=Object.keys(E).length>0,t="";if(e){let e=JSON.stringify({metadata:E},null,2).split("\n").map(e=>" ".repeat(4)+e).join("\n").trim();t=`,
    extra_body=${e}`}let r=k.length>0?k:[{role:"user",content:x}];i=`
import base64

# Helper function to encode images to base64
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# Example with text only
response = client.chat.completions.create(
    model="${j}",
    messages=${JSON.stringify(r,null,4)}${t}
)

print(response)

# Example with image or PDF (uncomment and provide file path to use)
# base64_file = encode_image("path/to/your/file.jpg")  # or .pdf
# response_with_file = client.chat.completions.create(
#     model="${j}",
#     messages=[
#         {
#             "role": "user",
#             "content": [
#                 {
#                     "type": "text",
#                     "text": "${w}"
#                 },
#                 {
#                     "type": "image_url",
#                     "image_url": {
#                         "url": f"data:image/jpeg;base64,{base64_file}"  # or data:application/pdf;base64,{base64_file}
#                     }
#                 }
#             ]
#         }
#     ]${t}
# )
# print(response_with_file)
`;break}case t.Q.RESPONSES:{let e=Object.keys(E).length>0,t="";if(e){let e=JSON.stringify({metadata:E},null,2).split("\n").map(e=>" ".repeat(4)+e).join("\n").trim();t=`,
    extra_body=${e}`}let r=k.length>0?k:[{role:"user",content:x}];i=`
import base64

# Helper function to encode images to base64
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# Example with text only
response = client.responses.create(
    model="${j}",
    input=${JSON.stringify(r,null,4)}${t}
)

print(response.output_text)

# Example with image or PDF (uncomment and provide file path to use)
# base64_file = encode_image("path/to/your/file.jpg")  # or .pdf
# response_with_file = client.responses.create(
#     model="${j}",
#     input=[
#         {
#             "role": "user",
#             "content": [
#                 {"type": "input_text", "text": "${w}"},
#                 {
#                     "type": "input_image",
#                     "image_url": f"data:image/jpeg;base64,{base64_file}",  # or data:application/pdf;base64,{base64_file}
#                     "detail": "auto",
#                 },
#             ],
#         }
#     ]${t}
# )
# print(response_with_file.output_text)
`;break}case t.Q.IMAGE:i="azure"===m?`
# NOTE: The Azure SDK does not have a direct equivalent to the multi-modal 'responses.create' method shown for OpenAI.
# This snippet uses 'client.images.generate' and will create a new image based on your prompt.
# It does not use the uploaded image, as 'client.images.generate' does not support image inputs in this context.
import os
import requests
import json
import time
from PIL import Image

result = client.images.generate(
	model="${j}",
	prompt="${a}",
	n=1
)

json_response = json.loads(result.model_dump_json())

# Set the directory for the stored image
image_dir = os.path.join(os.curdir, 'images')

# If the directory doesn't exist, create it
if not os.path.isdir(image_dir):
	os.mkdir(image_dir)

# Initialize the image path
image_filename = f"generated_image_{int(time.time())}.png"
image_path = os.path.join(image_dir, image_filename)

try:
	# Retrieve the generated image
	if json_response.get("data") && len(json_response["data"]) > 0 && json_response["data"][0].get("url"):
			image_url = json_response["data"][0]["url"]
			generated_image = requests.get(image_url).content
			with open(image_path, "wb") as image_file:
					image_file.write(generated_image)

			print(f"Image saved to {image_path}")
			# Display the image
			image = Image.open(image_path)
			image.show()
	else:
			print("Could not find image URL in response.")
			print("Full response:", json_response)
except Exception as e:
	print(f"An error occurred: {e}")
	print("Full response:", json_response)
`:`
import base64
import os
import time
import json
from PIL import Image
import requests

# Helper function to encode images to base64
def encode_image(image_path):
	with open(image_path, "rb") as image_file:
			return base64.b64encode(image_file.read()).decode('utf-8')

# Helper function to create a file (simplified for this example)
def create_file(image_path):
	# In a real implementation, this would upload the file to OpenAI
	# For this example, we'll just return a placeholder ID
	return f"file_{os.path.basename(image_path).replace('.', '_')}"

# The prompt entered by the user
prompt = "${w}"

# Encode images to base64
base64_image1 = encode_image("body-lotion.png")
base64_image2 = encode_image("soap.png")

# Create file IDs
file_id1 = create_file("body-lotion.png")
file_id2 = create_file("incense-kit.png")

response = client.responses.create(
	model="${j}",
	input=[
			{
					"role": "user",
					"content": [
							{"type": "input_text", "text": prompt},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image1}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image2}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id1,
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id2,
									"detail": "auto",
							}
					],
			}
	],
	tools=[{"type": "image_generation"}],
)

# Process the response
image_generation_calls = [
	output
	for output in response.output
	if output.type == "image_generation_call"
]

image_data = [output.result for output in image_generation_calls]

if image_data:
	image_base64 = image_data[0]
	image_filename = f"edited_image_{int(time.time())}.png"
	with open(image_filename, "wb") as f:
			f.write(base64.b64decode(image_base64))
	print(f"Image saved to {image_filename}")
else:
	# If no image is generated, there might be a text response with an explanation
	text_response = [output.text for output in response.output if hasattr(output, 'text')]
	if text_response:
			print("No image generated. Model response:")
			print("\\n".join(text_response))
	else:
			print("No image data found in response.")
	print("Full response for debugging:")
	print(response)
`;break;case t.Q.IMAGE_EDITS:i="azure"===m?`
import base64
import os
import time
import json
from PIL import Image
import requests

# Helper function to encode images to base64
def encode_image(image_path):
	with open(image_path, "rb") as image_file:
			return base64.b64encode(image_file.read()).decode('utf-8')

# The prompt entered by the user
prompt = "${w}"

# Encode images to base64
base64_image1 = encode_image("body-lotion.png")
base64_image2 = encode_image("soap.png")

# Create file IDs
file_id1 = create_file("body-lotion.png")
file_id2 = create_file("incense-kit.png")

response = client.responses.create(
	model="${j}",
	input=[
			{
					"role": "user",
					"content": [
							{"type": "input_text", "text": prompt},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image1}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image2}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id1,
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id2,
									"detail": "auto",
							}
					],
			}
	],
	tools=[{"type": "image_generation"}],
)

# Process the response
image_generation_calls = [
	output
	for output in response.output
	if output.type == "image_generation_call"
]

image_data = [output.result for output in image_generation_calls]

if image_data:
	image_base64 = image_data[0]
	image_filename = f"edited_image_{int(time.time())}.png"
	with open(image_filename, "wb") as f:
			f.write(base64.b64decode(image_base64))
	print(f"Image saved to {image_filename}")
else:
	# If no image is generated, there might be a text response with an explanation
	text_response = [output.text for output in response.output if hasattr(output, 'text')]
	if text_response:
			print("No image generated. Model response:")
			print("\\n".join(text_response))
	else:
			print("No image data found in response.")
	print("Full response for debugging:")
	print(response)
`:`
import base64
import os
import time

# Helper function to encode images to base64
def encode_image(image_path):
	with open(image_path, "rb") as image_file:
			return base64.b64encode(image_file.read()).decode('utf-8')

# Helper function to create a file (simplified for this example)
def create_file(image_path):
	# In a real implementation, this would upload the file to OpenAI
	# For this example, we'll just return a placeholder ID
	return f"file_{os.path.basename(image_path).replace('.', '_')}"

# The prompt entered by the user
prompt = "${w}"

# Encode images to base64
base64_image1 = encode_image("body-lotion.png")
base64_image2 = encode_image("soap.png")

# Create file IDs
file_id1 = create_file("body-lotion.png")
file_id2 = create_file("incense-kit.png")

response = client.responses.create(
	model="${j}",
	input=[
			{
					"role": "user",
					"content": [
							{"type": "input_text", "text": prompt},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image1}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"image_url": f"data:image/jpeg;base64,{base64_image2}",
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id1,
									"detail": "auto",
							},
							{
									"type": "input_image",
									"file_id": file_id2,
									"detail": "auto",
							}
					],
			}
	],
	tools=[{"type": "image_generation"}],
)

# Process the response
image_generation_calls = [
	output
	for output in response.output
	if output.type == "image_generation_call"
]

image_data = [output.result for output in image_generation_calls]

if image_data:
	image_base64 = image_data[0]
	image_filename = f"edited_image_{int(time.time())}.png"
	with open(image_filename, "wb") as f:
			f.write(base64.b64decode(image_base64))
	print(f"Image saved to {image_filename}")
else:
	# If no image is generated, there might be a text response with an explanation
	text_response = [output.text for output in response.output if hasattr(output, 'text')]
	if text_response:
			print("No image generated. Model response:")
			print("\\n".join(text_response))
	else:
			print("No image data found in response.")
	print("Full response for debugging:")
	print(response)
`;break;case t.Q.EMBEDDINGS:i=`
response = client.embeddings.create(
	input="${a||"Your string here"}",
	model="${j}",
	encoding_format="base64" # or "float"
)

print(response.data[0].embedding)
`;break;case t.Q.TRANSCRIPTION:i=`
# Open the audio file
audio_file = open("path/to/your/audio/file.mp3", "rb")

# Make the transcription request
response = client.audio.transcriptions.create(
	model="${j}",
	file=audio_file${a?`,
	prompt="${a.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`:""}
)

print(response.text)
`;break;case t.Q.SPEECH:i=`
# Make the text-to-speech request
response = client.audio.speech.create(
	model="${j}",
	input="${a||"Your text to convert to speech here"}",
	voice="${f}"  # Options: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer
)

# Save the audio to a file
output_filename = "output_speech.mp3"
response.stream_to_file(output_filename)
print(f"Audio saved to {output_filename}")

# Optional: Customize response format and speed
# response = client.audio.speech.create(
#     model="${j}",
#     input="${a||"Your text to convert to speech here"}",
#     voice="alloy",
#     response_format="mp3",  # Options: mp3, opus, aac, flac, wav, pcm
#     speed=1.0  # Range: 0.25 to 4.0
# )
# response.stream_to_file("output_speech.mp3")
`;break;default:i="\n# Code generation for this endpoint is not implemented yet."}return`${S}
${i}`}])},891547,e=>{var t=e.i(843476),i=e.i(271645),r=e.i(322831),n=e.i(602869),s=e.i(845150);e.s(["f",0,({onChange:e,value:a,className:o,accessToken:l,disabled:u})=>{let{t:d}=(0,r.f)(),[p,f]=(0,i.useState)([]),[c,h]=(0,i.useState)(!1);return(0,i.useEffect)(()=>{(async()=>{if(l){h(!0);try{let e=await (0,n.gx)(l);e.guardrails&&f(e.guardrails)}catch(e){console.error("Error fetching guardrails:",e)}finally{h(!1)}}})()},[l]),(0,t.jsx)("div",{className:"min-w-0",children:(0,t.jsx)(s.f,{disabled:u,placeholder:d(u?"guardrailSelector.premiumOnly":"guardrailSelector.placeholder"),onValueChange:t=>{e(t)},value:a,loading:c,className:o,options:p.flatMap(e=>{let t=e.guardrail_name;return null==t||""===t?[]:[{label:t,value:t}]})})})}])},757625,e=>{let t=e=>Array.isArray(e)&&2===e.length&&e.every(e=>"string"==typeof e);e.s(["p",0,(e,t)=>({...e&&e.length>0?{"x-ai-gateway-tags":e.join(",")}:{},...t}),"V",0,e=>Object.fromEntries(e.map(([e,t])=>[e.trim(),t]).filter(([e])=>""!==e)),"k",0,e=>{if(!e)return[];try{let i=JSON.parse(e);return Array.isArray(i)?i.filter(t):[]}catch{return[]}},"s",0,(e,t)=>{let i=new Set(Object.keys(t).map(e=>e.toLowerCase()));return{...Object.fromEntries(Object.entries(e).filter(([e])=>!i.has(e.toLowerCase()))),...t}}])},459161,288140,e=>{var t=e.i(223305);e.i(356449);var i=e.i(857223),r=e.i(602869),n=e.i(201787),s=e.i(417385),a=e.i(441773),o=e.i(892034),l=e.i(757625);let u="toolset:";function d({selectedMCPServers:e,mcpServers:t,mcpToolsets:i,mcpServerToolRestrictions:r}){return e&&0!==e.length?e.includes("__all__")?[{type:"mcp",server_label:"litellm",server_url:"litellm_proxy/mcp",require_approval:"never"}]:e.map(e=>{if(e.startsWith(u)){let t=e.slice(u.length),r=i?.find(e=>e.toolset_id===t),n=r?.toolset_name||t;return{type:"mcp",server_label:n,server_url:`litellm_proxy/mcp/${n}`,require_approval:"never"}}let n=t?.find(t=>t.server_id===e),s=n?.server_name||e,a=r?.[e]||[];return{type:"mcp",server_label:s,server_url:`litellm_proxy/mcp/${s}`,require_approval:"never",...a.length>0?{allowed_tools:a}:{}}}):[]}e.s(["f",0,d],288140);let p=new Set(["response.reasoning_text.delta","response.reasoning_summary_text.delta","response.reasoning.delta"]),f=e=>(e??[]).map(e=>e.text??"").filter(e=>e.length>0),c=e=>{let t=f(e.summary);return(t.length>0?t:f(e.content)).join("\n\n")};async function h(e,u,f,m,g=[],_,y,b,v,x,w,k,E,j,O,S,C,R,I,M,z,P,A,$=!0,T,D,q,L,N){if(!m)throw Error("Virtual Key is required");if(!f||""===f.trim())throw Error("Model is required. Please select a model before sending a request.");console.log=function(){};let F=M||(0,r.V5)(),U=(0,l.p)(g,D),H=new i.f.OpenAI({apiKey:m,baseURL:F,dangerouslyAllowBrowser:!0,defaultHeaders:U,...q?{fetch:(0,t.f)(q)}:{}});try{let t,i,r,n=Date.now(),s=!1,l=null,h=!1,m=e.flatMap(e=>{let t="assistant"===e.role?(e.mcpEvents??[]).flatMap(e=>{let t=e.item,i=t?.id||e.item_id;return"response.output_item.done"===e.type&&t?.type==="mcp_call"&&i&&t.name&&"string"==typeof t.arguments&&"string"==typeof t.output?[{type:"function_call",call_id:i,name:t.name,arguments:t.arguments},{type:"function_call_output",call_id:i,output:t.output}]:[]}):[];return[...t,...t.length>0&&""===e.content?[]:[{role:e.role,content:e.content,type:"message"}]]}),g=d({selectedMCPServers:j,mcpServers:z,mcpToolsets:A,mcpServerToolRestrictions:P});R&&g.push({type:"code_interpreter",container:{type:"auto"}}),N&&g.push({type:"web_search"});let M={model:f,input:m,...N&&{instructions:N.instructions},litellm_trace_id:x,...O?{previous_response_id:O}:{},...w?{vector_store_ids:w}:{},...k?{guardrails:k}:{},...E?{policies:E}:{},...g.length>0?{tools:g,tool_choice:"auto"}:{}};if(L){let e=await H.post("/responses",{body:{...M,background:!0,stream:!1},signal:_,maxRetries:0});return L(e),e}let D=$?await H.responses.create({...M,stream:!0},{signal:_}):await (async()=>{let e=await H.responses.create({...M,stream:!1},{signal:_}).withResponse();return h=null!==e.response.headers.get("x-ai-gateway-cache-key"),e.data})(),q=$?D:(i=(t=D.output??[]).filter(e=>"message"===e.type).flatMap(e=>e.content??[]).filter(e=>"output_text"===e.type).map(e=>e.text??"").join(""),r=t.filter(e=>"reasoning"===e.type).map(c).filter(e=>e.length>0).join("\n\n"),[...t.map(e=>({type:"response.output_item.done",item:e})),...r?[{type:"response.reasoning.delta",delta:r}]:[],...i?[{type:"response.output_text.delta",delta:i}]:[],{type:"response.completed",response:D}]),F="",U={code:"",containerId:""};for await(let e of q)if("object"==typeof e&&null!==e){if((e.type?.startsWith("response.mcp_")||"response.output_item.done"===e.type&&(e.item?.type==="mcp_list_tools"||e.item?.type==="mcp_call"))&&C){let t={type:e.type,sequence_number:e.sequence_number,output_index:e.output_index,item_id:e.item_id||e.item?.id,item:e.item,delta:e.delta,arguments:e.arguments,timestamp:Date.now()};C(t)}"response.output_item.done"===e.type&&e.item?.type==="mcp_call"&&e.item?.name&&(F=e.item.name),Q=U;var Q,B=U="response.output_item.done"===e.type&&e.item?.type==="code_interpreter_call"?{code:e.item.code||"",containerId:e.item.container_id||""}:Q;if("response.output_item.done"===e.type&&e.item?.type==="message"&&e.item?.content&&I){for(let t of e.item.content)if("output_text"===t.type&&t.annotations){let e=t.annotations.filter(e=>"container_file_citation"===e.type);(e.length>0||B.code)&&I({code:B.code,containerId:B.containerId,annotations:e})}}if("response.role.delta"===e.type)continue;if("response.output_text.delta"===e.type&&"string"==typeof e.delta){let t=e.delta;if(t.length>0&&(u("assistant",t,f),!s)){s=!0;let e=Date.now()-n;b&&$&&b(e)}}if(p.has(e.type)&&"string"==typeof e.delta&&e.delta.length>0){let t=`${e.item_id??""}:${e.summary_index??e.content_index??0}`,i=null!==l&&l!==t?"\n\n":"";l=t,y?.(i+e.delta);let r=!s;s=!0,r&&b&&$&&b(Date.now()-n)}if("response.completed"===e.type&&"response"in e){let t=e.response,i=t.usage;if(t.id&&S&&S(t.id),i&&v){let e={completionTokens:i.output_tokens,promptTokens:i.input_tokens,totalTokens:i.total_tokens,...(0,a.h)(i),...h?{servedFromResponseCache:!0}:{}},t=i.output_tokens_details?.reasoning_tokens??i.completion_tokens_details?.reasoning_tokens;t&&(e.reasoningTokens=t);let r=(0,o.f)(i.cost);void 0!==r&&(e.cost=r),v(e,F)}}}return T&&T(Date.now()-n),D}catch(e){throw _?.aborted||s.f.fromError(n.f.t("llmCalls.responsesApi.requestFailed",{error:String(e)})),e}}e.s(["f",0,h],459161)},921511,e=>{var t=e.i(843476),i=e.i(271645),r=e.i(322831),n=e.i(864261),s=e.i(602869),a=e.i(845150);function o(e){return e.filter(e=>(e.version_status??"draft")!=="draft").map(e=>{var t;let i=e.version_number??1,r=e.version_status??"draft";return{label:`${e.policy_name} — v${i} (${r})${e.description?` — ${e.description}`:""}`,value:"production"===r?e.policy_name:e.policy_id?(t=e.policy_id,`policy_${t}`):e.policy_name}})}e.s(["U",0,({onChange:e,value:l,className:u,accessToken:d,disabled:p,onPoliciesLoaded:f})=>{let{t:c}=(0,r.f)(),h=(0,n.f)("viewPolicies"),[m,g]=(0,i.useState)([]),[_,y]=(0,i.useState)(!1);return((0,i.useEffect)(()=>{(async()=>{if(d&&h){y(!0);try{let e=await (0,s.$)(d);e.policies&&(g(e.policies),f?.(e.policies))}catch(e){console.error("Error fetching policies:",e)}finally{y(!1)}}})()},[d,h,f]),h)?(0,t.jsx)("div",{className:"min-w-0",children:(0,t.jsx)(a.f,{disabled:p,placeholder:c(p?"policySelector.premiumOnly":"policySelector.placeholder"),onValueChange:t=>{e(t)},value:l,loading:_,className:u,options:o(m)})}):null},"A",0,o])},710540,e=>{var t=e.i(843476),i=e.i(677572),r=e.i(196631);e.s(["w",0,function({className:e,...i}){return(0,t.jsx)("div",{className:(0,r.c)("flex min-h-0 min-w-0 w-full flex-col gap-6 p-4 sm:p-6",e),...i})},"g",0,function({className:e,...i}){return(0,t.jsx)("div",{className:(0,r.c)("flex min-h-0 min-w-0 flex-1 flex-col gap-6",e),...i})},"j",0,function({className:e,...n}){return(0,t.jsx)(i.i,{className:(0,r.c)("min-h-0 min-w-0 flex-1 gap-6",e),...n})},"m",0,function({className:e,...n}){return(0,t.jsx)(i.S,{className:(0,r.c)("flex min-h-0 min-w-0 flex-1 flex-col",e),...n})},"_",0,function({className:e,...n}){return(0,t.jsx)(i.U,{variant:"line",className:(0,r.c)("h-10 w-full shrink-0 justify-start gap-6 overflow-x-auto border-b border-border p-0",e),...n})},"H",0,function({className:e,...n}){return(0,t.jsx)(i.k,{className:(0,r.c)("flex-none px-0 font-normal group-data-horizontal/tabs:after:bottom-0",e),...n})}])},263005,e=>{var t=e.i(843476),i=e.i(322831),r=e.i(196631);e.s(["K",0,function({className:e,...i}){return(0,t.jsx)("div",{className:(0,r.c)("shrink-0",e),...i})},"V",0,function({className:e,...n}){let{t:s}=(0,i.f)();return(0,t.jsx)("div",{role:"group","aria-label":s("shell.pageHeader.controls"),className:(0,r.c)("mt-5 flex min-h-9 items-center gap-2",e),...n})},"h",0,function({className:e,...i}){return(0,t.jsx)("p",{className:(0,r.c)("mt-1.5 text-sm text-muted-foreground",e),...i})},"I",0,function({className:e,...i}){return(0,t.jsx)("h1",{className:(0,r.c)("flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-foreground [&_svg]:size-5 [&_svg]:flex-none [&_svg]:stroke-[1.75]",e),...i})}])},450240,e=>{var t=e.i(843476),i=e.i(286536),r=e.i(77705),n=e.i(271645),s=e.i(322831),a=e.i(950594);let o=n.forwardRef(({className:e,groupClassName:o,disabled:l,...u},d)=>{let{t:p}=(0,s.f)(),[f,c]=n.useState(!1);return(0,t.jsxs)(a.H,{className:o,children:[(0,t.jsx)(a.M,{...u,ref:d,type:f?"text":"password",disabled:l,className:e}),(0,t.jsx)(a.B,{align:"inline-end",children:(0,t.jsx)(a.w,{size:"icon-xs",disabled:l,"aria-label":p(f?"shared.passwordInput.hide":"shared.passwordInput.show"),onClick:()=>c(e=>!e),children:f?(0,t.jsx)(r.f,{}):(0,t.jsx)(i.f,{})})})]})});o.displayName="PasswordInput",e.s(["f",0,o])},906197,e=>{var t=e.i(843476),i=e.i(176782),r=e.i(911825),n=e.i(225913),s=e.i(196631);e.i(772436);let a=(0,n.f)("group/item flex w-full flex-wrap items-center rounded-md border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted",{variants:{variant:{default:"border-transparent",outline:"border-border",muted:"border-transparent bg-muted/50"},size:{default:"gap-3.5 px-4 py-3.5",sm:"gap-2.5 px-3 py-2.5",xs:"gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0"}},defaultVariants:{variant:"default",size:"default"}});(0,n.f)("flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none",{variants:{variant:{default:"bg-transparent",icon:"[&_svg:not([class*='size-'])]:size-4",image:"size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover"}},defaultVariants:{variant:"default"}}),e.s(["M",0,function({className:e,variant:t="default",size:n="default",render:o,...l}){return(0,r.f)({defaultTagName:"div",props:(0,i.w)({className:(0,s.c)(a({variant:t,size:n,className:e}))},l),render:o,state:{slot:"item",variant:t,size:n}})},"P",0,function({className:e,...i}){return(0,t.jsx)("div",{"data-slot":"item-actions",className:(0,s.c)("flex items-center gap-2",e),...i})},"H",0,function({className:e,...i}){return(0,t.jsx)("div",{"data-slot":"item-content",className:(0,s.c)("flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",e),...i})},"B",0,function({className:e,...i}){return(0,t.jsx)("p",{"data-slot":"item-description",className:(0,s.c)("line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",e),...i})},"t",0,function({className:e,...i}){return(0,t.jsx)("div",{role:"list","data-slot":"item-group",className:(0,s.c)("group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",e),...i})},"$",0,function({className:e,...i}){return(0,t.jsx)("div",{"data-slot":"item-title",className:(0,s.c)("line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4",e),...i})}])},170962,31052,363785,e=>{var t=e.i(843476),i=e.i(271645),r=e.i(951437),n=e.i(788015),s=e.i(552245),a=e.i(733332);let o=i.createContext(void 0);function l(e=!0){let t=i.useContext(o);if(void 0===t&&!e)throw Error((0,a.f)(7));return t}e.s(["U",0,o,"J",0,l],31052);var u=e.i(540886),d=e.i(348990),p=e.i(675606),f=e.i(380025);let c=i.forwardRef(function(e,a){let{className:o,defaultPressed:c=!1,disabled:h=!1,form:m,onPressedChange:g,pressed:_,render:y,type:b,value:v,nativeButton:x=!0,style:w,...k}=e,E=(0,n.f)(v||void 0),j=l(),O=j?.value??[],S=j?void 0:c,C=(h||j?.disabled)??!1,[R,I]=(0,r.f)({controlled:j?void 0!==E&&O.indexOf(E)>-1:_,default:S,name:"Toggle",state:"pressed"}),{getButtonProps:M,buttonRef:z}=(0,u.f)({disabled:C,native:x}),P={disabled:C,pressed:R},A=[z,a],$=[{"aria-pressed":R,onClick(e){let t=!R,i=(0,p.j)(f.f.none,e.nativeEvent);g?.(t,i),i.isCanceled||(E&&j?.setGroupValue?.(E,t,i),i.isCanceled||I(t))}},k,M],T=(0,s.f)("button",e,{enabled:!j,state:P,ref:A,props:$}),D=i.useMemo(()=>({disabled:C,focusableWhenDisabled:!1}),[C]);return j?(0,t.jsx)(d.f,{tag:"button",render:y,className:o,style:w,metadata:D,state:P,refs:A,props:$}):T});e.s(["f",0,c],363785);var h=e.i(225913),m=e.i(196631);let g=(0,h.f)("group/toggle inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",{variants:{variant:{default:"bg-transparent",outline:"border border-input bg-transparent shadow-xs hover:bg-muted"},size:{default:"h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",sm:"h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",lg:"h-10 min-w-10 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2"}},defaultVariants:{variant:"default",size:"default"}});e.s(["z",0,function({className:e,variant:i="default",size:r="default",...n}){return(0,t.jsx)(c,{"data-slot":"toggle",className:(0,m.c)(g({variant:i,size:r,className:e})),...n})},"F",0,g],170962)},916940,e=>{var t=e.i(843476),i=e.i(271645),r=e.i(602869),n=e.i(845150),s=e.i(201787);e.s(["f",0,({onChange:e,value:a,className:o,accessToken:l,placeholder:u=s.f.t("vectorStoreSelector.placeholder"),disabled:d=!1})=>{let[p,f]=(0,i.useState)([]),[c,h]=(0,i.useState)(!1);return(0,i.useEffect)(()=>{(async()=>{if(l){h(!0);try{let e=await (0,r.jn)(l);e.data&&f(e.data)}catch(e){console.error("Error fetching vector stores:",e)}finally{h(!1)}}})()},[l]),(0,t.jsx)("div",{className:"min-w-0",children:(0,t.jsx)(n.f,{placeholder:u,onValueChange:e,value:a,loading:c,className:o,disabled:d,options:p.map(e=>({label:`${e.vector_store_name||e.vector_store_id} (${e.vector_store_id})`,value:e.vector_store_id,description:e.vector_store_description||void 0}))})})}])},802954,e=>{var t=e.i(618566),i=e.i(438847),r=e.i(271645),n=e.i(759525),s=e.i(782066);e.s(["f",0,function(e,a,o="tab"){let[l,u]=(0,i.o)(o,i.d.withDefault(a)),d=(0,s.I)((0,t.usePathname)()??"")||"home",p=e.find(e=>e===l)??a;return(0,r.useEffect)(()=>{l!==p&&u(null)},[l,p,u]),[p,(0,r.useCallback)(e=>{(0,n.T)({page:d,action:"click",target:`${o}=${e}`}),u(e)},[d,o,u])]}])},735450,e=>{var t=e.i(411382),i=e.i(772325),r=e.i(54105),n=e.i(240192),s=e.i(138620);let a="/docs",o=`${a}#supported-providers`,l=`${a}#self-hosted-laya-and-nimble`,u=new Set(["/v1/decisions","/v1/systemone"]),d=t.z.object({litellm_provider:r.z.string(),mode:r.z.string().nullish(),supported_endpoints:i.z.array(r.z.string()).nullish()}),p="decisions",f=["evaluation",p],c=e=>null!=e&&f.includes(e),h=e=>c(e.mode)||(e.supported_endpoints??[]).some(e=>u.has(e)),m=e=>{let t=n.z.record(r.z.string(),s.z.unknown()).safeParse(e);return t.success?Object.entries(t.data).flatMap(([e,t])=>{let i=d.safeParse(t);return i.success?[[e,i.data]]:[]}):[]},g={decisions:0,"self-hosted":1,"needs-upgrade":2},_=t.z.object({decision_model_providers:i.z.array(r.z.string())}),y=(e,t)=>e.model.length-t.model.length||e.model.localeCompare(t.model),b=(e,t,i)=>({row:e,routeOrder:g[e.route],rankInProvider:i.slice(0,t).filter(t=>t.provider===e.provider).length});e.s(["O",0,a,"d",0,p,"Z",0,o,"L",0,l,"B",0,"playground?tab=system-one","F",0,function(e){let t=m(e),i=t.filter(([,e])=>h(e)),r=new Map([...new Set(i.map(([,e])=>e.litellm_provider))].map(e=>{let i=t.filter(([,t])=>t.litellm_provider===e);return[e,{decisionOnly:i.every(([,e])=>h(e))}]}));return{models:new Set(i.map(([e])=>e)),providers:r}},"W",0,(e,t)=>m(e).filter(([,e])=>h(e)).map(([e,i])=>({model:e,provider:i.litellm_provider,route:t?.has(i.litellm_provider)?"decisions":(i.supported_endpoints??["/v1/decisions"]).includes("/v1/decisions")?null===t?"decisions":"needs-upgrade":"self-hosted"})).toSorted(y).map(b).toSorted((e,t)=>e.routeOrder-t.routeOrder||e.rankInProvider-t.rankInProvider||e.row.provider.localeCompare(t.row.provider)).map(({row:e})=>e),"i",0,e=>c(e)?p:e??void 0,"q",0,e=>e.flatMap(e=>e===p?f:[e]),"m",0,h,"_",0,c,"r",0,(e,t,i)=>void 0!==t&&e.providers.get(t)?.decisionOnly===!0||i.some(t=>e.models.has(t)),"P",0,e=>{let t=_.safeParse(e);return t.success?new Set(t.data.decision_model_providers):null}])},841238,e=>{let t=e=>"object"==typeof e&&null!==e;e.s(["f",0,e=>{if(!t(e)||!e.error)return null;let{error:i}=e;return"string"==typeof i?i:t(i)&&"string"==typeof i.message?i.message:JSON.stringify(i)}])}],59935,(e,t,i)=>{var r;let n;e.e,r=function e(){var t,i="u">typeof self?self:"u">typeof window?window:void 0!==i?i:{},r=!i.document&&!!i.postMessage,n=i.IS_PAPA_WORKER||!1,s={},a=0,o={};function l(e){this._handle=null,this._finished=!1,this._completed=!1,this._halted=!1,this._input=null,this._baseIndex=0,this._partialLine="",this._rowCount=0,this._start=0,this._nextChunk=null,this.isFirstChunk=!0,this._completeResults={data:[],errors:[],meta:{}},(function(e){var t=b(e);t.chunkSize=parseInt(t.chunkSize),e.step||e.chunk||(t.chunkSize=null),this._handle=new c(t),(this._handle.streamer=this)._config=t}).call(this,e),this.parseChunk=function(e,t){var r=parseInt(this._config.skipFirstNLines)||0;if(this.isFirstChunk&&0<r){let t=this._config.newline;t||(s=this._config.quoteChar||'"',t=this._handle.guessLineEndings(e,s)),e=[...e.split(t).slice(r)].join(t)}this.isFirstChunk&&x(this._config.beforeFirstChunk)&&void 0!==(s=this._config.beforeFirstChunk(e))&&(e=s),this.isFirstChunk=!1,this._halted=!1;var r=this._partialLine+e,s=(this._partialLine="",this._handle.parse(r,this._baseIndex,!this._finished));if(!this._handle.paused()&&!this._handle.aborted()){if(e=s.meta.cursor,this._finished||(this._partialLine=r.substring(e-this._baseIndex),this._baseIndex=e),s&&s.data&&(this._rowCount+=s.data.length),r=this._finished||this._config.preview&&this._rowCount>=this._config.preview,n)i.postMessage({results:s,workerId:o.WORKER_ID,finished:r});else if(x(this._config.chunk)&&!t){if(this._config.chunk(s,this._handle),this._handle.paused()||this._handle.aborted())return void(this._halted=!0);this._completeResults=s=void 0}return this._config.step||this._config.chunk||(this._completeResults.data=this._completeResults.data.concat(s.data),this._completeResults.errors=this._completeResults.errors.concat(s.errors),this._completeResults.meta=s.meta),this._completed||!r||!x(this._config.complete)||s&&s.meta.aborted||(this._config.complete(this._completeResults,this._input),this._completed=!0),r||s&&s.meta.paused||this._nextChunk(),s}this._halted=!0},this._sendError=function(e){x(this._config.error)?this._config.error(e):n&&this._config.error&&i.postMessage({workerId:o.WORKER_ID,error:e,finished:!1})}}function u(e){var t;(e=e||{}).chunkSize||(e.chunkSize=o.RemoteChunkSize),l.call(this,e),this._nextChunk=r?function(){this._readChunk(),this._chunkLoaded()}:function(){this._readChunk()},this.stream=function(e){this._input=e,this._nextChunk()},this._readChunk=function(){if(this._finished)this._chunkLoaded();else{if(t=new XMLHttpRequest,this._config.withCredentials&&(t.withCredentials=this._config.withCredentials),r||(t.onload=v(this._chunkLoaded,this),t.onerror=v(this._chunkError,this)),t.open(this._config.downloadRequestBody?"POST":"GET",this._input,!r),this._config.downloadRequestHeaders){var e,i,n=this._config.downloadRequestHeaders;for(i in n)t.setRequestHeader(i,n[i])}this._config.chunkSize&&(e=this._start+this._config.chunkSize-1,t.setRequestHeader("Range","bytes="+this._start+"-"+e));try{t.send(this._config.downloadRequestBody)}catch(e){this._chunkError(e.message)}r&&0===t.status&&this._chunkError()}},this._chunkLoaded=function(){let e;4===t.readyState&&(t.status<200||400<=t.status?this._chunkError():(this._start+=this._config.chunkSize||t.responseText.length,this._finished=!this._config.chunkSize||this._start>=(null!==(e=(e=t).getResponseHeader("Content-Range"))?parseInt(e.substring(e.lastIndexOf("/")+1)):-1),this.parseChunk(t.responseText)))},this._chunkError=function(e){e=t.statusText||e,this._sendError(Error(e))}}function d(e){(e=e||{}).chunkSize||(e.chunkSize=o.LocalChunkSize),l.call(this,e);var t,i,r="u">typeof FileReader;this.stream=function(e){this._input=e,i=e.slice||e.webkitSlice||e.mozSlice,r?((t=new FileReader).onload=v(this._chunkLoaded,this),t.onerror=v(this._chunkError,this)):t=new FileReaderSync,this._nextChunk()},this._nextChunk=function(){this._finished||this._config.preview&&!(this._rowCount<this._config.preview)||this._readChunk()},this._readChunk=function(){var e=this._input,n=(this._config.chunkSize&&(n=Math.min(this._start+this._config.chunkSize,this._input.size),e=i.call(e,this._start,n)),t.readAsText(e,this._config.encoding));r||this._chunkLoaded({target:{result:n}})},this._chunkLoaded=function(e){this._start+=this._config.chunkSize,this._finished=!this._config.chunkSize||this._start>=this._input.size,this.parseChunk(e.target.result)},this._chunkError=function(){this._sendError(t.error)}}function p(e){var t;l.call(this,e=e||{}),this.stream=function(e){return t=e,this._nextChunk()},this._nextChunk=function(){var e,i;if(!this._finished)return t=(e=this._config.chunkSize)?(i=t.substring(0,e),t.substring(e)):(i=t,""),this._finished=!t,this.parseChunk(i)}}function f(e){l.call(this,e=e||{});var t=[],i=!0,r=!1;this.pause=function(){l.prototype.pause.apply(this,arguments),this._input.pause()},this.resume=function(){l.prototype.resume.apply(this,arguments),this._input.resume()},this.stream=function(e){this._input=e,this._input.on("data",this._streamData),this._input.on("end",this._streamEnd),this._input.on("error",this._streamError)},this._checkIsFinished=function(){r&&1===t.length&&(this._finished=!0)},this._nextChunk=function(){this._checkIsFinished(),t.length?this.parseChunk(t.shift()):i=!0},this._streamData=v(function(e){try{t.push("string"==typeof e?e:e.toString(this._config.encoding)),i&&(i=!1,this._checkIsFinished(),this.parseChunk(t.shift()))}catch(e){this._streamError(e)}},this),this._streamError=v(function(e){this._streamCleanUp(),this._sendError(e)},this),this._streamEnd=v(function(){this._streamCleanUp(),r=!0,this._streamData("")},this),this._streamCleanUp=v(function(){this._input.removeListener("data",this._streamData),this._input.removeListener("end",this._streamEnd),this._input.removeListener("error",this._streamError)},this)}function c(e){var t,i,r,n,s=/^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/,a=/^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/,l=this,u=0,d=0,p=!1,f=!1,c=[],g={data:[],errors:[],meta:{}};function _(t){return"greedy"===e.skipEmptyLines?""===t.join("").trim():1===t.length&&0===t[0].length}function y(){if(g&&r&&(w("Delimiter","UndetectableDelimiter","Unable to auto-detect delimiting character; defaulted to '"+o.DefaultDelimiter+"'"),r=!1),e.skipEmptyLines&&(g.data=g.data.filter(function(e){return!_(e)})),v()){if(g)if(Array.isArray(g.data[0])){for(var t,i=0;v()&&i<g.data.length;i++)g.data[i].forEach(n);g.data.splice(0,1)}else g.data.forEach(n);function n(t,i){x(e.transformHeader)&&(t=e.transformHeader(t,i)),c.push(t)}}function l(t,i){for(var r=e.header?{}:[],n=0;n<t.length;n++){var o=n,l=t[n],l=((t,i)=>(e.dynamicTypingFunction&&void 0===e.dynamicTyping[t]&&(e.dynamicTyping[t]=e.dynamicTypingFunction(t)),!0===(e.dynamicTyping[t]||e.dynamicTyping))?"true"===i||"TRUE"===i||"false"!==i&&"FALSE"!==i&&((e=>{if(s.test(e)&&-0x20000000000000<(e=parseFloat(e))&&e<0x20000000000000)return 1})(i)?parseFloat(i):a.test(i)?new Date(i):""===i?null:i):i)(o=e.header?n>=c.length?"__parsed_extra":c[n]:o,l=e.transform?e.transform(l,o):l);"__parsed_extra"===o?(r[o]=r[o]||[],r[o].push(l)):r[o]=l}return e.header&&(n>c.length?w("FieldMismatch","TooManyFields","Too many fields: expected "+c.length+" fields but parsed "+n,d+i):n<c.length&&w("FieldMismatch","TooFewFields","Too few fields: expected "+c.length+" fields but parsed "+n,d+i)),r}g&&(e.header||e.dynamicTyping||e.transform)&&(t=1,!g.data.length||Array.isArray(g.data[0])?(g.data=g.data.map(l),t=g.data.length):g.data=l(g.data,0),e.header&&g.meta&&(g.meta.fields=c),d+=t)}function v(){return e.header&&0===c.length}function w(e,t,i,r){e={type:e,code:t,message:i},void 0!==r&&(e.row=r),g.errors.push(e)}x(e.step)&&(n=e.step,e.step=function(t){g=t,v()?y():(y(),0!==g.data.length&&(u+=t.data.length,e.preview&&u>e.preview?i.abort():(g.data=g.data[0],n(g,l))))}),this.parse=function(n,s,a){var l=e.quoteChar||'"',l=(e.newline||(e.newline=this.guessLineEndings(n,l)),r=!1,e.delimiter?x(e.delimiter)&&(e.delimiter=e.delimiter(n),g.meta.delimiter=e.delimiter):((l=((t,i,r,n,s)=>{var a,l,u,d;s=s||[",","	","|",";",o.RECORD_SEP,o.UNIT_SEP];for(var p=0;p<s.length;p++){for(var f,c=s[p],h=0,g=0,y=0,b=(u=void 0,new m({comments:n,delimiter:c,newline:i,preview:10}).parse(t)),v=0;v<b.data.length;v++)r&&_(b.data[v])?y++:(g+=f=b.data[v].length,void 0===u?u=f:0<f&&(h+=Math.abs(f-u),u=f));0<b.data.length&&(g/=b.data.length-y),(void 0===l||h<=l)&&(void 0===d||d<g)&&1.99<g&&(l=h,a=c,d=g)}return{successful:!!(e.delimiter=a),bestDelimiter:a}})(n,e.newline,e.skipEmptyLines,e.comments,e.delimitersToGuess)).successful?e.delimiter=l.bestDelimiter:(r=!0,e.delimiter=o.DefaultDelimiter),g.meta.delimiter=e.delimiter),b(e));return e.preview&&e.header&&l.preview++,t=n,g=(i=new m(l)).parse(t,s,a),y(),p?{meta:{paused:!0}}:g||{meta:{paused:!1}}},this.paused=function(){return p},this.pause=function(){p=!0,i.abort(),t=x(e.chunk)?"":t.substring(i.getCharIndex())},this.resume=function(){l.streamer._halted?(p=!1,l.streamer.parseChunk(t,!0)):setTimeout(l.resume,3)},this.aborted=function(){return f},this.abort=function(){f=!0,i.abort(),g.meta.aborted=!0,x(e.complete)&&e.complete(g),t=""},this.guessLineEndings=function(e,t){e=e.substring(0,1048576);var t=RegExp(h(t)+"([^]*?)"+h(t),"gm"),i=(e=e.replace(t,"")).split("\r"),t=e.split("\n"),e=1<t.length&&t[0].length<i[0].length;if(1===i.length||e)return"\n";for(var r=0,n=0;n<i.length;n++)"\n"===i[n][0]&&r++;return r>=i.length/2?"\r\n":"\r"}}function h(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function m(e){var t=(e=e||{}).delimiter,i=e.newline,r=e.comments,n=e.step,s=e.preview,a=e.fastMode,l=null,u=!1,d=null==e.quoteChar?'"':e.quoteChar,p=d;if(void 0!==e.escapeChar&&(p=e.escapeChar),("string"!=typeof t||-1<o.BAD_DELIMITERS.indexOf(t))&&(t=","),r===t)throw Error("Comment character same as delimiter");!0===r?r="#":("string"!=typeof r||-1<o.BAD_DELIMITERS.indexOf(r))&&(r=!1),"\n"!==i&&"\r"!==i&&"\r\n"!==i&&(i="\n");var f=0,c=!1;this.parse=function(o,m,g){if("string"!=typeof o)throw Error("Input must be a string");var _=o.length,y=t.length,b=i.length,v=r.length,w=x(n),k=[],E=[],j=[],O=f=0;if(!o)return q();if(a||!1!==a&&-1===o.indexOf(d)){for(var S=o.split(i),C=0;C<S.length;C++){if(j=S[C],f+=j.length,C!==S.length-1)f+=i.length;else if(g)break;if(!r||j.substring(0,v)!==r){if(w){if(k=[],A(j.split(t)),L(),c)return q()}else A(j.split(t));if(s&&s<=C)return k=k.slice(0,s),q(!0)}}return q()}for(var R=o.indexOf(t,f),I=o.indexOf(i,f),M=RegExp(h(p)+h(d),"g"),z=o.indexOf(d,f);;)if(o[f]===d)for(z=f,f++;;){if(-1===(z=o.indexOf(d,z+1)))return g||E.push({type:"Quotes",code:"MissingQuotes",message:"Quoted field unterminated",row:k.length,index:f}),T();if(z===_-1)return T(o.substring(f,z).replace(M,d));if(d===p&&o[z+1]===p)z++;else if(d===p||0===z||o[z-1]!==p){-1!==R&&R<z+1&&(R=o.indexOf(t,z+1));var P=$(-1===(I=-1!==I&&I<z+1?o.indexOf(i,z+1):I)?R:Math.min(R,I));if(o.substr(z+1+P,y)===t){j.push(o.substring(f,z).replace(M,d)),o[f=z+1+P+y]!==d&&(z=o.indexOf(d,f)),R=o.indexOf(t,f),I=o.indexOf(i,f);break}if(P=$(I),o.substring(z+1+P,z+1+P+b)===i){if(j.push(o.substring(f,z).replace(M,d)),D(z+1+P+b),R=o.indexOf(t,f),z=o.indexOf(d,f),w&&(L(),c))return q();if(s&&k.length>=s)return q(!0);break}E.push({type:"Quotes",code:"InvalidQuotes",message:"Trailing quote on quoted field is malformed",row:k.length,index:f}),z++}}else if(r&&0===j.length&&o.substring(f,f+v)===r){if(-1===I)return q();f=I+b,I=o.indexOf(i,f),R=o.indexOf(t,f)}else if(-1!==R&&(R<I||-1===I))j.push(o.substring(f,R)),f=R+y,R=o.indexOf(t,f);else{if(-1===I)break;if(j.push(o.substring(f,I)),D(I+b),w&&(L(),c))return q();if(s&&k.length>=s)return q(!0)}return T();function A(e){k.push(e),O=f}function $(e){return -1!==e&&(e=o.substring(z+1,e))&&""===e.trim()?e.length:0}function T(e){return g||(void 0===e&&(e=o.substring(f)),j.push(e),f=_,A(j),w&&L()),q()}function D(e){f=e,A(j),j=[],I=o.indexOf(i,f)}function q(r){if(e.header&&!m&&k.length&&!u){var n=k[0],s=Object.create(null),a=new Set(n);let t=!1;for(let i=0;i<n.length;i++){let r=n[i];if(s[r=x(e.transformHeader)?e.transformHeader(r,i):r]){let e,o=s[r];for(;e=r+"_"+o,o++,a.has(e););a.add(e),n[i]=e,s[r]++,t=!0,(l=null===l?{}:l)[e]=r}else s[r]=1,n[i]=r;a.add(r)}t&&console.warn("Duplicate headers found and renamed."),u=!0}return{data:k,errors:E,meta:{delimiter:t,linebreak:i,aborted:c,truncated:!!r,cursor:O+(m||0),renamedHeaders:l}}}function L(){n(q()),k=[],E=[]}},this.abort=function(){c=!0},this.getCharIndex=function(){return f}}function g(e){var t=e.data,i=s[t.workerId],r=!1;if(t.error)i.userError(t.error,t.file);else if(t.results&&t.results.data){var n={abort:function(){r=!0,_(t.workerId,{data:[],errors:[],meta:{aborted:!0}})},pause:y,resume:y};if(x(i.userStep)){for(var a=0;a<t.results.data.length&&(i.userStep({data:t.results.data[a],errors:t.results.errors,meta:t.results.meta},n),!r);a++);delete t.results}else x(i.userChunk)&&(i.userChunk(t.results,n,t.file),delete t.results)}t.finished&&!r&&_(t.workerId,t.results)}function _(e,t){var i=s[e];x(i.userComplete)&&i.userComplete(t),i.terminate(),delete s[e]}function y(){throw Error("Not implemented.")}function b(e){if("object"!=typeof e||null===e)return e;var t,i=Array.isArray(e)?[]:{};for(t in e)i[t]=b(e[t]);return i}function v(e,t){return function(){e.apply(t,arguments)}}function x(e){return"function"==typeof e}return o.parse=function(t,r){var n,l,c,h=(r=r||{}).dynamicTyping||!1;if(x(h)&&(r.dynamicTypingFunction=h,h={}),r.dynamicTyping=h,r.transform=!!x(r.transform)&&r.transform,!r.worker||!o.WORKERS_SUPPORTED){let e;return h=null,o.NODE_STREAM_INPUT,"string"==typeof t?(t=65279!==(e=t).charCodeAt(0)?e:e.slice(1),h=new(r.download?u:p)(r)):!0===t.readable&&x(t.read)&&x(t.on)?h=new f(r):(i.File&&t instanceof File||t instanceof Object)&&(h=new d(r)),h.stream(t)}(h=!!o.WORKERS_SUPPORTED&&(l=i.URL||i.webkitURL||null,c=e.toString(),n=o.BLOB_URL||(o.BLOB_URL=l.createObjectURL(new Blob(["var global = (function() { if (typeof self !== 'undefined') { return self; } if (typeof window !== 'undefined') { return window; } if (typeof global !== 'undefined') { return global; } return {}; })(); global.IS_PAPA_WORKER=true; ","(",c,")();"],{type:"text/javascript"}))),(n=new i.Worker(n)).onmessage=g,n.id=a++,s[n.id]=n)).userStep=r.step,h.userChunk=r.chunk,h.userComplete=r.complete,h.userError=r.error,r.step=x(r.step),r.chunk=x(r.chunk),r.complete=x(r.complete),r.error=x(r.error),delete r.worker,h.postMessage({input:t,config:r,workerId:h.id})},o.unparse=function(e,t){var i=!1,r=!0,n=",",s="\r\n",a='"',l=a+a,u=!1,d=null,p=!1,f=((()=>{if("object"==typeof t){if("string"!=typeof t.delimiter||o.BAD_DELIMITERS.filter(function(e){return -1!==t.delimiter.indexOf(e)}).length||(n=t.delimiter),("boolean"==typeof t.quotes||"function"==typeof t.quotes||Array.isArray(t.quotes))&&(i=t.quotes),"boolean"!=typeof t.skipEmptyLines&&"string"!=typeof t.skipEmptyLines||(u=t.skipEmptyLines),"string"==typeof t.newline&&(s=t.newline),"string"==typeof t.quoteChar&&(a=t.quoteChar),"boolean"==typeof t.header&&(r=t.header),Array.isArray(t.columns)){if(0===t.columns.length)throw Error("Option columns is empty");d=t.columns}void 0!==t.escapeChar&&(l=t.escapeChar+a),t.escapeFormulae instanceof RegExp?p=t.escapeFormulae:"boolean"==typeof t.escapeFormulae&&t.escapeFormulae&&(p=/^[=+\-@\t\r].*$/)}})(),RegExp(h(a),"g"));if("string"==typeof e&&(e=JSON.parse(e)),Array.isArray(e)){if(!e.length||Array.isArray(e[0]))return c(null,e,u);if("object"==typeof e[0])return c(d||Object.keys(e[0]),e,u)}else if("object"==typeof e)return"string"==typeof e.data&&(e.data=JSON.parse(e.data)),Array.isArray(e.data)&&(e.fields||(e.fields=e.meta&&e.meta.fields||d),e.fields||(e.fields=Array.isArray(e.data[0])?e.fields:"object"==typeof e.data[0]?Object.keys(e.data[0]):[]),Array.isArray(e.data[0])||"object"==typeof e.data[0]||(e.data=[e.data])),c(e.fields||[],e.data||[],u);throw Error("Unable to serialize unrecognized input");function c(e,t,i){var a="",o=("string"==typeof e&&(e=JSON.parse(e)),"string"==typeof t&&(t=JSON.parse(t)),Array.isArray(e)&&0<e.length),l=!Array.isArray(t[0]);if(o&&r){for(var u=0;u<e.length;u++)0<u&&(a+=n),a+=m(e[u],u);0<t.length&&(a+=s)}for(var d=0;d<t.length;d++){var p=(o?e:t[d]).length,f=!1,c=o?0===Object.keys(t[d]).length:0===t[d].length;if(i&&!o&&(f="greedy"===i?""===t[d].join("").trim():1===t[d].length&&0===t[d][0].length),"greedy"===i&&o){for(var h=[],g=0;g<p;g++){var _=l?e[g]:g;h.push(t[d][_])}f=""===h.join("").trim()}if(!f){for(var y=0;y<p;y++){0<y&&!c&&(a+=n);var b=o&&l?e[y]:y;a+=m(t[d][b],y)}d<t.length-1&&(!i||0<p&&!c)&&(a+=s)}}return a}function m(e,t){var r,s;return null==e?"":e.constructor===Date?JSON.stringify(e).slice(1,25):(s=!1,p&&"string"==typeof e&&p.test(e)&&(e="'"+e,s=!0),r=e.toString().replace(f,l),(s=s||!0===i||"function"==typeof i&&i(e,t)||Array.isArray(i)&&i[t]||((e,t)=>{for(var i=0;i<t.length;i++)if(-1<e.indexOf(t[i]))return!0;return!1})(r,o.BAD_DELIMITERS)||-1<r.indexOf(n)||" "===r.charAt(0)||" "===r.charAt(r.length-1))?a+r+a:r)}},o.RECORD_SEP="\x1e",o.UNIT_SEP="\x1f",o.BYTE_ORDER_MARK="\uFEFF",o.BAD_DELIMITERS=["\r","\n",'"',o.BYTE_ORDER_MARK],o.WORKERS_SUPPORTED=!r&&!!i.Worker,o.NODE_STREAM_INPUT=1,o.LocalChunkSize=0xa00000,o.RemoteChunkSize=5242880,o.DefaultDelimiter=",",o.Parser=m,o.ParserHandle=c,o.NetworkStreamer=u,o.FileStreamer=d,o.StringStreamer=p,o.ReadableStreamStreamer=f,i.jQuery&&((t=i.jQuery).fn.parse=function(e){var r=e.config||{},n=[];return this.each(function(e){if(!("INPUT"===t(this).prop("tagName").toUpperCase()&&"file"===t(this).attr("type").toLowerCase()&&i.FileReader)||!this.files||0===this.files.length)return!0;for(var s=0;s<this.files.length;s++)n.push({file:this.files[s],inputElem:this,instanceConfig:t.extend({},r)})}),s(),this;function s(){if(0===n.length)x(e.complete)&&e.complete();else{var i,r,s,l=n[0];if(x(e.before)){var u=e.before(l.file,l.inputElem);if("object"==typeof u){if("abort"===u.action)return i=l.file,r=l.inputElem,s=u.reason,void(x(e.error)&&e.error({name:"AbortError"},i,r,s));if("skip"===u.action)return void a();"object"==typeof u.config&&(l.instanceConfig=t.extend(l.instanceConfig,u.config))}else if("skip"===u)return void a()}var d=l.instanceConfig.complete;l.instanceConfig.complete=function(e){x(d)&&d(e,l.file,l.inputElem),a()},o.parse(l.file,l.instanceConfig)}}function a(){n.splice(0,1),s()}}),n&&(i.onmessage=function(e){e=e.data,void 0===o.WORKER_ID&&e&&(o.WORKER_ID=e.workerId),"string"==typeof e.input?i.postMessage({workerId:o.WORKER_ID,results:o.parse(e.input,e.config),finished:!0}):(i.File&&e.input instanceof File||e.input instanceof Object)&&(e=o.parse(e.input,e.config))&&i.postMessage({workerId:o.WORKER_ID,results:e,finished:!0})}),(u.prototype=Object.create(l.prototype)).constructor=u,(d.prototype=Object.create(l.prototype)).constructor=d,(p.prototype=Object.create(p.prototype)).constructor=p,(f.prototype=Object.create(l.prototype)).constructor=f,o},"function"==typeof define&&define.amd?void 0!==(n=r())&&e.v(n):t.exports=r()}]);