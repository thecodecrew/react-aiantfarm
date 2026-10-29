export const ANT_TYPES = Object.freeze({
    FORAGER: 'forager',
    SEARCHER: 'searcher',
    DEFENDER: 'defender',
});

export class Ant {
    constructor({ id, x, y, type, state, speed, heading, isScout = false }) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
        this.state = state;
        this.speed = speed;
        this.heading = heading;
        this.wanderAngle = 0;
        this.isScout = isScout;
        this.route = null;
        this.routeIndex = undefined;
        this.routeDirection = 1;
        this.hasFood = false;
        this.targetEnemy = null;
        this.attackDamage = 1;
        this.attackRange = 8;
        this.attackCooldown = 750;
        this.lastAttackTime = -Infinity;
    }

    attackEnemy(enemy, currentTime) {
        if (typeof enemy.takeDamage !== 'function') return false;
        if (currentTime - this.lastAttackTime < this.attackCooldown) return false;

        enemy.takeDamage(this.attackDamage, this);
        this.lastAttackTime = currentTime;
        return true;
    }
}