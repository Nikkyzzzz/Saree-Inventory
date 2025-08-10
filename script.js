const SHEETS_API_KEY="AIzaSyBL7wHMKSbr3UhqBYZQR4tqDz0icFhDqa8";
const SHEET_ID="1fyiKpaSyc-6qK2DHwJsmfVtmgOMn8_ly5LYSdIN6WQM";
const SHEET_RANGE = "'Form responses 1'!A1:H";


const PLACEHOLDER='data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23151528"/><stop offset="100%" stop-color="%230b0b12"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><g fill="%23fff" opacity=".08"><rect x="80" y="90" rx="18" width="1040" height="620"/></g><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Inter,Arial" font-size="46" fill="%23ffffff80">Saree Image</text></svg>';

function toDirectDrive(url){
  if(!url) return "";
  const m=url.match(/(?:\bid=|\/d\/)([a-zA-Z0-9_-]{10,})/);
  return m?`https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`:url;
}
function norm(s){return String(s||"").trim().toLowerCase().replace(/[\s._-]+/g,"")}
function currency(n){return Number(n||0).toLocaleString("en-IN")}

const state={data:[],filtered:[],query:"",min:"",max:"",fabric:"",color:"",sort:"relevance",cart:{}};

const els={
  grid:document.getElementById("grid"),
  q:document.getElementById("q"),
  min:document.getElementById("minPrice"),
  max:document.getElementById("maxPrice"),
  fabric:document.getElementById("fabric"),
  color:document.getElementById("color"),
  sort:document.getElementById("sort"),
  clear:document.getElementById("btn-clear"),
  exportBtn:document.getElementById("btn-export"),
  cartBtn:document.getElementById("btn-cart"),
  cartCount:document.getElementById("cart-count"),
  drawer:document.getElementById("cart-drawer"),
  backdrop:document.getElementById("backdrop"),
  closeCart:document.getElementById("close-cart"),
  cartItems:document.getElementById("cart-items"),
  cartTotal:document.getElementById("cart-total"),
  checkout:document.getElementById("checkout"),
  toast:document.getElementById("toast")
};

async function fetchFromSheets(){
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${SHEETS_API_KEY}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error("Sheets API error");
  const data=await r.json();
  const rows=data.values||[];
  if(rows.length===0) return [];
  const headers=rows[0].map(h=>String(h));
  const idx=cands=>{for(const c of cands){const i=headers.findIndex(h=>norm(h)===norm(c));if(i>-1)return i}return -1};
  const iNum=idx(["number","saree number","saree","no","sr no","srno"]);
  const iColor=idx(["color","colour"]);
  const iFabric=idx(["fabric","material"]);
  const iPrice=idx(["price","cost","cost price","mrp","amount"]);
  const iPhoto=idx(["photo","image","img","picture","url","link"]);
  const out=[];
  for(let ri=1;ri<rows.length;ri++){
    const row=rows[ri];
    if(!row) continue;
    out.push({
      Number:String(row[iNum]||"").trim(),
      Color:String(row[iColor]||"").trim(),
      Fabric:String(row[iFabric]||"").trim(),
      Price:Number(String(row[iPrice]||"").replace(/[^0-9.]/g,"")||0),
      Photo:String(row[iPhoto]||"").trim()
    });
  }
  return out.filter(x=>x.Number||x.Color||x.Fabric||x.Price||x.Photo);
}

function initFilters(){
  const fabrics=[...new Set(state.data.map(x=>x.Fabric).filter(Boolean))].sort();
  const colors=[...new Set(state.data.map(x=>x.Color).filter(Boolean))].sort();
  els.fabric.innerHTML='<option value="">Fabric</option>';
  els.color.innerHTML='<option value="">Color</option>';
  fabrics.forEach(f=>{const o=document.createElement("option");o.value=f;o.textContent=f;els.fabric.appendChild(o);});
  colors.forEach(c=>{const o=document.createElement("option");o.value=c;o.textContent=c;els.color.appendChild(o);});
}

function applyFilters(){
  let rows=state.data.slice();
  if(state.query){
    const q=state.query.toLowerCase();
    rows=rows.filter(r=>String(r.Number).toLowerCase().includes(q)||String(r.Color).toLowerCase().includes(q)||String(r.Fabric).toLowerCase().includes(q));
  }
  if(state.min!=="") rows=rows.filter(r=>Number(r.Price)>=Number(state.min));
  if(state.max!=="") rows=rows.filter(r=>Number(r.Price)<=Number(state.max));
  if(state.fabric) rows=rows.filter(r=>r.Fabric===state.fabric);
  if(state.color) rows=rows.filter(r=>r.Color===state.color);
  if(state.sort==="price-asc") rows.sort((a,b)=>a.Price-b.Price);
  if(state.sort==="price-desc") rows.sort((a,b)=>b.Price-a.Price);
  if(state.sort==="number-asc") rows.sort((a,b)=>String(a.Number).localeCompare(String(b.Number),undefined,{numeric:true}));
  if(state.sort==="number-desc") rows.sort((a,b)=>String(b.Number).localeCompare(String(a.Number),undefined,{numeric:true}));
  state.filtered=rows;
  renderGrid();
}

function shareText(item){
  const t=`Saree ${item.Number}\nColor: ${item.Color}\nFabric: ${item.Fabric}\nPrice: ₹${item.Price}`;
  return `https://wa.me/?text=${encodeURIComponent(t)}`;
}

function addToCart(item){
  const key=item.Number;
  if(!state.cart[key]) state.cart[key]={...item,qty:0};
  state.cart[key].qty+=1;
  localStorage.setItem("saree_cart",JSON.stringify(state.cart));
  refreshCartUI();
}

