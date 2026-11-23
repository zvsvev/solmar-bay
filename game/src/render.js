// The painter: a top-down sun-soaked city. Ground, beach and sea, roads with lane
// dashes, rooftops with shade, cars, pedestrians, the player, bullets and the mission
// beacon — everything drawn from the world state, nothing loaded from a file.
import { BEACH_Y, CAR_H, CAR_W, PALETTE, ROAD_W, WORLD_H, WORLD_W } from './config.js';

function inView(cam, x, y, margin) {
  return x > cam.x - margin && x < cam.x + cam.w + margin && y > cam.y - margin && y < cam.y + cam.h + margin;
}

function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-CAR_W / 2 + 3, -CAR_H / 2 + 4, CAR_W, CAR_H);
  // Body.
  ctx.fillStyle = car.isPolice ? '#e8ecf1' : car.color;
  roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 7);
  ctx.fill();
  if (car.isPolice) {
    ctx.fillStyle = '#2f6fd0';
    ctx.fillRect(-6, -CAR_H / 2, 12, CAR_H);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 + 3, 6, 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-CAR_W / 2 + 4, CAR_H / 2 - 7, 6, 4);
  }
  // Windshield and roof.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.fillRect(CAR_W / 2 - 14, -CAR_H / 2 + 3, 8, CAR_H - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(-8, -CAR_H / 2 + 3, 12, CAR_H - 6);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(CAR_W / 2 - 2, -CAR_H / 2 + 2, 3, 4);
  ctx.fillRect(CAR_W / 2 - 2, CAR_H / 2 - 6, 3, 4);
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    roundRect(ctx, -CAR_W / 2 - 3, -CAR_H / 2 - 3, CAR_W + 6, CAR_H + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawGround(cam) {
    // Grass.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    const start = Math.floor(cam.y / stripe) * stripe;
    for (let y = start; y < cam.y + cam.h; y += stripe * 2) {
      ctx.fillRect(cam.x, y, cam.w, stripe);
    }
    // Beach and sea.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cam.x, Math.max(cam.y, BEACH_Y), cam.w, Math.min(cam.h, WORLD_H - BEACH_Y));
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(cam.x, Math.max(cam.y, BEACH_Y + 90), cam.w, Math.min(cam.h, WORLD_H - BEACH_Y - 90));
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(cam.x, Math.max(cam.y, BEACH_Y + 150), cam.w, Math.min(cam.h, WORLD_H - BEACH_Y - 150));
    // Pier planks.
    ctx.fillStyle = '#8a6f4d';
    const pierX = 1820;
    ctx.fillRect(pierX - 26, BEACH_Y + 60, 52, WORLD_H - BEACH_Y - 60);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let y = BEACH_Y + 70; y < WORLD_H; y += 18) {
      ctx.beginPath();
      ctx.moveTo(pierX - 26, y);
      ctx.lineTo(pierX + 26, y);
      ctx.stroke();
    }
  }

  function drawRoads(cam, city) {
    for (const r of city.roads) {
      if (!inView(cam, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) / 2 + 40)) continue;
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Centre dashes.
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const r of city.roads) {
      ctx.beginPath();
      if (r.vertical) {
        ctx.moveTo(r.x + r.w / 2, Math.max(r.y, cam.y));
        ctx.lineTo(r.x + r.w / 2, Math.min(r.y + r.h, cam.y + cam.h));
      } else {
        ctx.moveTo(Math.max(r.x, cam.x), r.y + r.h / 2);
        ctx.lineTo(Math.min(r.x + r.w, cam.x + cam.w), r.y + r.h / 2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawPark(cam, city) {
    const p = city.park;
    if (!inView(cam, p.x + p.w / 2, p.y + p.h / 2, 200)) return;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#2f5e2a';
    for (let i = 0; i < 8; i += 1) {
      const tx = p.x + 30 + ((i * 53) % (p.w - 60));
      const ty = p.y + 30 + ((i * 71) % (p.h - 60));
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7fb3d5';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBuildings(cam, city) {
    for (const b of city.buildings) {
      if (!inView(cam, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      // Drop shadow for a little height.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = b.trim;
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      // Rooftop details: vents and a lighter inner slab.
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      ctx.fillStyle = b.trim;
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
    // Landmark labels.
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const key of Object.keys(city.landmarks)) {
      const p = city.landmarks[key];
      if (!inView(cam, p.x, p.y, 100)) continue;
      ctx.fillStyle = 'rgba(10,14,20,0.7)';
      const w = ctx.measureText(p.label).width + 14;
      ctx.fillRect(p.x - w / 2, p.y - 30, w, 18);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(p.label, p.x, p.y - 21);
    }
  }

  function drawMarker(cam, world) {
    const target = world.missionTarget();
    if (!target) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.12;
    ctx.save();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 52);
    ctx.lineTo(target.x - 10, target.y - 34);
    ctx.lineTo(target.x + 10, target.y - 34);
    ctx.closePath();
    ctx.fill();
    // A guiding arrow from the player toward the target.
    const dx = target.x - world.player.x;
    const dy = target.y - world.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 220) {
      const ax = world.player.x + (dx / d) * 90;
      const ay = world.player.y + (dy / d) * 90;
      const ang = Math.atan2(dy, dx);
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,210,63,0.9)';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPickups(cam, world) {
    for (const p of world.combat.pickups) {
      if (!inView(cam, p.x, p.y, 40)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.kind === 'health' ? '#e5484d' : p.kind === 'ammo' ? '#f39c12' : '#37c978';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'ammo' ? 'A' : '$', 0, 0);
      ctx.restore();
    }
  }

  function drawPeds(cam, world) {
    for (const ped of world.traffic.peds) {
      if (!inView(cam, ped.x, ped.y, 40)) continue;
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlayer(cam, world) {
    const p = world.player;
    if (p.car) return; // drawn with the cars
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(10, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (world.combat.muzzle > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(24, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBullets(cam, world) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of world.combat.bullets) {
      if (!inView(cam, b.x, b.y, 20)) continue;
      ctx.fillRect(b.x - 3, b.y - 1, 6, 2);
    }
  }

  return {
    ctx,
    draw(world, screen) {
      const cam = world.camera;
      const W = canvas.width;
      const H = canvas.height;
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(-cam.x, -cam.y);
      drawGround(cam);
      drawRoads(cam, world.city);
      drawPark(cam, world.city);
      drawBuildings(cam, world.city);
      drawMarker(cam, world);
      drawPickups(cam, world);
      for (const car of world.traffic.cars) {
        if (inView(cam, car.x, car.y, 60)) drawCar(ctx, car, false);
      }
      for (const u of world.police.units) {
        if (u.kind === 'car' && inView(cam, u.x, u.y, 60)) drawCar(ctx, { ...u, isPolice: true, color: '#e8ecf1' }, false);
      }
      drawPeds(cam, world);
      for (const u of world.police.units) {
        if (u.kind !== 'ped' || !inView(cam, u.x, u.y, 40)) continue;
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.fillStyle = '#1d3a6e';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8ecf1';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (world.player.car) drawCar(ctx, world.player.car, true);
      drawPlayer(cam, world);
      drawBullets(cam, world);
      ctx.restore();

      // Warm sun vignette.
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
      grad.addColorStop(0, 'rgba(255,220,130,0)');
      grad.addColorStop(1, 'rgba(30,20,0,0.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      if (screen === 'title') drawTitle(ctx, W, H, world);
      if (screen === 'paused') drawPaused(ctx, W, H);
      if (screen === 'busted' || screen === 'wasted') drawEndCard(ctx, W, H, screen, world);
    },
  };
}

function drawTitle(ctx, W, H, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', W / 2, H / 2 - 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('an open-world crime story', W / 2, H / 2 - 74);
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '16px sans-serif';
  ctx.fillText('Steal cars. Outrun the police. Run three jobs for Rico Hale.', W / 2, H / 2 - 40);
  const hasSave = world.saveExists;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(hasSave ? 'ENTER — Continue   •   N — New game' : 'ENTER or CLICK — New game', W / 2, H / 2 + 30);
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move & drive  •  E enter / steal a car  •  Space punch  •  Click shoot  •  P pause  •  M mute', W / 2, H / 2 + 76);
  ctx.fillText(`Best: $${(world.best || 0).toLocaleString('en-US')}   •   Missions done: ${world.missionsDone}`, W / 2, H / 2 + 106);
  ctx.restore();
}

function drawPaused(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('P or Esc to keep playing', W / 2, H / 2 + 30);
  ctx.restore();
}

function drawEndCard(ctx, W, H, screen, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = screen === 'busted' ? '#3b82f6' : '#e5484d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(screen === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(screen === 'busted'
    ? 'The Solmar PD took you in. You lost some cash and your heat is gone.'
    : 'You woke up at Solmar General. The city keeps moving without you.', W / 2, H / 2 + 10);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ENTER — back to the streets', W / 2, H / 2 + 56);
  ctx.restore();
}
