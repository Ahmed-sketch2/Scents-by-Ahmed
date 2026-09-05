const cart = JSON.parse(localStorage.getItem('sba_cart') || '[]');
let products = [];
const $ = id => document.getElementById(id);
const cartBtn=$('cartBtn'),cartDrawer=$('cartDrawer'),closeCart=$('closeCart'),overlay=$('overlay'),cartItems=$('cartItems'),cartCount=$('cartCount'),cartTotal=$('cartTotal');
const money = n => 'PKR ' + Number(n).toLocaleString('en-PK');
function save(){localStorage.setItem('sba_cart',JSON.stringify(cart));}
function renderCart(){
  const count=cart.reduce((a,x)=>a+x.quantity,0); cartCount.textContent=count;
  if(!cart.length){cartItems.innerHTML='<p class="empty">Your bag is empty.</p>';cartTotal.textContent=money(0);return;}
  cartItems.innerHTML=cart.map((x,i)=>`<div class="cart-item"><div><strong>${x.name}</strong><br><small>${money(x.price)} × ${x.quantity}</small></div><div><button class="remove" data-i="${i}">−</button> <button class="remove" data-i="${i}" data-add="1">+</button></div></div>`).join('');
  cartTotal.textContent=money(cart.reduce((a,x)=>a+x.price*x.quantity,0));
  cartItems.querySelectorAll('.remove').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;cart[i].quantity += b.dataset.add ? 1 : -1;if(cart[i].quantity<=0)cart.splice(i,1);save();renderCart();});
}
function openCart(){cartDrawer.classList.add('open');overlay.classList.add('show');cartDrawer.setAttribute('aria-hidden','false')}
function hideCart(){cartDrawer.classList.remove('open');overlay.classList.remove('show');cartDrawer.setAttribute('aria-hidden','true')}
function addProduct(id){const p=products.find(x=>x.id===id);if(!p)return;const found=cart.find(x=>x.productId===id);if(found)found.quantity++;else cart.push({productId:p.id,name:p.name,price:p.price_pkr,quantity:1});save();renderCart();openCart();}
function renderProducts(){
  $('productGrid').innerHTML=products.map((p,i)=>`<article class="product-card ${i===1?'featured':''}"><div class="product-image"><span>${p.image?`<img src="${p.image}" alt="${p.name}">`:'PRODUCT<br>PHOTO'}</span><b>${String(i+1).padStart(2,'0')}</b></div><div class="product-info"><p class="product-type">EAU DE PARFUM</p><h3>${p.name}</h3><p class="notes">${p.notes}</p><div class="product-bottom"><strong>${money(p.price_pkr)}</strong><button class="add-btn" data-id="${p.id}">Add to bag</button></div></div></article>`).join('');
  document.querySelectorAll('.add-btn').forEach(b=>b.onclick=()=>addProduct(+b.dataset.id));
}
async function loadProducts(){try{const r=await fetch('/api/products');products=await r.json();renderProducts();}catch(e){$('productGrid').innerHTML='<p>Unable to load products. Start the server with npm start.</p>';}}
cartBtn.onclick=openCart;closeCart.onclick=hideCart;overlay.onclick=hideCart;
$('checkoutBtn').onclick=async()=>{
  if(!cart.length)return alert('Your bag is empty.');
  const customerName=prompt('Your name'); if(!customerName)return;
  const phone=prompt('Phone / WhatsApp number'); if(!phone)return;
  const address=prompt('Delivery address'); if(!address)return;
  const city=prompt('City');
  const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName,phone,address,city,items:cart})});
  const data=await r.json(); if(!r.ok)return alert(data.error||'Order failed');
  alert(`Order #${data.orderId} received. Total: ${money(data.totalPkr)}`);cart.length=0;save();renderCart();hideCart();
};
$('contactForm').onsubmit=async e=>{e.preventDefault();const body={name:$('contactName').value,email:$('contactEmail').value,message:$('contactMessage').value};const r=await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(r.ok){alert('Thank you. Your message has been received.');e.target.reset();}else alert('Could not send message.');};
const menu=$('menuToggle'),nav=$('nav');menu.onclick=()=>nav.classList.toggle('open');nav.querySelectorAll('a').forEach(a=>a.onclick=()=>nav.classList.remove('open'));
renderCart();loadProducts();
