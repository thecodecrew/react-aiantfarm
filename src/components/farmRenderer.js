const drawSoilBed = (ctx, width, height, soilGrains) => {
    const soil = ctx.createLinearGradient(0, 0, 0, height);
    soil.addColorStop(0, '#765a3b');
    soil.addColorStop(0.38, '#62482f');
    soil.addColorStop(1, '#4a3625');
    ctx.fillStyle = soil;
    ctx.fillRect(0, 0, width, height);

    const surfaceHeight = 50;
    const surface = ctx.createLinearGradient(0, 0, 0, surfaceHeight);
    surface.addColorStop(0, '#7cac52');
    surface.addColorStop(0.14, '#6b993e');
    surface.addColorStop(1, '#4f6f2a');
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, width, surfaceHeight);

    ctx.fillStyle = 'rgba(92, 63, 34, 0.5)';
    for (let x = 0; x < width; x += 18) {
        ctx.fillRect(x, 12 + (x % 24) * 0.18, 10, 2);
    }

    ctx.strokeStyle = 'rgba(34, 24, 16, 0.14)';
    ctx.lineWidth = 12;
    [0.28, 0.69].forEach((layer, index) => {
        const y = height * layer;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(width * 0.28, y - 12 + index * 5, width * 0.7, y + 15 - index * 4, width, y - 5);
        ctx.stroke();
    });

    soilGrains.forEach((grain) => {
        ctx.fillStyle = grain.color;
        ctx.beginPath();
        ctx.arc(grain.x, grain.y, grain.radius, 0, Math.PI * 2);
        ctx.fill();
    });
};

const drawTunnel = (ctx, tunnelSegments, scoutPath, established) => {
    if (tunnelSegments.length === 0 && scoutPath.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = established ? 'rgba(43, 29, 18, 0.82)' : 'rgba(43, 29, 18, 0.58)';
    ctx.lineWidth = 8;
    tunnelSegments.forEach(({ start, end }) => {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(35, 24, 16, 0.82)';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = established ? 'rgba(43, 29, 18, 0.82)' : 'rgba(43, 29, 18, 0.58)';
        ctx.lineWidth = 8;
    });

    if (scoutPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(scoutPath[0].x, scoutPath[0].y);
        scoutPath.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.strokeStyle = 'rgba(43, 29, 18, 0.58)';
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(35, 24, 16, 0.82)';
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    ctx.restore();
};

const drawNest = (ctx, nest) => {
    const entranceRadius = 16;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, entranceRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(21, 14, 10, 0.96)';
    ctx.beginPath();
    ctx.arc(nest.x, nest.y, entranceRadius * 0.72, 0, Math.PI * 2);
    ctx.fill();
};

const drawFood = (ctx, food) => {
    ctx.fillStyle = food.amount > 0 ? '#22c55e' : '#4b5563';
    ctx.beginPath();
    ctx.arc(food.x, food.y, food.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d1fae5';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Food ${food.amount}`, food.x - 22, food.y + food.radius + 16);
};

const drawAnts = (ctx, ants) => {
    ants.forEach((ant) => {
        ctx.fillStyle = ant.state === 'returning' ? '#ef4444' : ant.state === 'waiting' ? '#a3a3a3' : '#ffffff';
        ctx.fillRect(ant.x, ant.y, 2, 2);
    });
};

export const createSoilGrains = (width, height) =>
    Array.from({ length: Math.min(240, Math.floor((width * height) / 4000)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.5 + Math.random(),
        color: Math.random() > 0.5 ? 'rgba(221, 184, 132, 0.2)' : 'rgba(30, 20, 13, 0.22)',
    }));

export const renderFarm = (ctx, { width, height, nest, food, ants, tunnelSegments, scoutPath, tunnelEstablished, soilGrains }) => {
    drawSoilBed(ctx, width, height, soilGrains);
    drawTunnel(ctx, tunnelSegments, scoutPath, tunnelEstablished);
    drawNest(ctx, nest);
    drawFood(ctx, food);
    drawAnts(ctx, ants);
};