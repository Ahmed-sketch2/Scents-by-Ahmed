const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const dbDir = path.join(__dirname, 'data');
const dbFile = path.join(dbDir, 'scents.db');
const uploadDir = path.join(__dirname, 'assets', 'products');
fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(__dirname));
const upload = multer({ storage: multer.diskStorage({
  destination: uploadDir,
  filename: (req,file,cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g,'-')}`)
}), limits:{fileSize:5*1024*1024}, fileFilter:(req,file,cb)=>cb(null,/^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)) });

let db;
const auth = (req,res,next) => {
  const token = req.headers.authorization || '';
  if (token !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).json({error:'Unauthorized'});
  next();
};

async function init(){
  db = await open({ filename: dbFile, driver: sqlite3.Database });
  await db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,price_pkr INTEGER NOT NULL,notes TEXT DEFAULT '',description TEXT DEFAULT '',image TEXT DEFAULT '',active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,customer_name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,city TEXT DEFAULT '',total_pkr INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,price_pkr INTEGER NOT NULL,quantity INTEGER NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  const count=await db.get('SELECT COUNT(*) count FROM products');
  if(!count.count){
    const seed=[['Noir',2999,'Dark woods · Amber · Vanilla','A bold, warm signature built for evening presence.'],['Élan',3299,'Bergamot · Jasmine · Musk','A refined, luminous fragrance with a clean modern finish.'],['Oud Royale',3299,'Oud · Saffron · Rosewood','Rich oud and warm woods with a luxurious character.'],['Velvet Rose',2999,'Rose · Musk · Sandalwood','Soft florals balanced by creamy woods and musk.'],['Imperial Musk',3299,'White Musk · Amber · Tonka','Smooth, elegant and quietly magnetic.'],['Azure Homme',2999,'Citrus · Lavender · Cedar','Fresh sophistication with a crisp woody dry-down.']];
    const s=await db.prepare('INSERT INTO products(name,price_pkr,notes,description) VALUES(?,?,?,?)'); for(const p of seed) await s.run(...p); await s.finalize();
  }
}

app.get('/api/products',async(req,res)=>{try{res.json(await db.all('SELECT * FROM products WHERE active=1 ORDER BY id'));}catch(e){res.status(500).json({error:'Database error'});}});
app.post('/api/orders',async(req,res)=>{const {customerName,phone,address,city,items}=req.body;if(!customerName||!phone||!address||!Array.isArray(items)||!items.length)return res.status(400).json({error:'Missing order information'});try{const ids=items.map(x=>Number(x.productId)).filter(Boolean);if(!ids.length)return res.status(400).json({error:'No valid products'});const products=await db.all(`SELECT id,name,price_pkr FROM products WHERE active=1 AND id IN (${ids.map(()=>'?').join(',')})`,ids);const map=new Map(products.map(p=>[p.id,p]));let total=0,normalized=[];for(const item of items){const p=map.get(Number(item.productId));const qty=Math.max(1,Math.min(20,Number(item.quantity)||1));if(!p)continue;total+=p.price_pkr*qty;normalized.push({p,qty});}if(!normalized.length)return res.status(400).json({error:'No valid products'});await db.run('BEGIN');const order=await db.run('INSERT INTO orders(customer_name,phone,address,city,total_pkr) VALUES(?,?,?,?,?)',customerName,phone,address,city||'',total);for(const x of normalized)await db.run('INSERT INTO order_items(order_id,product_id,product_name,price_pkr,quantity) VALUES(?,?,?,?,?)',order.lastID,x.p.id,x.p.name,x.p.price_pkr,x.qty);await db.run('COMMIT');res.status(201).json({orderId:order.lastID,totalPkr:total});}catch(e){try{await db.run('ROLLBACK')}catch{}res.status(500).json({error:'Could not create order'});}});
app.post('/api/messages',async(req,res)=>{const {name,email,message}=req.body;if(!name||!email||!message)return res.status(400).json({error:'Missing fields'});try{const r=await db.run('INSERT INTO messages(name,email,message) VALUES(?,?,?)',name,email,message);res.status(201).json({id:r.lastID});}catch(e){res.status(500).json({error:'Could not save message'});}});

app.post('/api/admin/login',(req,res)=>{if(req.body.password===ADMIN_PASSWORD)return res.json({token:ADMIN_PASSWORD});res.status(401).json({error:'Wrong password'});});
app.get('/api/admin/dashboard',auth,async(req,res)=>{try{const [products,orders,pending,messages,revenue]=await Promise.all([db.get('SELECT COUNT(*) count FROM products WHERE active=1'),db.get('SELECT COUNT(*) count FROM orders'),db.get("SELECT COUNT(*) count FROM orders WHERE status='pending'"),db.get('SELECT COUNT(*) count FROM messages'),db.get("SELECT COALESCE(SUM(total_pkr),0) total FROM orders WHERE status!='cancelled'")]);res.json({products:products.count,orders:orders.count,pending:pending.count,messages:messages.count,revenue:revenue.total});}catch(e){res.status(500).json({error:'Database error'});}});
app.get('/api/admin/products',auth,async(req,res)=>{res.json(await db.all('SELECT * FROM products ORDER BY id DESC'));});
app.post('/api/admin/products',auth,async(req,res)=>{const {name,price_pkr,notes='',description='',image='',active=1}=req.body;if(!name||Number(price_pkr)<0)return res.status(400).json({error:'Name and valid price required'});const r=await db.run('INSERT INTO products(name,price_pkr,notes,description,image,active) VALUES(?,?,?,?,?,?)',name,Math.round(Number(price_pkr)),notes,description,image,active?1:0);res.status(201).json(await db.get('SELECT * FROM products WHERE id=?',r.lastID));});
app.put('/api/admin/products/:id',auth,async(req,res)=>{const {name,price_pkr,notes='',description='',image='',active=1}=req.body;if(!name||Number(price_pkr)<0)return res.status(400).json({error:'Name and valid price required'});await db.run('UPDATE products SET name=?,price_pkr=?,notes=?,description=?,image=?,active=? WHERE id=?',name,Math.round(Number(price_pkr)),notes,description,image,active?1:0,req.params.id);res.json(await db.get('SELECT * FROM products WHERE id=?',req.params.id));});
app.delete('/api/admin/products/:id',auth,async(req,res)=>{await db.run('UPDATE products SET active=0 WHERE id=?',req.params.id);res.json({ok:true});});
app.post('/api/admin/upload',auth,upload.single('image'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Please upload a JPG, PNG, WEBP or AVIF image'});res.json({url:`/assets/products/${req.file.filename}`});});
app.get('/api/admin/orders',auth,async(req,res)=>{const orders=await db.all('SELECT * FROM orders ORDER BY id DESC');for(const o of orders)o.items=await db.all('SELECT * FROM order_items WHERE order_id=?',o.id);res.json(orders);});
app.put('/api/admin/orders/:id',auth,async(req,res)=>{const allowed=['pending','confirmed','shipped','delivered','cancelled'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'});await db.run('UPDATE orders SET status=? WHERE id=?',req.body.status,req.params.id);res.json(await db.get('SELECT * FROM orders WHERE id=?',req.params.id));});
app.get('/api/admin/messages',auth,async(req,res)=>{res.json(await db.all('SELECT * FROM messages ORDER BY id DESC'));});

init().then(()=>app.listen(PORT,()=>console.log(`Scents by Ahmed running at http://localhost:${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
