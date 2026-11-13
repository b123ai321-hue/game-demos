// three-mesh-bvh 0.7.6 (MIT, Garrett Johnson, https://github.com/gkjohnson/three-mesh-bvh), bundled with esbuild: MeshBVH, computeBoundsTree, acceleratedRaycast only.
import{BufferAttribute as yi,Box3 as An,FrontSide as hn}from"three";var Ee=Math.pow(2,-24),Lt=Symbol("SKIP_GENERATION");import{BufferAttribute as Dn}from"three";function In(n){return n.index?n.index.count:n.attributes.position.count}function W(n){return In(n)/3}function Mn(n,e=ArrayBuffer){return n>65535?new Uint32Array(new e(4*n)):new Uint16Array(new e(2*n))}function De(n,e){if(!n.index){let t=n.attributes.position.count,i=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,r=Mn(t,i);n.setIndex(new Dn(r,1));for(let a=0;a<t;a++)r[a]=a}}function se(n){let e=W(n),t=n.drawRange,i=t.start/3,r=(t.start+t.count)/3,a=Math.max(0,i),s=Math.min(e,r)-a;return[{offset:Math.floor(a),count:Math.floor(s)}]}function re(n){if(!n.groups||!n.groups.length)return se(n);let e=[],t=new Set,i=n.drawRange,r=i.start/3,a=(i.start+i.count)/3;for(let o of n.groups){let c=o.start/3,p=(o.start+o.count)/3;t.add(Math.max(r,c)),t.add(Math.min(a,p))}let s=Array.from(t.values()).sort((o,c)=>o-c);for(let o=0;o<s.length-1;o++){let c=s[o],p=s[o+1];e.push({offset:Math.floor(c),count:Math.floor(p-c)})}return e}function Ie(n){if(n.groups.length===0)return!1;let e=W(n),t=re(n).sort((a,s)=>a.offset-s.offset),i=t[t.length-1];i.count=Math.min(e-i.offset,i.count);let r=0;return t.forEach(({count:a})=>r+=a),e!==r}function Ct(n,e,t,i,r){let a=1/0,s=1/0,o=1/0,c=-1/0,p=-1/0,f=-1/0,u=1/0,l=1/0,m=1/0,w=-1/0,b=-1/0,y=-1/0;for(let x=e*6,d=(e+t)*6;x<d;x+=6){let h=n[x+0],A=n[x+1],T=h-A,B=h+A;T<a&&(a=T),B>c&&(c=B),h<u&&(u=h),h>w&&(w=h);let g=n[x+2],_=n[x+3],v=g-_,S=g+_;v<s&&(s=v),S>p&&(p=S),g<l&&(l=g),g>b&&(b=g);let E=n[x+4],P=n[x+5],D=E-P,I=E+P;D<o&&(o=D),I>f&&(f=I),E<m&&(m=E),E>y&&(y=E)}i[0]=a,i[1]=s,i[2]=o,i[3]=c,i[4]=p,i[5]=f,r[0]=u,r[1]=l,r[2]=m,r[3]=w,r[4]=b,r[5]=y}function Me(n,e=null,t=null,i=null){let r=n.attributes.position,a=n.index?n.index.array:null,s=W(n),o=r.normalized,c;e===null?(c=new Float32Array(s*6*4),t=0,i=s):(c=e,t=t||0,i=i||s);let p=r.array,f=r.offset||0,u=3;r.isInterleavedBufferAttribute&&(u=r.data.stride);let l=["getX","getY","getZ"];for(let m=t;m<t+i;m++){let w=m*3,b=m*6,y=w+0,x=w+1,d=w+2;a&&(y=a[y],x=a[x],d=a[d]),o||(y=y*u+f,x=x*u+f,d=d*u+f);for(let h=0;h<3;h++){let A,T,B;o?(A=r[l[h]](y),T=r[l[h]](x),B=r[l[h]](d)):(A=p[y+h],T=p[x+h],B=p[d+h]);let g=A;T<g&&(g=T),B<g&&(g=B);let _=A;T>_&&(_=T),B>_&&(_=B);let v=(_-g)/2,S=h*2;c[b+S+0]=g+v,c[b+S+1]=v+(Math.abs(g)+v)*Ee}}return c}function N(n,e,t){return t.min.x=e[n],t.min.y=e[n+1],t.min.z=e[n+2],t.max.x=e[n+3],t.max.y=e[n+4],t.max.z=e[n+5],t}function oe(n){let e=-1,t=-1/0;for(let i=0;i<3;i++){let r=n[i+3]-n[i];r>t&&(t=r,e=i)}return e}function ce(n,e){e.set(n)}function ae(n,e,t){let i,r;for(let a=0;a<3;a++){let s=a+3;i=n[a],r=e[a],t[a]=i<r?i:r,i=n[s],r=e[s],t[s]=i>r?i:r}}function gt(n,e,t){for(let i=0;i<3;i++){let r=e[n+2*i],a=e[n+2*i+1],s=r-a,o=r+a;s<t[i]&&(t[i]=s),o>t[i+3]&&(t[i+3]=o)}}function st(n){let e=n[3]-n[0],t=n[4]-n[1],i=n[5]-n[2];return 2*(e*t+t*i+i*e)}var Z=32,Nn=(n,e)=>n.candidate-e.candidate,J=new Array(Z).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),Rt=new Float32Array(6);function Le(n,e,t,i,r,a){let s=-1,o=0;if(a===0)s=oe(e),s!==-1&&(o=(e[s]+e[s+3])/2);else if(a===1)s=oe(n),s!==-1&&(o=Ln(t,i,r,s));else if(a===2){let c=st(n),p=1.25*r,f=i*6,u=(i+r)*6;for(let l=0;l<3;l++){let m=e[l],y=(e[l+3]-m)/Z;if(r<Z/4){let x=[...J];x.length=r;let d=0;for(let A=f;A<u;A+=6,d++){let T=x[d];T.candidate=t[A+2*l],T.count=0;let{bounds:B,leftCacheBounds:g,rightCacheBounds:_}=T;for(let v=0;v<3;v++)_[v]=1/0,_[v+3]=-1/0,g[v]=1/0,g[v+3]=-1/0,B[v]=1/0,B[v+3]=-1/0;gt(A,t,B)}x.sort(Nn);let h=r;for(let A=0;A<h;A++){let T=x[A];for(;A+1<h&&x[A+1].candidate===T.candidate;)x.splice(A+1,1),h--}for(let A=f;A<u;A+=6){let T=t[A+2*l];for(let B=0;B<h;B++){let g=x[B];T>=g.candidate?gt(A,t,g.rightCacheBounds):(gt(A,t,g.leftCacheBounds),g.count++)}}for(let A=0;A<h;A++){let T=x[A],B=T.count,g=r-T.count,_=T.leftCacheBounds,v=T.rightCacheBounds,S=0;B!==0&&(S=st(_)/c);let E=0;g!==0&&(E=st(v)/c);let P=1+1.25*(S*B+E*g);P<p&&(s=l,p=P,o=T.candidate)}}else{for(let h=0;h<Z;h++){let A=J[h];A.count=0,A.candidate=m+y+h*y;let T=A.bounds;for(let B=0;B<3;B++)T[B]=1/0,T[B+3]=-1/0}for(let h=f;h<u;h+=6){let B=~~((t[h+2*l]-m)/y);B>=Z&&(B=Z-1);let g=J[B];g.count++,gt(h,t,g.bounds)}let x=J[Z-1];ce(x.bounds,x.rightCacheBounds);for(let h=Z-2;h>=0;h--){let A=J[h],T=J[h+1];ae(A.bounds,T.rightCacheBounds,A.rightCacheBounds)}let d=0;for(let h=0;h<Z-1;h++){let A=J[h],T=A.count,B=A.bounds,_=J[h+1].rightCacheBounds;T!==0&&(d===0?ce(B,Rt):ae(B,Rt,Rt)),d+=T;let v=0,S=0;d!==0&&(v=st(Rt)/c);let E=r-d;E!==0&&(S=st(_)/c);let P=1+1.25*(v*d+S*E);P<p&&(s=l,p=P,o=A.candidate)}}}}else console.warn(`MeshBVH: Invalid build strategy value ${a} used.`);return{axis:s,pos:o}}function Ln(n,e,t,i){let r=0;for(let a=e,s=e+t;a<s;a++)r+=n[a*6+i*2];return r/t}var rt=class{constructor(){this.boundingData=new Float32Array(6)}};function Ce(n,e,t,i,r,a){let s=i,o=i+r-1,c=a.pos,p=a.axis*2;for(;;){for(;s<=o&&t[s*6+p]<c;)s++;for(;s<=o&&t[o*6+p]>=c;)o--;if(s<o){for(let f=0;f<3;f++){let u=e[s*3+f];e[s*3+f]=e[o*3+f],e[o*3+f]=u}for(let f=0;f<6;f++){let u=t[s*6+f];t[s*6+f]=t[o*6+f],t[o*6+f]=u}s++,o--}else return s}}function Re(n,e,t,i,r,a){let s=i,o=i+r-1,c=a.pos,p=a.axis*2;for(;;){for(;s<=o&&t[s*6+p]<c;)s++;for(;s<=o&&t[o*6+p]>=c;)o--;if(s<o){let f=n[s];n[s]=n[o],n[o]=f;for(let u=0;u<6;u++){let l=t[s*6+u];t[s*6+u]=t[o*6+u],t[o*6+u]=l}s++,o--}else return s}}function C(n,e){return e[n+15]===65535}function V(n,e){return e[n+6]}function z(n,e){return e[n+14]}function O(n){return n+8}function H(n,e){return e[n+6]}function Ut(n,e){return e[n+7]}var Ue,Bt,Vt,Ve,Cn=Math.pow(2,32);function zt(n){return"count"in n?1:1+zt(n.left)+zt(n.right)}function ze(n,e,t){return Ue=new Float32Array(t),Bt=new Uint32Array(t),Vt=new Uint16Array(t),Ve=new Uint8Array(t),le(n,e)}function le(n,e){let t=n/4,i=n/2,r="count"in e,a=e.boundingData;for(let s=0;s<6;s++)Ue[t+s]=a[s];if(r)if(e.buffer){let s=e.buffer;Ve.set(new Uint8Array(s),n);for(let o=n,c=n+s.byteLength;o<c;o+=32){let p=o/2;C(p,Vt)||(Bt[o/4+6]+=t)}return n+s.byteLength}else{let s=e.offset,o=e.count;return Bt[t+6]=s,Vt[i+14]=o,Vt[i+15]=65535,n+32}else{let s=e.left,o=e.right,c=e.splitAxis,p;if(p=le(n+32,s),p/4>Cn)throw new Error("MeshBVH: Cannot store child pointer greater than 32 bits.");return Bt[t+6]=p/4,p=le(p,o),Bt[t+7]=c,p}}function Rn(n,e){let t=(n.index?n.index.count:n.attributes.position.count)/3,i=t>2**16,r=i?4:2,a=e?new SharedArrayBuffer(t*r):new ArrayBuffer(t*r),s=i?new Uint32Array(a):new Uint16Array(a);for(let o=0,c=s.length;o<c;o++)s[o]=o;return s}function Un(n,e,t,i,r){let{maxDepth:a,verbose:s,maxLeafTris:o,strategy:c,onProgress:p,indirect:f}=r,u=n._indirectBuffer,l=n.geometry,m=l.index?l.index.array:null,w=f?Re:Ce,b=W(l),y=new Float32Array(6),x=!1,d=new rt;return Ct(e,t,i,d.boundingData,y),A(d,t,i,y),d;function h(T){p&&p(T/b)}function A(T,B,g,_=null,v=0){if(!x&&v>=a&&(x=!0,s&&(console.warn(`MeshBVH: Max depth of ${a} reached when generating BVH. Consider increasing maxDepth.`),console.warn(l))),g<=o||v>=a)return h(B+g),T.offset=B,T.count=g,T;let S=Le(T.boundingData,_,e,B,g,c);if(S.axis===-1)return h(B+g),T.offset=B,T.count=g,T;let E=w(u,m,e,B,g,S);if(E===B||E===B+g)h(B+g),T.offset=B,T.count=g;else{T.splitAxis=S.axis;let P=new rt,D=B,I=E-B;T.left=P,Ct(e,D,I,P.boundingData,y),A(P,D,I,y,v+1);let F=new rt,U=E,$=g-I;T.right=F,Ct(e,U,$,F.boundingData,y),A(F,U,$,y,v+1)}return T}}function Oe(n,e){let t=n.geometry;e.indirect&&(n._indirectBuffer=Rn(t,e.useSharedArrayBuffer),Ie(t)&&!e.verbose&&console.warn('MeshBVH: Provided geometry contains groups that do not fully span the vertex contents while using the "indirect" option. BVH may incorrectly report intersections on unrendered portions of the geometry.')),n._indirectBuffer||De(t,e);let i=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,r=Me(t),a=e.indirect?se(t):re(t);n._roots=a.map(s=>{let o=Un(n,r,s.offset,s.count,e),c=zt(o),p=new i(32*c);return ze(0,o,p),p})}import{Vector3 as Q,Matrix4 as ke,Line3 as qe}from"three";import{Vector3 as Vn}from"three";var G=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let i=1/0,r=-1/0;for(let a=0,s=e.length;a<s;a++){let c=e[a][t];i=c<i?c:i,r=c>r?c:r}this.min=i,this.max=r}setFromPoints(e,t){let i=1/0,r=-1/0;for(let a=0,s=t.length;a<s;a++){let o=t[a],c=e.dot(o);i=c<i?c:i,r=c>r?c:r}this.min=i,this.max=r}isSeparated(e){return this.min>e.max||e.min>this.max}};G.prototype.setFromBox=(function(){let n=new Vn;return function(t,i){let r=i.min,a=i.max,s=1/0,o=-1/0;for(let c=0;c<=1;c++)for(let p=0;p<=1;p++)for(let f=0;f<=1;f++){n.x=r.x*c+a.x*(1-c),n.y=r.y*p+a.y*(1-p),n.z=r.z*f+a.z*(1-f);let u=t.dot(n);s=Math.min(u,s),o=Math.max(u,o)}this.min=s,this.max=o}})();var Ki=(function(){let n=new G;return function(t,i){let r=t.points,a=t.satAxes,s=t.satBounds,o=i.points,c=i.satAxes,p=i.satBounds;for(let f=0;f<3;f++){let u=s[f],l=a[f];if(n.setFromPoints(l,o),u.isSeparated(n))return!1}for(let f=0;f<3;f++){let u=p[f],l=c[f];if(n.setFromPoints(l,r),u.isSeparated(n))return!1}}})();import{Triangle as qn,Vector3 as X,Line3 as ot,Sphere as Gn,Plane as Xn}from"three";import{Vector3 as it,Vector2 as zn,Plane as On,Line3 as Hn}from"three";var kn=(function(){let n=new it,e=new it,t=new it;return function(r,a,s){let o=r.start,c=n,p=a.start,f=e;t.subVectors(o,p),n.subVectors(r.end,r.start),e.subVectors(a.end,a.start);let u=t.dot(f),l=f.dot(c),m=f.dot(f),w=t.dot(c),y=c.dot(c)*m-l*l,x,d;y!==0?x=(u*l-w*m)/y:x=0,d=(u+x*l)/m,s.x=x,s.y=d}})(),_t=(function(){let n=new zn,e=new it,t=new it;return function(r,a,s,o){kn(r,a,n);let c=n.x,p=n.y;if(c>=0&&c<=1&&p>=0&&p<=1){r.at(c,s),a.at(p,o);return}else if(c>=0&&c<=1){p<0?a.at(0,o):a.at(1,o),r.closestPointToPoint(o,!0,s);return}else if(p>=0&&p<=1){c<0?r.at(0,s):r.at(1,s),a.closestPointToPoint(s,!0,o);return}else{let f;c<0?f=r.start:f=r.end;let u;p<0?u=a.start:u=a.end;let l=e,m=t;if(r.closestPointToPoint(u,!0,e),a.closestPointToPoint(f,!0,t),l.distanceToSquared(u)<=m.distanceToSquared(f)){s.copy(l),o.copy(u);return}else{s.copy(f),o.copy(m);return}}}})(),He=(function(){let n=new it,e=new it,t=new On,i=new Hn;return function(a,s){let{radius:o,center:c}=a,{a:p,b:f,c:u}=s;if(i.start=p,i.end=f,i.closestPointToPoint(c,!0,n).distanceTo(c)<=o||(i.start=p,i.end=u,i.closestPointToPoint(c,!0,n).distanceTo(c)<=o)||(i.start=f,i.end=u,i.closestPointToPoint(c,!0,n).distanceTo(c)<=o))return!0;let b=s.getPlane(t);if(Math.abs(b.distanceToPoint(c))<=o){let x=b.projectPoint(c,e);if(s.containsPoint(x))return!0}return!1}})();var Yn=1e-15;function fe(n){return Math.abs(n)<Yn}var k=class extends qn{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new X),this.satBounds=new Array(4).fill().map(()=>new G),this.points=[this.a,this.b,this.c],this.sphere=new Gn,this.plane=new Xn,this.needsUpdate=!0}intersectsSphere(e){return He(e,this)}update(){let e=this.a,t=this.b,i=this.c,r=this.points,a=this.satAxes,s=this.satBounds,o=a[0],c=s[0];this.getNormal(o),c.setFromPoints(o,r);let p=a[1],f=s[1];p.subVectors(e,t),f.setFromPoints(p,r);let u=a[2],l=s[2];u.subVectors(t,i),l.setFromPoints(u,r);let m=a[3],w=s[3];m.subVectors(i,e),w.setFromPoints(m,r),this.sphere.setFromPoints(this.points),this.plane.setFromNormalAndCoplanarPoint(o,e),this.needsUpdate=!1}};k.prototype.closestPointToSegment=(function(){let n=new X,e=new X,t=new ot;return function(r,a=null,s=null){let{start:o,end:c}=r,p=this.points,f,u=1/0;for(let l=0;l<3;l++){let m=(l+1)%3;t.start.copy(p[l]),t.end.copy(p[m]),_t(t,r,n,e),f=n.distanceToSquared(e),f<u&&(u=f,a&&a.copy(n),s&&s.copy(e))}return this.closestPointToPoint(o,n),f=o.distanceToSquared(n),f<u&&(u=f,a&&a.copy(n),s&&s.copy(o)),this.closestPointToPoint(c,n),f=c.distanceToSquared(n),f<u&&(u=f,a&&a.copy(n),s&&s.copy(c)),Math.sqrt(u)}})();k.prototype.intersectsTriangle=(function(){let n=new k,e=new Array(3),t=new Array(3),i=new G,r=new G,a=new X,s=new X,o=new X,c=new X,p=new X,f=new ot,u=new ot,l=new ot,m=new X;function w(b,y,x){let d=b.points,h=0,A=-1;for(let T=0;T<3;T++){let{start:B,end:g}=f;B.copy(d[T]),g.copy(d[(T+1)%3]),f.delta(s);let _=fe(y.distanceToPoint(B));if(fe(y.normal.dot(s))&&_){x.copy(f),h=2;break}let v=y.intersectLine(f,m);if(!v&&_&&m.copy(B),(v||_)&&!fe(m.distanceTo(g))){if(h<=1)(h===1?x.start:x.end).copy(m),_&&(A=h);else if(h>=2){(A===1?x.start:x.end).copy(m),h=2;break}if(h++,h===2&&A===-1)break}}return h}return function(y,x=null,d=!1){this.needsUpdate&&this.update(),y.isExtendedTriangle?y.needsUpdate&&y.update():(n.copy(y),n.update(),y=n);let h=this.plane,A=y.plane;if(Math.abs(h.normal.dot(A.normal))>1-1e-10){let T=this.satBounds,B=this.satAxes;t[0]=y.a,t[1]=y.b,t[2]=y.c;for(let v=0;v<4;v++){let S=T[v],E=B[v];if(i.setFromPoints(E,t),S.isSeparated(i))return!1}let g=y.satBounds,_=y.satAxes;e[0]=this.a,e[1]=this.b,e[2]=this.c;for(let v=0;v<4;v++){let S=g[v],E=_[v];if(i.setFromPoints(E,e),S.isSeparated(i))return!1}for(let v=0;v<4;v++){let S=B[v];for(let E=0;E<4;E++){let P=_[E];if(a.crossVectors(S,P),i.setFromPoints(a,e),r.setFromPoints(a,t),i.isSeparated(r))return!1}}return x&&(d||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),x.start.set(0,0,0),x.end.set(0,0,0)),!0}else{let T=w(this,A,u);if(T===1&&y.containsPoint(u.end))return x&&(x.start.copy(u.end),x.end.copy(u.end)),!0;if(T!==2)return!1;let B=w(y,h,l);if(B===1&&this.containsPoint(l.end))return x&&(x.start.copy(l.end),x.end.copy(l.end)),!0;if(B!==2)return!1;if(u.delta(o),l.delta(c),o.dot(c)<0){let D=l.start;l.start=l.end,l.end=D}let g=u.start.dot(o),_=u.end.dot(o),v=l.start.dot(o),S=l.end.dot(o),E=_<v,P=g<S;return g!==S&&v!==_&&E===P?!1:(x&&(p.subVectors(u.start,l.start),p.dot(o)>0?x.start.copy(u.start):x.start.copy(l.start),p.subVectors(u.end,l.end),p.dot(o)<0?x.end.copy(u.end):x.end.copy(l.end)),!0)}}})();k.prototype.distanceToPoint=(function(){let n=new X;return function(t){return this.closestPointToPoint(t,n),t.distanceTo(n)}})();k.prototype.distanceToTriangle=(function(){let n=new X,e=new X,t=["a","b","c"],i=new ot,r=new ot;return function(s,o=null,c=null){let p=o||c?i:null;if(this.intersectsTriangle(s,p))return(o||c)&&(o&&p.getCenter(o),c&&p.getCenter(c)),0;let f=1/0;for(let u=0;u<3;u++){let l,m=t[u],w=s[m];this.closestPointToPoint(w,n),l=w.distanceToSquared(n),l<f&&(f=l,o&&o.copy(n),c&&c.copy(w));let b=this[m];s.closestPointToPoint(b,n),l=b.distanceToSquared(n),l<f&&(f=l,o&&o.copy(b),c&&c.copy(n))}for(let u=0;u<3;u++){let l=t[u],m=t[(u+1)%3];i.set(this[l],this[m]);for(let w=0;w<3;w++){let b=t[w],y=t[(w+1)%3];r.set(s[b],s[y]),_t(i,r,n,e);let x=n.distanceToSquared(e);x<f&&(f=x,o&&o.copy(n),c&&c.copy(e))}}return Math.sqrt(f)}})();var R=class{constructor(e,t,i){this.isOrientedBox=!0,this.min=new Q,this.max=new Q,this.matrix=new ke,this.invMatrix=new ke,this.points=new Array(8).fill().map(()=>new Q),this.satAxes=new Array(3).fill().map(()=>new Q),this.satBounds=new Array(3).fill().map(()=>new G),this.alignedSatBounds=new Array(3).fill().map(()=>new G),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),i&&this.matrix.copy(i)}set(e,t,i){this.min.copy(e),this.max.copy(t),this.matrix.copy(i),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};R.prototype.update=(function(){return function(){let e=this.matrix,t=this.min,i=this.max,r=this.points;for(let p=0;p<=1;p++)for(let f=0;f<=1;f++)for(let u=0;u<=1;u++){let l=1*p|2*f|4*u,m=r[l];m.x=p?i.x:t.x,m.y=f?i.y:t.y,m.z=u?i.z:t.z,m.applyMatrix4(e)}let a=this.satBounds,s=this.satAxes,o=r[0];for(let p=0;p<3;p++){let f=s[p],u=a[p],l=1<<p,m=r[l];f.subVectors(o,m),u.setFromPoints(f,r)}let c=this.alignedSatBounds;c[0].setFromPointsField(r,"x"),c[1].setFromPointsField(r,"y"),c[2].setFromPointsField(r,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})();R.prototype.intersectsBox=(function(){let n=new G;return function(t){this.needsUpdate&&this.update();let i=t.min,r=t.max,a=this.satBounds,s=this.satAxes,o=this.alignedSatBounds;if(n.min=i.x,n.max=r.x,o[0].isSeparated(n)||(n.min=i.y,n.max=r.y,o[1].isSeparated(n))||(n.min=i.z,n.max=r.z,o[2].isSeparated(n)))return!1;for(let c=0;c<3;c++){let p=s[c],f=a[c];if(n.setFromBox(p,t),f.isSeparated(n))return!1}return!0}})();R.prototype.intersectsTriangle=(function(){let n=new k,e=new Array(3),t=new G,i=new G,r=new Q;return function(s){this.needsUpdate&&this.update(),s.isExtendedTriangle?s.needsUpdate&&s.update():(n.copy(s),n.update(),s=n);let o=this.satBounds,c=this.satAxes;e[0]=s.a,e[1]=s.b,e[2]=s.c;for(let l=0;l<3;l++){let m=o[l],w=c[l];if(t.setFromPoints(w,e),m.isSeparated(t))return!1}let p=s.satBounds,f=s.satAxes,u=this.points;for(let l=0;l<3;l++){let m=p[l],w=f[l];if(t.setFromPoints(w,u),m.isSeparated(t))return!1}for(let l=0;l<3;l++){let m=c[l];for(let w=0;w<4;w++){let b=f[w];if(r.crossVectors(m,b),t.setFromPoints(r,e),i.setFromPoints(r,u),t.isSeparated(i))return!1}}return!0}})();R.prototype.closestPointToPoint=(function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}})();R.prototype.distanceToPoint=(function(){let n=new Q;return function(t){return this.closestPointToPoint(t,n),t.distanceTo(n)}})();R.prototype.distanceToBox=(function(){let n=["x","y","z"],e=new Array(12).fill().map(()=>new qe),t=new Array(12).fill().map(()=>new qe),i=new Q,r=new Q;return function(s,o=0,c=null,p=null){if(this.needsUpdate&&this.update(),this.intersectsBox(s))return(c||p)&&(s.getCenter(r),this.closestPointToPoint(r,i),s.closestPointToPoint(i,r),c&&c.copy(i),p&&p.copy(r)),0;let f=o*o,u=s.min,l=s.max,m=this.points,w=1/0;for(let y=0;y<8;y++){let x=m[y];r.copy(x).clamp(u,l);let d=x.distanceToSquared(r);if(d<w&&(w=d,c&&c.copy(x),p&&p.copy(r),d<f))return Math.sqrt(d)}let b=0;for(let y=0;y<3;y++)for(let x=0;x<=1;x++)for(let d=0;d<=1;d++){let h=(y+1)%3,A=(y+2)%3,T=x<<h|d<<A,B=1<<y|x<<h|d<<A,g=m[T],_=m[B];e[b].set(g,_);let S=n[y],E=n[h],P=n[A],D=t[b],I=D.start,F=D.end;I[S]=u[S],I[E]=x?u[E]:l[E],I[P]=d?u[P]:l[E],F[S]=l[S],F[E]=x?u[E]:l[E],F[P]=d?u[P]:l[E],b++}for(let y=0;y<=1;y++)for(let x=0;x<=1;x++)for(let d=0;d<=1;d++){r.x=y?l.x:u.x,r.y=x?l.y:u.y,r.z=d?l.z:u.z,this.closestPointToPoint(r,i);let h=r.distanceToSquared(i);if(h<w&&(w=h,c&&c.copy(i),p&&p.copy(r),h<f))return Math.sqrt(h)}for(let y=0;y<12;y++){let x=e[y];for(let d=0;d<12;d++){let h=t[d];_t(x,h,i,r);let A=i.distanceToSquared(r);if(A<w&&(w=A,c&&c.copy(i),p&&p.copy(r),A<f))return Math.sqrt(A)}}return Math.sqrt(w)}})();var tt=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}};var ue=class extends tt{constructor(){super(()=>new k)}},q=new ue;import{Box3 as Wn}from"three";var pe=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=i=>{t&&e.push(t),t=i,this.float32Array=new Float32Array(i),this.uint16Array=new Uint16Array(i),this.uint32Array=new Uint32Array(i)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},M=new pe;var et,at,ct=[],Ht=new tt(()=>new Wn);function Ge(n,e,t,i,r,a){et=Ht.getPrimitive(),at=Ht.getPrimitive(),ct.push(et,at),M.setBuffer(n._roots[e]);let s=me(0,n.geometry,t,i,r,a);M.clearBuffer(),Ht.releasePrimitive(et),Ht.releasePrimitive(at),ct.pop(),ct.pop();let o=ct.length;return o>0&&(at=ct[o-1],et=ct[o-2]),s}function me(n,e,t,i,r=null,a=0,s=0){let{float32Array:o,uint16Array:c,uint32Array:p}=M,f=n*2;if(C(f,c)){let l=V(n,p),m=z(f,c);return N(n,o,et),i(l,m,!1,s,a+n,et)}else{let S=function(P){let{uint16Array:D,uint32Array:I}=M,F=P*2;for(;!C(F,D);)P=O(P),F=P*2;return V(P,I)},E=function(P){let{uint16Array:D,uint32Array:I}=M,F=P*2;for(;!C(F,D);)P=H(P,I),F=P*2;return V(P,I)+z(F,D)},l=O(n),m=H(n,p),w=l,b=m,y,x,d,h;if(r&&(d=et,h=at,N(w,o,d),N(b,o,h),y=r(d),x=r(h),x<y)){w=m,b=l;let P=y;y=x,x=P,d=h}d||(d=et,N(w,o,d));let A=C(w*2,c),T=t(d,A,y,s+1,a+w),B;if(T===2){let P=S(w),I=E(w)-P;B=i(P,I,!0,s+1,a+w,d)}else B=T&&me(w,e,t,i,r,a,s+1);if(B)return!0;h=at,N(b,o,h);let g=C(b*2,c),_=t(h,g,x,s+1,a+b),v;if(_===2){let P=S(b),I=E(b)-P;v=i(P,I,!0,s+1,a+b,h)}else v=_&&me(b,e,t,i,r,a,s+1);return!!v}}import{Vector3 as Xe}from"three";var Pt=new Xe,xe=new Xe;function Ye(n,e,t={},i=0,r=1/0){let a=i*i,s=r*r,o=1/0,c=null;if(n.shapecast({boundsTraverseOrder:f=>(Pt.copy(e).clamp(f.min,f.max),Pt.distanceToSquared(e)),intersectsBounds:(f,u,l)=>l<o&&l<s,intersectsTriangle:(f,u)=>{f.closestPointToPoint(e,Pt);let l=e.distanceToSquared(Pt);return l<o&&(xe.copy(Pt),o=l,c=u),l<a}}),o===1/0)return null;let p=Math.sqrt(o);return t.point?t.point.copy(xe):t.point=xe.clone(),t.distance=p,t.faceIndex=c,t}import{Vector3 as K,Vector2 as St,Triangle as kt,DoubleSide as Zn,BackSide as Kn}from"three";var lt=new K,ft=new K,ut=new K,qt=new St,Gt=new St,Xt=new St,je=new K,We=new K,Ze=new K,Yt=new K;function $n(n,e,t,i,r,a,s,o){let c;if(a===Kn?c=n.intersectTriangle(i,t,e,!0,r):c=n.intersectTriangle(e,t,i,a!==Zn,r),c===null)return null;let p=n.origin.distanceTo(r);return p<s||p>o?null:{distance:p,point:r.clone()}}function Jn(n,e,t,i,r,a,s,o,c,p,f){lt.fromBufferAttribute(e,a),ft.fromBufferAttribute(e,s),ut.fromBufferAttribute(e,o);let u=$n(n,lt,ft,ut,Yt,c,p,f);if(u){i&&(qt.fromBufferAttribute(i,a),Gt.fromBufferAttribute(i,s),Xt.fromBufferAttribute(i,o),u.uv=kt.getInterpolation(Yt,lt,ft,ut,qt,Gt,Xt,new St)),r&&(qt.fromBufferAttribute(r,a),Gt.fromBufferAttribute(r,s),Xt.fromBufferAttribute(r,o),u.uv1=kt.getInterpolation(Yt,lt,ft,ut,qt,Gt,Xt,new St)),t&&(je.fromBufferAttribute(t,a),We.fromBufferAttribute(t,s),Ze.fromBufferAttribute(t,o),u.normal=kt.getInterpolation(Yt,lt,ft,ut,je,We,Ze,new K),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));let l={a,b:s,c:o,normal:new K,materialIndex:0};kt.getNormal(lt,ft,ut,l.normal),u.face=l,u.faceIndex=a}return u}function pt(n,e,t,i,r,a,s){let o=i*3,c=o+0,p=o+1,f=o+2,u=n.index;n.index&&(c=u.getX(c),p=u.getX(p),f=u.getX(f));let{position:l,normal:m,uv:w,uv1:b}=n.attributes,y=Jn(t,l,m,w,b,c,p,f,e,a,s);return y?(y.faceIndex=i,r&&r.push(y),y):null}import{Vector2 as _s,Vector3 as Ps,Triangle as Ss}from"three";function L(n,e,t,i){let r=n.a,a=n.b,s=n.c,o=e,c=e+1,p=e+2;t&&(o=t.getX(o),c=t.getX(c),p=t.getX(p)),r.x=i.getX(o),r.y=i.getY(o),r.z=i.getZ(o),a.x=i.getX(c),a.y=i.getY(c),a.z=i.getZ(c),s.x=i.getX(p),s.y=i.getY(p),s.z=i.getZ(p)}function Ke(n,e,t,i,r,a,s,o){let{geometry:c,_indirectBuffer:p}=n;for(let f=i,u=i+r;f<u;f++)pt(c,e,t,f,a,s,o)}function $e(n,e,t,i,r,a,s){let{geometry:o,_indirectBuffer:c}=n,p=1/0,f=null;for(let u=i,l=i+r;u<l;u++){let m;m=pt(o,e,t,u,null,a,s),m&&m.distance<p&&(f=m,p=m.distance)}return f}function Je(n,e,t,i,r,a,s){let{geometry:o}=t,{index:c}=o,p=o.attributes.position;for(let f=n,u=e+n;f<u;f++){let l;if(l=f,L(s,l*3,c,p),s.needsUpdate=!0,i(s,l,r,a))return!0}return!1}function Qe(n,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=n.geometry,i=t.index?t.index.array:null,r=t.attributes.position,a,s,o,c,p=0,f=n._roots;for(let l=0,m=f.length;l<m;l++)a=f[l],s=new Uint32Array(a),o=new Uint16Array(a),c=new Float32Array(a),u(0,p),p+=a.byteLength;function u(l,m,w=!1){let b=l*2;if(o[b+15]===65535){let x=s[l+6],d=o[b+14],h=1/0,A=1/0,T=1/0,B=-1/0,g=-1/0,_=-1/0;for(let v=3*x,S=3*(x+d);v<S;v++){let E=i[v],P=r.getX(E),D=r.getY(E),I=r.getZ(E);P<h&&(h=P),P>B&&(B=P),D<A&&(A=D),D>g&&(g=D),I<T&&(T=I),I>_&&(_=I)}return c[l+0]!==h||c[l+1]!==A||c[l+2]!==T||c[l+3]!==B||c[l+4]!==g||c[l+5]!==_?(c[l+0]=h,c[l+1]=A,c[l+2]=T,c[l+3]=B,c[l+4]=g,c[l+5]=_,!0):!1}else{let x=l+8,d=s[l+6],h=x+m,A=d+m,T=w,B=!1,g=!1;e?T||(B=e.has(h),g=e.has(A),T=!B&&!g):(B=!0,g=!0);let _=T||B,v=T||g,S=!1;_&&(S=u(x,m,T));let E=!1;v&&(E=u(d,m,T));let P=S||E;if(P)for(let D=0;D<3;D++){let I=x+D,F=d+D,U=c[I],$=c[I+3],wt=c[F],bt=c[F+3];c[l+D]=U<wt?U:wt,c[l+D+3]=$>bt?$:bt}return P}}}function Y(n,e,t,i,r){let a,s,o,c,p,f,u=1/t.direction.x,l=1/t.direction.y,m=1/t.direction.z,w=t.origin.x,b=t.origin.y,y=t.origin.z,x=e[n],d=e[n+3],h=e[n+1],A=e[n+3+1],T=e[n+2],B=e[n+3+2];return u>=0?(a=(x-w)*u,s=(d-w)*u):(a=(d-w)*u,s=(x-w)*u),l>=0?(o=(h-b)*l,c=(A-b)*l):(o=(A-b)*l,c=(h-b)*l),a>c||o>s||((o>a||isNaN(a))&&(a=o),(c<s||isNaN(s))&&(s=c),m>=0?(p=(T-y)*m,f=(B-y)*m):(p=(B-y)*m,f=(T-y)*m),a>f||p>s)?!1:((p>a||a!==a)&&(a=p),(f<s||s!==s)&&(s=f),a<=r&&s>=i)}function tn(n,e,t,i,r,a,s,o){let{geometry:c,_indirectBuffer:p}=n;for(let f=i,u=i+r;f<u;f++){let l=p?p[f]:f;pt(c,e,t,l,a,s,o)}}function en(n,e,t,i,r,a,s){let{geometry:o,_indirectBuffer:c}=n,p=1/0,f=null;for(let u=i,l=i+r;u<l;u++){let m;m=pt(o,e,t,c?c[u]:u,null,a,s),m&&m.distance<p&&(f=m,p=m.distance)}return f}function nn(n,e,t,i,r,a,s){let{geometry:o}=t,{index:c}=o,p=o.attributes.position;for(let f=n,u=e+n;f<u;f++){let l;if(l=t.resolveTriangleIndex(f),L(s,l*3,c,p),s.needsUpdate=!0,i(s,l,r,a))return!0}return!1}function sn(n,e,t,i,r,a,s){M.setBuffer(n._roots[e]),ye(0,n,t,i,r,a,s),M.clearBuffer()}function ye(n,e,t,i,r,a,s){let{float32Array:o,uint16Array:c,uint32Array:p}=M,f=n*2;if(C(f,c)){let l=V(n,p),m=z(f,c);Ke(e,t,i,l,m,r,a,s)}else{let l=O(n);Y(l,o,i,a,s)&&ye(l,e,t,i,r,a,s);let m=H(n,p);Y(m,o,i,a,s)&&ye(m,e,t,i,r,a,s)}}var Qn=["x","y","z"];function rn(n,e,t,i,r,a){M.setBuffer(n._roots[e]);let s=he(0,n,t,i,r,a);return M.clearBuffer(),s}function he(n,e,t,i,r,a){let{float32Array:s,uint16Array:o,uint32Array:c}=M,p=n*2;if(C(p,o)){let u=V(n,c),l=z(p,o);return $e(e,t,i,u,l,r,a)}else{let u=Ut(n,c),l=Qn[u],w=i.direction[l]>=0,b,y;w?(b=O(n),y=H(n,c)):(b=H(n,c),y=O(n));let d=Y(b,s,i,r,a)?he(b,e,t,i,r,a):null;if(d){let T=d.point[l];if(w?T<=s[y+u]:T>=s[y+u+3])return d}let A=Y(y,s,i,r,a)?he(y,e,t,i,r,a):null;return d&&A?d.distance<=A.distance?d:A:d||A||null}}import{Box3 as ti,Matrix4 as ei}from"three";var jt=new ti,mt=new k,dt=new k,Et=new ei,on=new R,Wt=new R;function cn(n,e,t,i){M.setBuffer(n._roots[e]);let r=Te(0,n,t,i);return M.clearBuffer(),r}function Te(n,e,t,i,r=null){let{float32Array:a,uint16Array:s,uint32Array:o}=M,c=n*2;if(r===null&&(t.boundingBox||t.computeBoundingBox(),on.set(t.boundingBox.min,t.boundingBox.max,i),r=on),C(c,s)){let f=e.geometry,u=f.index,l=f.attributes.position,m=t.index,w=t.attributes.position,b=V(n,o),y=z(c,s);if(Et.copy(i).invert(),t.boundsTree)return N(n,a,Wt),Wt.matrix.copy(Et),Wt.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:d=>Wt.intersectsBox(d),intersectsTriangle:d=>{d.a.applyMatrix4(i),d.b.applyMatrix4(i),d.c.applyMatrix4(i),d.needsUpdate=!0;for(let h=b*3,A=(y+b)*3;h<A;h+=3)if(L(dt,h,u,l),dt.needsUpdate=!0,d.intersectsTriangle(dt))return!0;return!1}});for(let x=b*3,d=(y+b)*3;x<d;x+=3){L(mt,x,u,l),mt.a.applyMatrix4(Et),mt.b.applyMatrix4(Et),mt.c.applyMatrix4(Et),mt.needsUpdate=!0;for(let h=0,A=m.count;h<A;h+=3)if(L(dt,h,m,w),dt.needsUpdate=!0,mt.intersectsTriangle(dt))return!0}}else{let f=n+8,u=o[n+6];return N(f,a,jt),!!(r.intersectsBox(jt)&&Te(f,e,t,i,r)||(N(u,a,jt),r.intersectsBox(jt)&&Te(u,e,t,i,r)))}}import{Matrix4 as ni,Vector3 as Kt}from"three";var Zt=new ni,Ae=new R,Dt=new R,ii=new Kt,si=new Kt,ri=new Kt,oi=new Kt;function an(n,e,t,i={},r={},a=0,s=1/0){e.boundingBox||e.computeBoundingBox(),Ae.set(e.boundingBox.min,e.boundingBox.max,t),Ae.needsUpdate=!0;let o=n.geometry,c=o.attributes.position,p=o.index,f=e.attributes.position,u=e.index,l=q.getPrimitive(),m=q.getPrimitive(),w=ii,b=si,y=null,x=null;r&&(y=ri,x=oi);let d=1/0,h=null,A=null;return Zt.copy(t).invert(),Dt.matrix.copy(Zt),n.shapecast({boundsTraverseOrder:T=>Ae.distanceToBox(T),intersectsBounds:(T,B,g)=>g<d&&g<s?(B&&(Dt.min.copy(T.min),Dt.max.copy(T.max),Dt.needsUpdate=!0),!0):!1,intersectsRange:(T,B)=>{if(e.boundsTree)return e.boundsTree.shapecast({boundsTraverseOrder:_=>Dt.distanceToBox(_),intersectsBounds:(_,v,S)=>S<d&&S<s,intersectsRange:(_,v)=>{for(let S=_,E=_+v;S<E;S++){L(m,3*S,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let P=T,D=T+B;P<D;P++){L(l,3*P,p,c),l.needsUpdate=!0;let I=l.distanceToTriangle(m,w,y);if(I<d&&(b.copy(w),x&&x.copy(y),d=I,h=P,A=S),I<a)return!0}}}});{let g=W(e);for(let _=0,v=g;_<v;_++){L(m,3*_,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let S=T,E=T+B;S<E;S++){L(l,3*S,p,c),l.needsUpdate=!0;let P=l.distanceToTriangle(m,w,y);if(P<d&&(b.copy(w),x&&x.copy(y),d=P,h=S,A=_),P<a)return!0}}}}}),q.releasePrimitive(l),q.releasePrimitive(m),d===1/0?null:(i.point?i.point.copy(b):i.point=b.clone(),i.distance=d,i.faceIndex=h,r&&(r.point?r.point.copy(x):r.point=x.clone(),r.point.applyMatrix4(Zt),b.applyMatrix4(Zt),r.distance=b.sub(r.point).length(),r.faceIndex=A),i)}function ln(n,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=n.geometry,i=t.index?t.index.array:null,r=t.attributes.position,a,s,o,c,p=0,f=n._roots;for(let l=0,m=f.length;l<m;l++)a=f[l],s=new Uint32Array(a),o=new Uint16Array(a),c=new Float32Array(a),u(0,p),p+=a.byteLength;function u(l,m,w=!1){let b=l*2;if(o[b+15]===65535){let x=s[l+6],d=o[b+14],h=1/0,A=1/0,T=1/0,B=-1/0,g=-1/0,_=-1/0;for(let v=x,S=x+d;v<S;v++){let E=3*n.resolveTriangleIndex(v);for(let P=0;P<3;P++){let D=E+P;D=i?i[D]:D;let I=r.getX(D),F=r.getY(D),U=r.getZ(D);I<h&&(h=I),I>B&&(B=I),F<A&&(A=F),F>g&&(g=F),U<T&&(T=U),U>_&&(_=U)}}return c[l+0]!==h||c[l+1]!==A||c[l+2]!==T||c[l+3]!==B||c[l+4]!==g||c[l+5]!==_?(c[l+0]=h,c[l+1]=A,c[l+2]=T,c[l+3]=B,c[l+4]=g,c[l+5]=_,!0):!1}else{let x=l+8,d=s[l+6],h=x+m,A=d+m,T=w,B=!1,g=!1;e?T||(B=e.has(h),g=e.has(A),T=!B&&!g):(B=!0,g=!0);let _=T||B,v=T||g,S=!1;_&&(S=u(x,m,T));let E=!1;v&&(E=u(d,m,T));let P=S||E;if(P)for(let D=0;D<3;D++){let I=x+D,F=d+D,U=c[I],$=c[I+3],wt=c[F],bt=c[F+3];c[l+D]=U<wt?U:wt,c[l+D+3]=$>bt?$:bt}return P}}}function fn(n,e,t,i,r,a,s){M.setBuffer(n._roots[e]),we(0,n,t,i,r,a,s),M.clearBuffer()}function we(n,e,t,i,r,a,s){let{float32Array:o,uint16Array:c,uint32Array:p}=M,f=n*2;if(C(f,c)){let l=V(n,p),m=z(f,c);tn(e,t,i,l,m,r,a,s)}else{let l=O(n);Y(l,o,i,a,s)&&we(l,e,t,i,r,a,s);let m=H(n,p);Y(m,o,i,a,s)&&we(m,e,t,i,r,a,s)}}var ci=["x","y","z"];function un(n,e,t,i,r,a){M.setBuffer(n._roots[e]);let s=be(0,n,t,i,r,a);return M.clearBuffer(),s}function be(n,e,t,i,r,a){let{float32Array:s,uint16Array:o,uint32Array:c}=M,p=n*2;if(C(p,o)){let u=V(n,c),l=z(p,o);return en(e,t,i,u,l,r,a)}else{let u=Ut(n,c),l=ci[u],w=i.direction[l]>=0,b,y;w?(b=O(n),y=H(n,c)):(b=H(n,c),y=O(n));let d=Y(b,s,i,r,a)?be(b,e,t,i,r,a):null;if(d){let T=d.point[l];if(w?T<=s[y+u]:T>=s[y+u+3])return d}let A=Y(y,s,i,r,a)?be(y,e,t,i,r,a):null;return d&&A?d.distance<=A.distance?d:A:d||A||null}}import{Box3 as ai,Matrix4 as li}from"three";var $t=new ai,xt=new k,yt=new k,It=new li,pn=new R,Jt=new R;function mn(n,e,t,i){M.setBuffer(n._roots[e]);let r=ge(0,n,t,i);return M.clearBuffer(),r}function ge(n,e,t,i,r=null){let{float32Array:a,uint16Array:s,uint32Array:o}=M,c=n*2;if(r===null&&(t.boundingBox||t.computeBoundingBox(),pn.set(t.boundingBox.min,t.boundingBox.max,i),r=pn),C(c,s)){let f=e.geometry,u=f.index,l=f.attributes.position,m=t.index,w=t.attributes.position,b=V(n,o),y=z(c,s);if(It.copy(i).invert(),t.boundsTree)return N(n,a,Jt),Jt.matrix.copy(It),Jt.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:d=>Jt.intersectsBox(d),intersectsTriangle:d=>{d.a.applyMatrix4(i),d.b.applyMatrix4(i),d.c.applyMatrix4(i),d.needsUpdate=!0;for(let h=b,A=y+b;h<A;h++)if(L(yt,3*e.resolveTriangleIndex(h),u,l),yt.needsUpdate=!0,d.intersectsTriangle(yt))return!0;return!1}});for(let x=b,d=y+b;x<d;x++){let h=e.resolveTriangleIndex(x);L(xt,3*h,u,l),xt.a.applyMatrix4(It),xt.b.applyMatrix4(It),xt.c.applyMatrix4(It),xt.needsUpdate=!0;for(let A=0,T=m.count;A<T;A+=3)if(L(yt,A,m,w),yt.needsUpdate=!0,xt.intersectsTriangle(yt))return!0}}else{let f=n+8,u=o[n+6];return N(f,a,$t),!!(r.intersectsBox($t)&&ge(f,e,t,i,r)||(N(u,a,$t),r.intersectsBox($t)&&ge(u,e,t,i,r)))}}import{Matrix4 as fi,Vector3 as te}from"three";var Qt=new fi,Be=new R,Mt=new R,ui=new te,pi=new te,mi=new te,di=new te;function dn(n,e,t,i={},r={},a=0,s=1/0){e.boundingBox||e.computeBoundingBox(),Be.set(e.boundingBox.min,e.boundingBox.max,t),Be.needsUpdate=!0;let o=n.geometry,c=o.attributes.position,p=o.index,f=e.attributes.position,u=e.index,l=q.getPrimitive(),m=q.getPrimitive(),w=ui,b=pi,y=null,x=null;r&&(y=mi,x=di);let d=1/0,h=null,A=null;return Qt.copy(t).invert(),Mt.matrix.copy(Qt),n.shapecast({boundsTraverseOrder:T=>Be.distanceToBox(T),intersectsBounds:(T,B,g)=>g<d&&g<s?(B&&(Mt.min.copy(T.min),Mt.max.copy(T.max),Mt.needsUpdate=!0),!0):!1,intersectsRange:(T,B)=>{if(e.boundsTree){let g=e.boundsTree;return g.shapecast({boundsTraverseOrder:_=>Mt.distanceToBox(_),intersectsBounds:(_,v,S)=>S<d&&S<s,intersectsRange:(_,v)=>{for(let S=_,E=_+v;S<E;S++){let P=g.resolveTriangleIndex(S);L(m,3*P,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let D=T,I=T+B;D<I;D++){let F=n.resolveTriangleIndex(D);L(l,3*F,p,c),l.needsUpdate=!0;let U=l.distanceToTriangle(m,w,y);if(U<d&&(b.copy(w),x&&x.copy(y),d=U,h=D,A=S),U<a)return!0}}}})}else{let g=W(e);for(let _=0,v=g;_<v;_++){L(m,3*_,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let S=T,E=T+B;S<E;S++){let P=n.resolveTriangleIndex(S);L(l,3*P,p,c),l.needsUpdate=!0;let D=l.distanceToTriangle(m,w,y);if(D<d&&(b.copy(w),x&&x.copy(y),d=D,h=S,A=_),D<a)return!0}}}}}),q.releasePrimitive(l),q.releasePrimitive(m),d===1/0?null:(i.point?i.point.copy(b):i.point=b.clone(),i.distance=d,i.faceIndex=h,r&&(r.point?r.point.copy(x):r.point=x.clone(),r.point.applyMatrix4(Qt),b.applyMatrix4(Qt),r.distance=b.sub(r.point).length(),r.faceIndex=A),i)}function xn(){return typeof SharedArrayBuffer<"u"}import{Box3 as Nt,Matrix4 as xi}from"three";var Ft=new M.constructor,ee=new M.constructor,nt=new tt(()=>new Nt),ht=new Nt,Tt=new Nt,ve=new Nt,_e=new Nt,Pe=!1;function yn(n,e,t,i){if(Pe)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");Pe=!0;let r=n._roots,a=e._roots,s,o=0,c=0,p=new xi().copy(t).invert();for(let f=0,u=r.length;f<u;f++){Ft.setBuffer(r[f]),c=0;let l=nt.getPrimitive();N(0,Ft.float32Array,l),l.applyMatrix4(p);for(let m=0,w=a.length;m<w&&(ee.setBuffer(a[f]),s=j(0,0,t,p,i,o,c,0,0,l),ee.clearBuffer(),c+=a[m].length,!s);m++);if(nt.releasePrimitive(l),Ft.clearBuffer(),o+=r[f].length,s)break}return Pe=!1,s}function j(n,e,t,i,r,a=0,s=0,o=0,c=0,p=null,f=!1){let u,l;f?(u=ee,l=Ft):(u=Ft,l=ee);let m=u.float32Array,w=u.uint32Array,b=u.uint16Array,y=l.float32Array,x=l.uint32Array,d=l.uint16Array,h=n*2,A=e*2,T=C(h,b),B=C(A,d),g=!1;if(B&&T)f?g=r(V(e,x),z(e*2,d),V(n,w),z(n*2,b),c,s+e,o,a+n):g=r(V(n,w),z(n*2,b),V(e,x),z(e*2,d),o,a+n,c,s+e);else if(B){let _=nt.getPrimitive();N(e,y,_),_.applyMatrix4(t);let v=O(n),S=H(n,w);N(v,m,ht),N(S,m,Tt);let E=_.intersectsBox(ht),P=_.intersectsBox(Tt);g=E&&j(e,v,i,t,r,s,a,c,o+1,_,!f)||P&&j(e,S,i,t,r,s,a,c,o+1,_,!f),nt.releasePrimitive(_)}else{let _=O(e),v=H(e,x);N(_,y,ve),N(v,y,_e);let S=p.intersectsBox(ve),E=p.intersectsBox(_e);if(S&&E)g=j(n,_,t,i,r,a,s,o,c+1,p,f)||j(n,v,t,i,r,a,s,o,c+1,p,f);else if(S)if(T)g=j(n,_,t,i,r,a,s,o,c+1,p,f);else{let P=nt.getPrimitive();P.copy(ve).applyMatrix4(t);let D=O(n),I=H(n,w);N(D,m,ht),N(I,m,Tt);let F=P.intersectsBox(ht),U=P.intersectsBox(Tt);g=F&&j(_,D,i,t,r,s,a,c,o+1,P,!f)||U&&j(_,I,i,t,r,s,a,c,o+1,P,!f),nt.releasePrimitive(P)}else if(E)if(T)g=j(n,v,t,i,r,a,s,o,c+1,p,f);else{let P=nt.getPrimitive();P.copy(_e).applyMatrix4(t);let D=O(n),I=H(n,w);N(D,m,ht),N(I,m,Tt);let F=P.intersectsBox(ht),U=P.intersectsBox(Tt);g=F&&j(v,D,i,t,r,s,a,c,o+1,P,!f)||U&&j(v,I,i,t,r,s,a,c,o+1,P,!f),nt.releasePrimitive(P)}}return g}var ne=new R,Tn=new An,hi={strategy:0,maxDepth:40,maxLeafTris:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0},At=class n{static serialize(e,t={}){t={cloneBuffers:!0,...t};let i=e.geometry,r=e._roots,a=e._indirectBuffer,s=i.getIndex(),o;return t.cloneBuffers?o={roots:r.map(c=>c.slice()),index:s?s.array.slice():null,indirectBuffer:a?a.slice():null}:o={roots:r,index:s?s.array:null,indirectBuffer:a},o}static deserialize(e,t,i={}){i={setIndex:!0,indirect:!!e.indirectBuffer,...i};let{index:r,roots:a,indirectBuffer:s}=e,o=new n(t,{...i,[Lt]:!0});if(o._roots=a,o._indirectBuffer=s||null,i.setIndex){let c=t.getIndex();if(c===null){let p=new yi(e.index,1,!1);t.setIndex(p)}else c.array!==r&&(c.array.set(r),c.needsUpdate=!0)}return o}get indirect(){return!!this._indirectBuffer}constructor(e,t={}){if(e.isBufferGeometry){if(e.index&&e.index.isInterleavedBufferAttribute)throw new Error("MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("MeshBVH: Only BufferGeometries are supported.");if(t=Object.assign({...hi,[Lt]:!1},t),t.useSharedArrayBuffer&&!xn())throw new Error("MeshBVH: SharedArrayBuffer is not available.");this.geometry=e,this._roots=null,this._indirectBuffer=null,t[Lt]||(Oe(this,t),!e.boundingBox&&t.setBoundingBox&&(e.boundingBox=this.getBoundingBox(new An))),this.resolveTriangleIndex=t.indirect?i=>this._indirectBuffer[i]:i=>i}refit(e=null){return(this.indirect?ln:Qe)(this,e)}traverse(e,t=0){let i=this._roots[t],r=new Uint32Array(i),a=new Uint16Array(i);s(0);function s(o,c=0){let p=o*2,f=a[p+15]===65535;if(f){let u=r[o+6],l=a[p+14];e(c,f,new Float32Array(i,o*4,6),u,l)}else{let u=o+32/4,l=r[o+6],m=r[o+7];e(c,f,new Float32Array(i,o*4,6),m)||(s(u,c+1),s(l,c+1))}}}raycast(e,t=hn,i=0,r=1/0){let a=this._roots,s=this.geometry,o=[],c=t.isMaterial,p=Array.isArray(t),f=s.groups,u=c?t.side:t,l=this.indirect?fn:sn;for(let m=0,w=a.length;m<w;m++){let b=p?t[f[m].materialIndex].side:u,y=o.length;if(l(this,m,b,e,o,i,r),p){let x=f[m].materialIndex;for(let d=y,h=o.length;d<h;d++)o[d].face.materialIndex=x}}return o}raycastFirst(e,t=hn,i=0,r=1/0){let a=this._roots,s=this.geometry,o=t.isMaterial,c=Array.isArray(t),p=null,f=s.groups,u=o?t.side:t,l=this.indirect?un:rn;for(let m=0,w=a.length;m<w;m++){let b=c?t[f[m].materialIndex].side:u,y=l(this,m,b,e,i,r);y!=null&&(p==null||y.distance<p.distance)&&(p=y,c&&(y.face.materialIndex=f[m].materialIndex))}return p}intersectsGeometry(e,t){let i=!1,r=this._roots,a=this.indirect?mn:cn;for(let s=0,o=r.length;s<o&&(i=a(this,s,e,t),!i);s++);return i}shapecast(e){let t=q.getPrimitive(),i=this.indirect?nn:Je,{boundsTraverseOrder:r,intersectsBounds:a,intersectsRange:s,intersectsTriangle:o}=e;if(s&&o){let u=s;s=(l,m,w,b,y)=>u(l,m,w,b,y)?!0:i(l,m,this,o,w,b,t)}else s||(o?s=(u,l,m,w)=>i(u,l,this,o,m,w,t):s=(u,l,m)=>m);let c=!1,p=0,f=this._roots;for(let u=0,l=f.length;u<l;u++){let m=f[u];if(c=Ge(this,u,a,s,r,p),c)break;p+=m.byteLength}return q.releasePrimitive(t),c}bvhcast(e,t,i){let{intersectsRanges:r,intersectsTriangles:a}=i,s=q.getPrimitive(),o=this.geometry.index,c=this.geometry.attributes.position,p=this.indirect?w=>{let b=this.resolveTriangleIndex(w);L(s,b*3,o,c)}:w=>{L(s,w*3,o,c)},f=q.getPrimitive(),u=e.geometry.index,l=e.geometry.attributes.position,m=e.indirect?w=>{let b=e.resolveTriangleIndex(w);L(f,b*3,u,l)}:w=>{L(f,w*3,u,l)};if(a){let w=(b,y,x,d,h,A,T,B)=>{for(let g=x,_=x+d;g<_;g++){m(g),f.a.applyMatrix4(t),f.b.applyMatrix4(t),f.c.applyMatrix4(t),f.needsUpdate=!0;for(let v=b,S=b+y;v<S;v++)if(p(v),s.needsUpdate=!0,a(s,f,v,g,h,A,T,B))return!0}return!1};if(r){let b=r;r=function(y,x,d,h,A,T,B,g){return b(y,x,d,h,A,T,B,g)?!0:w(y,x,d,h,A,T,B,g)}}else r=w}return yn(this,e,t,r)}intersectsBox(e,t){return ne.set(e.min,e.max,t),ne.needsUpdate=!0,this.shapecast({intersectsBounds:i=>ne.intersectsBox(i),intersectsTriangle:i=>ne.intersectsTriangle(i)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,i={},r={},a=0,s=1/0){return(this.indirect?dn:an)(this,e,t,i,r,a,s)}closestPointToPoint(e,t={},i=0,r=1/0){return Ye(this,e,t,i,r)}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(i=>{N(0,new Float32Array(i),Tn),e.union(Tn)}),e}};import{Ray as Ti,Matrix4 as Ai,Mesh as wi,Vector3 as Bn}from"three";function Se(n,e,t){return n===null?null:(n.point.applyMatrix4(e.matrixWorld),n.distance=n.point.distanceTo(t.ray.origin),n.object=e,n)}var ie=new Ti,wn=new Bn,bn=new Ai,bi=wi.prototype.raycast,gn=new Bn;function vn(n,e){if(this.geometry.boundsTree){if(this.material===void 0)return;bn.copy(this.matrixWorld).invert(),ie.copy(n.ray).applyMatrix4(bn),gi(this.matrixWorld,gn),wn.copy(ie.direction).multiply(gn);let t=wn.length(),i=n.near/t,r=n.far/t,a=this.geometry.boundsTree;if(n.firstHitOnly===!0){let s=Se(a.raycastFirst(ie,this.material,i,r),this,n);s&&e.push(s)}else{let s=a.raycast(ie,this.material,i,r);for(let o=0,c=s.length;o<c;o++){let p=Se(s[o],this,n);p&&e.push(p)}}}else bi.call(this,n,e)}function _n(n){return this.boundsTree=new At(this,n),this.boundsTree}function Pn(){this.boundsTree=null}function gi(n,e){let t=n.elements,i=e.set(t[0],t[1],t[2]).length(),r=e.set(t[4],t[5],t[6]).length(),a=e.set(t[8],t[9],t[10]).length();return e.set(i,r,a)}var Sn=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var En=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`;var Ao=`
	${Sn}
	${En}
`;export{At as MeshBVH,vn as acceleratedRaycast,_n as computeBoundsTree,Pn as disposeBoundsTree};