function updateQty(key,delta){
  if(!state.cart[key]) return;
  state.cart[key].qty+=delta;
  if(state.cart[key].qty<=0) delete state.cart[key];
  localStorage.setItem("saree_cart",JSON.stringify(state.cart));
  refreshCartUI();
}

function renderGrid(){
  els.grid.innerHTML="";
  state.filtered.forEach(item=>{
    const card=document.createElement("article");
    card.className="card";
    const img=document.createElement("img");
    const src=item.Photo?toDirectDrive(item.Photo):"";
    img.src=src||PLACEHOLDER;
    img.alt="Saree Image";
    img.setAttribute("referrerpolicy","no-referrer");
    img.onerror=()=>img.src=PLACEHOLDER;
    const content=document.createElement("div");
    content.className="content";
    const h=document.createElement("h3");
    h.className="title";
    h.textContent=item.Number||"-";
    const meta=document.createElement("div");
    meta.className="meta";
    meta.innerHTML=`<div><strong>Color:</strong> ${item.Color||"-"}</div><div><strong>Fabric:</strong> ${item.Fabric||"-"}</div><div class="price">₹${currency(item.Price)}</div>`;
    const row=document.createElement("div");
    row.className="row";
    const add=document.createElement("button");
    add.className="mini primary";
    add.textContent="Add to Cart";
    add.onclick=()=>addToCart(item);
    const share=document.createElement("a");
    share.className="mini";
    share.href=shareText(item);
    share.target="_blank";
    share.rel="noopener";
    share.textContent="Share";
    row.append(add,share);
    content.append(h,meta);
    card.append(img,content,row);
    els.grid.appendChild(card);
  });
}

function refreshCartUI(){
  const items=Object.values(state.cart);
  els.cartCount.textContent=items.reduce((a,c)=>a+c.qty,0);
  els.cartItems.innerHTML="";
  let total=0;
  items.forEach(x=>{
    total+=x.qty*Number(x.Price||0);
    const line=document.createElement("div");
    line.className="cart-line";
    const im=document.createElement("img");
    im.src=(x.Photo?toDirectDrive(x.Photo):"")||PLACEHOLDER;
    im.onerror=()=>im.src=PLACEHOLDER;
    const info=document.createElement("div");
    info.innerHTML=`<div style="font-weight:700">${x.Number}</div><div style="color:#8b8ba3;font-size:13px">${x.Color||"-"} • ${x.Fabric||"-"}</div><div style="margin-top:6px">₹${currency(x.Price)}</div>`;
    const qty=document.createElement("div");
    qty.className="qty";
    const minus=document.createElement("button");minus.className="mini";minus.textContent="−";minus.onclick=()=>updateQty(x.Number,-1);
    const count=document.createElement("div");count.textContent=x.qty;
    const plus=document.createElement("button");plus.className="mini";plus.textContent="+";plus.onclick=()=>updateQty(x.Number,1);
    qty.append(minus,count,plus);
    line.append(im,info,qty);
    els.cartItems.appendChild(line);
  });
  els.cartTotal.textContent=currency(total);
}

function exportCSV(){
  const rows=state.filtered.map(r=>({Number:r.Number,Color:r.Color,Fabric:r.Fabric,Price:r.Price,Photo:r.Photo||""}));
  const headers=Object.keys(rows[0]||{Number:"",Color:"",Fabric:"",Price:"",Photo:""});
  const csv=[headers.join(","),...rows.map(o=>headers.map(h=>{const v=o[h]??"";const s=String(v).replace(/"/g,'""');return /[",\n]/.test(s)?`"${s}"`:s;}).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="saree_inventory_filtered.csv";
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function bindUI(){
  els.q.addEventListener("input",e=>{state.query=e.target.value.trim();applyFilters();});
  els.min.addEventListener("input",e=>{state.min=e.target.value;applyFilters();});
  els.max.addEventListener("input",e=>{state.max=e.target.value;applyFilters();});
  els.fabric.addEventListener("change",e=>{state.fabric=e.target.value;applyFilters();});
  els.color.addEventListener("change",e=>{state.color=e.target.value;applyFilters();});
  els.sort.addEventListener("change",e=>{state.sort=e.target.value;applyFilters();});
  els.clear.addEventListener("click",()=>{els.q.value="";els.min.value="";els.max.value="";els.fabric.value="";els.color.value="";els.sort.value="relevance";state.query="";state.min="";state.max="";state.fabric="";state.color="";state.sort="relevance";applyFilters();});
  els.exportBtn.addEventListener("click",exportCSV);
  els.cartBtn.addEventListener("click",()=>openCart(true));
  els.closeCart.addEventListener("click",()=>openCart(false));
  els.backdrop.addEventListener("click",()=>openCart(false));
  els.checkout.addEventListener("click",()=>{if(Object.keys(state.cart).length===0)return;toast("Checkout is a demo.");});
}

function openCart(show){
  els.drawer.classList.toggle("open",show);
  els.backdrop.classList.toggle("show",show);
}

function loadCart(){
  const raw=localStorage.getItem("saree_cart");
  state.cart=raw?JSON.parse(raw):{};
}

function toast(msg){
  els.toast.textContent=msg;
  els.toast.classList.add("show");
  setTimeout(()=>els.toast.classList.remove("show"),1800);
}

async function bootstrap(){
  loadCart();
  bindUI();
  try{
    state.data=await fetchFromSheets();
  }catch(e){
    toast("Sheets API error or key/range invalid");
    state.data=[];
  }
  initFilters();
  applyFilters();
  refreshCartUI();
}

bootstrap();
