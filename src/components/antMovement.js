const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));


export const moveAntToward = (ant, target, distance) => {
    const deltaX = target.x - ant.x;
    const deltaY = target.y - ant.y;
    const distanceToTarget = Math.hypot(deltaX, deltaY);

    if (distanceToTarget === 0 || distance <= 0) return;

    const targetHeading = Math.atan2(deltaY, deltaX);
    ant.heading ??= targetHeading;

    // Slowly varying drift gives each ant a slightly different route.
    ant.wanderAngle = clamp(
        (ant.wanderAngle ?? 0) + (Math.random() - 0.5) * 0.025,
        -0.3,
        0.3
    );

    // Reduce wandering near the target so ants can reliably arrive.
    const wanderScale = Math.min(distanceToTarget / 35, 1);
    const desiredHeading = targetHeading + ant.wanderAngle * wanderScale;
    const turn = wrapAngle(desiredHeading - ant.heading);

    ant.heading += clamp(turn, -0.08, 0.08);

    if (distanceToTarget <= distance) {
        ant.x = target.x;
        ant.y = target.y;
        return;
    }

    ant.x += Math.cos(ant.heading) * distance;
    ant.y += Math.sin(ant.heading) * distance;
};

export const moveAntAlongTunnel = (ant, tunnel, distance, direction) => {
    if (tunnel.length < 2 || distance <= 0) return false;

    let routeIndex = ant.routeIndex ?? (direction > 0 ? 1 : tunnel.length - 2);
    let remainingDistance = distance;

    while (remainingDistance > 0 && routeIndex >= 0 && routeIndex < tunnel.length) {
        const waypoint = tunnel[routeIndex];
        const deltaX = waypoint.x - ant.x;
        const deltaY = waypoint.y - ant.y;
        const distanceToWaypoint = Math.hypot(deltaX, deltaY);

        if (distanceToWaypoint <= remainingDistance) {
            ant.x = waypoint.x;
            ant.y = waypoint.y;
            remainingDistance -= distanceToWaypoint;
            routeIndex += direction;
        } else {
            ant.x += (deltaX / distanceToWaypoint) * remainingDistance;
            ant.y += (deltaY / distanceToWaypoint) * remainingDistance;
            remainingDistance = 0;
        }
    }

    ant.routeIndex = routeIndex;
    return direction > 0 ? routeIndex >= tunnel.length : routeIndex < 0;
};

export const moveAntSearching = (ant, width, height, distance) => {
    ant.heading ??= Math.random() * Math.PI * 2;
    ant.heading += (Math.random() - 0.5) * 0.12;

    const margin = 30;
    const nextX = ant.x + Math.cos(ant.heading) * distance;
    const nextY = ant.y + Math.sin(ant.heading) * distance;

    if (nextX < margin || nextX > width - margin) ant.heading = Math.PI - ant.heading;
    if (nextY < margin || nextY > height - margin) ant.heading = -ant.heading;

    ant.x = clamp(ant.x + Math.cos(ant.heading) * distance, margin, width - margin);
    ant.y = clamp(ant.y + Math.sin(ant.heading) * distance, margin, height - margin);
};

