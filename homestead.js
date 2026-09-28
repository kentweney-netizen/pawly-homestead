/* PAWLY homestead week-1 slice. No wallet. House + 4 beds + 1 chicken + dock + orders. */
const TILE = 16, SCALE = 3, FW = 64, FH = 64;
const WORLD_W = 22, WORLD_H = 18;
const SAVE_KEY = "pawly_home_w1";
const ASSET_BASE = "https://pawly-estate.netlify.app/assets/";
const CROPS = [
  { id: "lettuce", name: "Lettuce", sy: 240, sell: 4, grow: 6 },
  { id: "cabbage", name: "Cabbage", sy: 144, sell: 5, grow: 7 },
  { id: "tomato", name: "Tomato", sy: 48, sell: 6, grow: 8 },
  { id: "carrot", name: "Carrot", sy: 176, sell: 5, grow: 7 },
  { id: "corn", name: "Corn", sy: 368, sell: 7, grow: 9 }
];
const P = {
  idle: { down: [0, 6], side: [1, 6], up: [2, 6] },
  walk: { down: [3, 6], side: [4, 6], up: [5, 6] },
  hoe: { down: [38, 6], side: [39, 6], up: [40, 6] }
};
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const boot = document.getElementById("boot");
const pick = document.getElementById("pick");
const shopEl = document.getElementById("shop");
const statEl = document.getElementById("stat");
const questEl = document.getElementById("quest");
let imgs = {}, cam = { x: 0, y: 0 }, keys = {}, last = 0;
let toolUntil = 0, playing = false, pendingPlot = null, scene = "farm", tap = null;
function defaultState() {
  return {
    look: null, lv: 0, xp: 0, coins: 20,
    plots: [
      { x: 8 * TILE, y: 10 * TILE, stage: 0, t: 0, crop: "lettuce" },
      { x: 10 * TILE, y: 10 * TILE, stage: 0, t: 0, crop: "lettuce" },
      { x: 12 * TILE, y: 10 * TILE, stage: 0, t: 0, crop: "lettuce" },
      { x: 14 * TILE, y: 10 * TILE, stage: 0, t: 0, crop: "lettuce" }
    ],
    inv: { lettuce: 0, cabbage: 0, tomato: 0, carrot: 0, corn: 0 },
    orders: [], ordersDone: 0, questDone: {},
    chicken: { x: 7 * TILE, y: 9 * TILE, vx: 5, pause: 0, moving: false },
    px: 11 * TILE, py: 12 * TILE, dir: "down", moving: false, savedAt: Date.now()
  };
}
let S = defaultState();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) S = Object.assign(defaultState(), JSON.parse(raw));
  if (!S.inv) S.inv = defaultState().inv;
  if (!S.plots || S.plots.length !== 4) S.plots = defaultState().plots;
  if (!S.chicken) S.chicken = defaultState().chicken;
  if (!S.questDone) S.questDone = {};
} catch (e) {}
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }
function toast(msg) { statEl.dataset.note = msg; statEl.textContent = hud() + " · " + msg; }
function hud() { return "Lv " + S.lv + "  XP " + S.xp + "/100  Coin " + S.coins; }
function addXp(n) {
  S.xp += n;
  while (S.xp >= 100 && S.lv < 5) { S.xp -= 100; S.lv += 1; S.coins += 10; toast("Level up · Lv " + S.lv); }
  if (S.lv >= 5 && !S.questDone.lv5) {
    S.questDone.lv5 = true;
    openShopHtml("<h3>Hunt unlock</h3><p>Lv 5 reached. Later this spends real PAWLY. For this slice, hunting stays closed and you can keep farming.</p><button type=\"button\" id=\"shopLeave\">Keep farming</button>");
  }
  refreshQuest();
}
function refreshQuest() {
  let t = "Tap the house, rest once, then plant the 4 beds.";
  if (S.questDone.rest && S.plots.filter((p) => p.stage > 0).length < 4) t = "Plant all 4 beds. Orders tells you what the stall wants.";
  else if (S.plots.some((p) => p.stage >= 5)) t = "A bed is ripe. Tap it to harvest.";
  else if (S.questDone.harvest && S.ordersDone < 1) t = "Open Orders and deliver what you grew.";
  else if (S.ordersDone >= 1 && S.lv < 5) t = "Keep planting for orders. 100 XP = 1 level.";
  else if (S.lv >= 5) t = "Homestead loop works. Token unlock waits for the next step.";
  else if (S.plots.every((p) => p.stage > 0)) t = "Wait for sprouts, or rest in the house.";
  questEl.textContent = t;
}
function asset(path) {
  const im = new Image();
  const url = ASSET_BASE + path.split("/").map(encodeURIComponent).join("/");
  return new Promise((res, rej) => { im.onload = () => res(im); im.onerror = () => rej(new Error(path)); im.src = url; });
}
async function loadPack() {
  const get = (p) => asset(p);
  imgs.base = await get("Cute_Fantasy/Player/Player_Base/Player_Base_animations.png");
  imgs.shirtB = await get("Cute_Fantasy/Player/Chest/Farmer_Shirt/Farmer_Shirt_1_Blue.png");
  imgs.shirtG = await get("Cute_Fantasy/Player/Chest/Farmer_Shirt/Farmer_Shirt_1_Pink.png");
  imgs.pants = await get("Cute_Fantasy/Player/Legs/Farmer_Pants/Farmer_Pants_1_White_and_Brown.png");
  imgs.hairB = await get("Cute_Fantasy/Player/Head/Hair_1/Hair_1_Brown.png");
  imgs.hairG = await get("Cute_Fantasy/Player/Head/Hair_1/Hair_1_Blonde.png");
  imgs.hat = await get("Cute_Fantasy/Player/Accessories/Farmer_Hat_1.png");
  imgs.grass = await get("Cute_Fantasy/Tiles/Grass/Grass_1_Middle.png");
  imgs.grass2 = await get("Cute_Fantasy/Tiles/Grass/Grass_2_Middle.png");
  imgs.path = await get("Cute_Fantasy/Tiles/Grass/Path_Middle.png");
  imgs.dirt = await get("Cute_Fantasy/Tiles/FarmLand/FarmLand_Tile.png");
  imgs.waterAnim = await get("Cute_Fantasy/Tiles/Water/Water_Middle_Anim_1.png");
  imgs.cliff = await get("Cute_Fantasy/Tiles/Cliff/Stone_Cliff_1_Tile.png");
  imgs.crops = await get("Cute_Fantasy/Crops/Crops.png");
  imgs.house1 = await get("Cute_Fantasy/Buildings/Buildings/Houses/Wood/House_1_Wood_Red_Red.png");
  imgs.stall = await get("Cute_Fantasy/Buildings/Buildings/Unique_Buildings/Stalls/Market_Stalls.png");
  imgs.oak = await get("Cute_Fantasy/Trees/Big_Oak_Tree.png");
  imgs.boat = await get("Cute_Fantasy/Outdoor decoration/Boat.png");
  imgs.bridge = await get("Cute_Fantasy/Tiles/Bridge/Bridge_Wood.png");
  imgs.flowers = await get("Cute_Fantasy/Outdoor decoration/Flowers.png");
  imgs.floor = await get("Cute_Fantasy/Buildings/Houses_Interiors/Wood_Floor_Tiles.png");
  imgs.chicken = await get("Cute_Fantasy/Animals/Chicken/Chicken_01.png");
}
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener("resize", resize); resize();
function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return "water";
  if (ty <= 1) return "cliff";
  if (ty >= 15) return "water";
  if (ty === 14 && !(tx >= 8 && tx <= 13)) return "water";
  if (ty === 9 && tx >= 8 && tx <= 14) return "path";
  if (tx === 11 && ty >= 7 && ty <= 14) return "path";
  if (ty === 14 && tx >= 8 && tx <= 13) return "path";
  return "grass";
}
function blocked(wx, wy) {
  return [[0, 0], [5, 0], [-5, 0], [0, 4], [0, -3]].some(([dx, dy]) => {
    const t = tileAt(Math.floor((wx + dx) / TILE), Math.floor((wy + dy) / TILE));
    return t === "water" || t === "cliff";
  });
}
function drawFrame(img, col, row, x, y, flip) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.scale(-1, 1); ctx.translate(-FW * SCALE, 0); }
  ctx.drawImage(img, col * FW, row * FH, FW, FH, 0, 0, FW * SCALE, FH * SCALE);
  ctx.restore();
}
function drawFarmer(t) {
  const table = (t < toolUntil ? P.hoe : S.moving ? P.walk : P.idle);
  const key = S.dir === "left" ? "side" : S.dir;
  const [row, n] = table[key] || table.down;
  const col = Math.floor(t / 140) % n;
  const flip = S.dir === "left";
  const sx = S.px * SCALE - cam.x - (FW * SCALE) / 2;
  const sy = S.py * SCALE - cam.y - FH * SCALE + 18;
  const shirt = S.look === "girl" ? imgs.shirtG : imgs.shirtB;
  const hair = S.look === "girl" ? imgs.hairG : imgs.hairB;
  drawFrame(imgs.base, col, row, sx, sy, flip);
  drawFrame(imgs.pants, col, row, sx, sy, flip);
  drawFrame(shirt, col, row, sx, sy, flip);
  drawFrame(hair, col, row, sx, sy, flip);
  drawFrame(imgs.hat, col, row, sx, sy, flip);
}
function drawWorld(t) {
  const tw = TILE * SCALE;
  const wcol = Math.floor(t / 400) % 8;
  const x0 = Math.floor(cam.x / tw) - 1, y0 = Math.floor(cam.y / tw) - 1;
  const x1 = x0 + Math.ceil(canvas.width / tw) + 2, y1 = y0 + Math.ceil(canvas.height / tw) + 2;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const dx = tx * tw - cam.x, dy = ty * tw - cam.y;
      const kind = tileAt(tx, ty);
      if (kind === "water") ctx.drawImage(imgs.waterAnim, wcol * 16, 0, 16, 16, dx, dy, tw, tw);
      else if (kind === "cliff") ctx.drawImage(imgs.cliff, (tx % 14) * 16, 16, 16, dx, dy, tw, tw);
      else if (kind === "path") ctx.drawImage(imgs.path, 0, 0, 16, 16, dx, dy, tw, tw);
      else {
        ctx.drawImage((Math.abs(tx + ty) % 2) ? imgs.grass2 : imgs.grass, 0, 0, 16, 16, dx, dy, tw, tw);
        if ((tx * 13 + ty * 7) % 19 === 0) ctx.drawImage(imgs.flowers, ((tx + ty) % 5) * 16, 0, 16, 16, dx + 10, dy + 10, 14, 14);
      }
    }
  }
  ctx.drawImage(imgs.bridge, 8 * tw - cam.x, 13.6 * tw - cam.y, 120, 40);
  ctx.drawImage(imgs.boat, 14 * tw - cam.x, 15.4 * tw - cam.y, 48, 32);
  ctx.drawImage(imgs.house1, 8 * tw - cam.x, 3.2 * tw - cam.y, 96 * 1.45, 128 * 1.45);
  ctx.drawImage(imgs.stall, 6.2 * tw - cam.x, 11.2 * tw - cam.y, 96, 48);
  ctx.drawImage(imgs.oak, 16 * tw - cam.x - 30, 5 * tw - cam.y - 60, 80, 90);
  ctx.drawImage(imgs.oak, 3 * tw - cam.x - 30, 6 * tw - cam.y - 50, 70, 80);
  S.plots.forEach((p) => {
    const dx = p.x * SCALE - cam.x, dy = p.y * SCALE - cam.y;
    ctx.drawImage(imgs.dirt, 0, 0, 16, 16, dx, dy, tw, tw);
    if (p.stage > 0) {
      const crop = CROPS.find((c) => c.id === p.crop) || CROPS[0];
      ctx.drawImage(imgs.crops, (1 + Math.min(5, p.stage)) * 16, crop.sy, 16, 16, dx, dy - 8, tw, tw + 8);
    }
  });
}
function drawChicken(t) {
  const a = S.chicken;
  const row = a.moving ? 1 : 0;
  const n = a.moving ? 6 : 2;
  const col = Math.floor(t / 180) % n;
  const flip = a.vx < 0;
  const x = a.x * SCALE - cam.x - 48;
  const y = a.y * SCALE - cam.y - 88;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.scale(-1, 1); ctx.translate(-96, 0); }
  ctx.drawImage(imgs.chicken, col * 32, row * 32, 32, 32, 0, 0, 96, 96);
  ctx.restore();
}
function drawHome() {
  const tw = TILE * SCALE;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    ctx.drawImage(imgs.floor, 0, 0, 16, 16, x * tw - cam.x, y * tw - cam.y, tw, tw);
  }
}
function makeOrder() {
  const pool = [{ lettuce: 2 }, { cabbage: 1 }, { tomato: 1 }, { carrot: 2 }, { corn: 1 }];
  const needs = pool[Math.floor(Math.random() * pool.length)];
  const who = ["Mira", "Bob", "Buba"][Math.floor(Math.random() * 3)];
  const qty = Object.values(needs)[0];
  return { id: Date.now() + Math.random(), who, needs, xp: 22 + qty * 6, coins: 6 + qty * 4, label: who + " wants " + Object.keys(needs).map((k) => needs[k] + " " + k).join(", ") };
}
function fillOrders() { if (!S.orders) S.orders = []; while (S.orders.length < 3) S.orders.push(makeOrder()); }
function hasNeeds(needs) { return Object.keys(needs).every((k) => (S.inv[k] || 0) >= needs[k]); }
function openShopHtml(html) {
  shopEl.hidden = false;
  shopEl.innerHTML = html;
  const leave = shopEl.querySelector("#shopLeave");
  if (leave) leave.onclick = () => { shopEl.hidden = true; };
}
function openHouse() {
  scene = "home";
  S.px = 5 * TILE; S.py = 6 * TILE;
  openShopHtml("<h3>Your house</h3><p>Rest, then leave and farm the 4 beds.</p><button type=\"button\" id=\"restBtn\">Rest (+20 XP)</button><button type=\"button\" id=\"shopLeave\">Leave house</button>");
  shopEl.querySelector("#restBtn").onclick = () => { addXp(20); S.questDone.rest = true; toast("Rested"); save(); refreshQuest(); };
  shopEl.querySelector("#shopLeave").onclick = () => { shopEl.hidden = true; scene = "farm"; S.px = 11 * TILE; S.py = 12 * TILE; };
}
function openOrders() {
  fillOrders();
  let html = "<h3>Town orders</h3><p>Plant what the stall asks. Deliver for XP.</p>";
  S.orders.forEach((o) => {
    const ok = hasNeeds(o.needs);
    html += "<p class=\"" + (ok ? "ok" : "miss") + "\">" + o.label + " · +" + o.xp + " XP</p>";
    html += "<button type=\"button\" data-oid=\"" + o.id + "\">" + (ok ? "Deliver" : "Need items") + "</button>";
  });
  html += "<button type=\"button\" id=\"shopLeave\">Close</button>";
  openShopHtml(html);
  shopEl.querySelectorAll("[data-oid]").forEach((b) => {
    b.onclick = () => {
      const o = S.orders.find((x) => String(x.id) === b.dataset.oid);
      if (!o) return;
      if (!hasNeeds(o.needs)) return toast("Grow what they asked");
      Object.keys(o.needs).forEach((k) => { S.inv[k] -= o.needs[k]; });
      addXp(o.xp); S.coins += o.coins; S.ordersDone += 1;
      S.orders = S.orders.filter((x) => x.id !== o.id);
      fillOrders(); toast("Order done · +" + o.xp + " XP"); save(); openOrders();
    };
  });
}
function showCropPick(plot) {
  pendingPlot = plot;
  const hint = S.orders[0] ? ("Stall wants: " + Object.keys(S.orders[0].needs).join(", ")) : "Pick a crop";
  openShopHtml("<h3>Plant</h3><p>" + hint + "</p>" + CROPS.map((c) => "<button type=\"button\" data-c=\"" + c.id + "\">" + c.name + "</button>").join("") + "<button type=\"button\" id=\"shopLeave\">Cancel</button>");
  shopEl.querySelectorAll("[data-c]").forEach((b) => {
    b.onclick = () => {
      pendingPlot.crop = b.dataset.c; pendingPlot.stage = 1; pendingPlot.t = 0;
      addXp(8); toolUntil = performance.now() + 400; toast("Planted " + b.dataset.c);
      pendingPlot = null; shopEl.hidden = true; save(); refreshQuest();
    };
  });
}
function harvestOrPlant(plot) {
  if (plot.stage >= 5) {
    const crop = CROPS.find((c) => c.id === plot.crop) || CROPS[0];
    plot.stage = 0;
    S.inv[crop.id] = (S.inv[crop.id] || 0) + 1;
    addXp(20); S.questDone.harvest = true;
    toolUntil = performance.now() + 400;
    toast("Harvested " + crop.name); save(); refreshQuest();
    return;
  }
  if (plot.stage === 0) showCropPick(plot);
}
function step(dt) {
  S.plots.forEach((p) => {
    if (p.stage > 0 && p.stage < 5) {
      const crop = CROPS.find((c) => c.id === p.crop) || CROPS[0];
      p.t += dt;
      if (p.t > crop.grow) { p.t = 0; p.stage += 1; }
    }
  });
  const a = S.chicken;
  if (a.pause > 0) { a.pause -= dt; a.moving = false; }
  else if (Math.random() < 0.015) { a.pause = 1 + Math.random() * 2; a.moving = false; }
  else {
    const nx = a.x + a.vx * dt;
    if (nx < 6 * TILE || nx > 9.5 * TILE || blocked(nx, a.y)) a.vx *= -1;
    else a.x = nx;
    a.moving = true;
  }
}
function move(dt) {
  let vx = 0, vy = 0;
  if (keys.w || keys.arrowup) vy -= 1;
  if (keys.s || keys.arrowdown) vy += 1;
  if (keys.a || keys.arrowleft) vx -= 1;
  if (keys.d || keys.arrowright) vx += 1;
  if (tap) { vx = tap.x - S.px; vy = tap.y - S.py; if (Math.hypot(vx, vy) < 8) tap = null; }
  const len = Math.hypot(vx, vy) || 1;
  S.moving = !!(vx || vy);
  if (!S.moving) return;
  const nx = S.px + (vx / len) * 48 * dt;
  const ny = S.py + (vy / len) * 48 * dt;
  if (scene === "farm") {
    if (!blocked(nx, S.py)) S.px = nx;
    if (!blocked(S.px, ny)) S.py = ny;
  } else { S.px = nx; S.py = ny; }
  if (Math.abs(vx) > Math.abs(vy)) S.dir = vx < 0 ? "left" : "right";
  else S.dir = vy < 0 ? "up" : "down";
}
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const wx = (e.clientX - r.left) + cam.x;
  const wy = (e.clientY - r.top) + cam.y;
  const worldX = wx / SCALE, worldY = wy / SCALE;
  if (scene === "home") { tap = { x: worldX, y: worldY }; return; }
  const plot = S.plots.find((p) => Math.hypot(p.x + 8 - worldX, p.y + 8 - worldY) < 14);
  if (plot) { harvestOrPlant(plot); return; }
  const houseX = 8 * TILE * SCALE, houseY = 3.2 * TILE * SCALE;
  if (wx >= houseX && wx <= houseX + 96 * 1.45 && wy >= houseY && wy <= houseY + 128 * 1.45) { openHouse(); return; }
  const stallX = 6.2 * TILE * SCALE, stallY = 11.2 * TILE * SCALE;
  if (wx >= stallX && wx <= stallX + 96 && wy >= stallY && wy <= stallY + 48) { openOrders(); return; }
  tap = { x: worldX, y: worldY };
});
addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
document.getElementById("btnOrders").onclick = openOrders;
document.getElementById("btnHouse").onclick = openHouse;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  move(dt); if (scene === "farm") step(dt);
  cam.x = S.px * SCALE - canvas.width / 2;
  cam.y = S.py * SCALE - canvas.height / 2;
  ctx.fillStyle = scene === "home" ? "#6b4a2b" : "#4aa0d8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (scene === "home") drawHome();
  else { drawWorld(now); drawChicken(now); }
  drawFarmer(now);
  if (!statEl.dataset.note) statEl.textContent = hud();
  requestAnimationFrame(loop);
}
function startPlay() {
  pick.classList.add("hidden");
  fillOrders(); refreshQuest();
  if (!playing) { playing = true; requestAnimationFrame(loop); }
}
document.getElementById("pickBoy").onclick = () => { S.look = "boy"; save(); startPlay(); };
document.getElementById("pickGirl").onclick = () => { S.look = "girl"; save(); startPlay(); };
loadPack().then(() => {
  if (boot) boot.remove();
  statEl.textContent = hud();
  if (S.look) startPlay();
}).catch((err) => { boot.textContent = "Load failed: " + err.message; });
