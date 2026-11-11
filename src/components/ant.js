export const ANT_TYPES = Object.freeze({
    FORAGER: 'forager',
    SCOUT: 'scout',
    DEFENDER: 'defender',
    ENEMY: 'enemy',
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
        this.attackRange = type === ANT_TYPES.ENEMY ? 5 : 8;
        this.attackCooldown = 750;
        this.lastAttackTime = -Infinity;
        this.health = 3;
        this.isAlive = true;
    }

    attackEnemy(enemy, currentTime) {
        if (enemy.isAlive === false || typeof enemy.takeDamage !== 'function') return false;
        if (currentTime - this.lastAttackTime < this.attackCooldown) return false;

        enemy.takeDamage(this.attackDamage, this);
        this.lastAttackTime = currentTime;
        return true;
    }

    takeDamage(damage) {
        if (!this.isAlive) return false;

        this.health = Math.max(0, this.health - damage);
        this.isAlive = this.health > 0;
        return this.isAlive;
    }
}