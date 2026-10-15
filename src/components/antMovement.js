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