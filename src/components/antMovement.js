export const moveAntToward = (ant, target, distance) => {
    const deltaX = target.x - ant.x;
    const deltaY = target.y - ant.y;
    const distanceToTarget = Math.hypot(deltaX, deltaY);
    if (distanceToTarget === 0 || distance <= 0) return;

    const stepDistance = Math.min(distance, distanceToTarget);
    ant.x += (deltaX / distanceToTarget) * stepDistance;
    ant.y += (deltaY / distanceToTarget) * stepDistance;
};