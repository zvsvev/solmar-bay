// The HUD: health and cash, the wanted stars, the current objective, the minimap with
// its road grid and blips, speed and weapon, phone messages from Rico, and the big
// centre banners (mission complete, busted, wasted). All drawn on the canvas.
import { AVENUES, BEACH_Y, STREETS, WORLD_H, WORLD_W } from './config.js';

const MINIMAP_W = 210;
const MINIMAP_H = 156;

export function createHud() {
  function drawStars(ctx, x, y, wanted) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x + i * 24, y);
    }
  }

  function drawMinimap(ctx, world, cam) {
    const x0 = ctx.canvas.width - MINIMAP_W - 14;
    const y0 = 14;
    const sx = MINIMAP_W / WORLD_W;
    const sy = MINIMAP_H / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(x0 - 6, y0 - 6, MINIMAP_W + 12, MINIMAP_H + 12);
    ctx.strokeStyle = '#5a6b7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 6, y0 - 6, MINIMAP_W + 12, MINIMAP_H + 12);
    ctx.fillStyle = '#3d5a3a';
    ctx.fillRect(x0, y0, MINIMAP_W, MINIMAP_H);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0, y0 + BEACH_Y * sy, MINIMAP_W, MINIMAP_H - BEACH_Y * sy);
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 2;
    for (const a of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(x0 + a * sx, y0);
      ctx.lineTo(x0 + a * sx, y0 + BEACH_Y * sy);
      ctx.stroke();
    }
    for (const s of STREETS) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + s * sy);
      ctx.lineTo(x0 + MINIMAP_W, y0 + s * sy);
      ctx.stroke();
    }
    // Landmarks.
    for (const key of Object.keys(world.city.landmarks)) {
      const p = world.city.landmarks[key];
      ctx.fillStyle = '#e8ecf1';
      ctx.beginPath();
      ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker: a pulsing gold diamond.
    const target = world.missionTarget();
    if (target) {
      const pulse = 4 + Math.sin(world.time * 5) * 1.5;
      ctx.fillStyle = '#ffd23f';
      ctx.save();
      ctx.translate(x0 + target.x * sx, y0 + target.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      ctx.restore();
    }
    // Police blips.
    ctx.fillStyle = '#3b82f6';
    for (const u of world.police.units) {
      ctx.beginPath();
      ctx.arc(x0 + u.x * sx, y0 + u.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white triangle pointing where they face.
    ctx.save();
    ctx.translate(x0 + world.player.x * sx, y0 + world.player.y * sy);
    ctx.rotate(world.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + cam.x * sx, y0 + cam.y * sy, cam.w * sx, cam.h * sy);
    ctx.restore();
  }

  return {
    draw(ctx, world, cam) {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const p = world.player;
      // Top-left: health bar, cash, wanted stars.
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      ctx.fillRect(12, 12, 250, 64);
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(24, 24, 150, 14);
      ctx.fillStyle = p.health > 30 ? '#37c978' : '#e5484d';
      ctx.fillRect(24, 24, 150 * Math.max(0, p.health / 100), 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 184, 31);
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(p.pistol ? `PISTOL  ${p.ammo}` : 'FISTS', 24, 56);
      if (p.car) ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.12)} mph`, 110, 56);
      drawStars(ctx, 24, 76, world.police.wanted);
      ctx.restore();

      drawMinimap(ctx, world, cam);

      // Objective banner under the minimap.
      const obj = world.missions.currentObjective();
      const def = world.missions.currentDef();
      if (obj && def) {
        ctx.save();
        ctx.fillStyle = 'rgba(10,14,20,0.72)';
        const text = `${def.title} — ${obj.text}`;
        ctx.font = 'bold 13px sans-serif';
        const tw = ctx.measureText(text).width;
        ctx.fillRect(W - MINIMAP_W - 14 - 6, 14 + MINIMAP_H + 14, tw + 24, 30);
        ctx.fillStyle = '#ffd23f';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, W - 26, 14 + MINIMAP_H + 29);
        ctx.restore();
        const prog = world.missions.holdProgress();
        if (prog > 0) {
          ctx.save();
          ctx.fillStyle = '#1c2733';
          ctx.fillRect(W / 2 - 110, H - 92, 220, 12);
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(W / 2 - 110, H - 92, 220 * prog, 12);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('CRACKING THE VAULT…', W / 2, H - 106);
          ctx.restore();
        }
      }

      // Phone message from Rico, bottom-left.
      const msg = world.missions.message;
      if (msg) {
        ctx.save();
        ctx.fillStyle = 'rgba(16,20,28,0.88)';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        const lines = wrapText(ctx, msg.text, 320);
        const h = 34 + lines.length * 18;
        ctx.fillRect(14, H - h - 14, 360, h);
        ctx.strokeRect(14, H - h - 14, 360, h);
        ctx.fillStyle = '#7fb3ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`📱 ${msg.from}`, 26, H - h - 2);
        ctx.fillStyle = '#e8ecf1';
        ctx.font = '13px sans-serif';
        lines.forEach((line, i) => ctx.fillText(line, 26, H - h + 20 + i * 18));
        ctx.restore();
      }

      // Centre banner (mission complete / busted / wasted).
      if (world.banner) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, world.bannerTimer * 2);
        ctx.fillStyle = 'rgba(10,14,20,0.78)';
        ctx.fillRect(0, H / 2 - 52, W, 104);
        ctx.fillStyle = world.banner.color;
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(world.banner.title, W / 2, H / 2 - 16);
        ctx.fillStyle = '#e8ecf1';
        ctx.font = '16px sans-serif';
        ctx.fillText(world.banner.sub, W / 2, H / 2 + 24);
        ctx.restore();
      }

      // Controls hint, first seconds of play (hidden while Rico is texting).
      if (world.time < 9 && world.screen === 'play' && !world.missions.message) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (9 - world.time) / 2));
        ctx.fillStyle = 'rgba(10,14,20,0.72)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WASD move / drive   •   E enter or steal a car   •   Space punch   •   Click shoot   •   P pause   •   M mute', W / 2, H - 24);
        ctx.restore();
      }
    },
  };
}

function wrapText(ctx, text, maxWidth) {
  ctx.font = '13px sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
